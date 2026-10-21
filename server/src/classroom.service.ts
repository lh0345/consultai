import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from './database';
import { GoogleService } from './google.service';
import { parse, uuid } from './validation';
import { Prisma } from './generated/prisma/client';

type Course = { id: string; name: string; section?: string };
type CourseMaterial = { id: string; title: string; materials?: { driveFile?: { driveFile?: { id: string; title?: string } } }[] };
const googleId = z.string().min(1).max(150).regex(/^[a-zA-Z0-9_-]+$/);

@Injectable()
export class ClassroomService {
  constructor(private readonly db: Database, private readonly google: GoogleService) {}
  private async pages<T>(url: string, key: string): Promise<T[]> {
    if (!await this.google.connected('classroom')) throw new ServiceUnavailableException('Connect Google Classroom first.');
    const rows: T[] = [];
    let pageToken = '';
    do {
      const page = new URL(url);
      page.searchParams.set('pageSize', '100');
      if (pageToken) page.searchParams.set('pageToken', pageToken);
      let data;
      try { data = await (await this.google.request(page.toString())).json(); }
      catch { throw new ServiceUnavailableException('Classroom could not be read. Check permissions and try again.'); }
      rows.push(...(data[key] || []));
      pageToken = data.nextPageToken || '';
      if (rows.length > 1000) throw new BadRequestException('This Classroom collection is too large for the local demo. Import a smaller collection manually.');
    } while (pageToken);
    return rows;
  }
  async courses() {
    const [courses, subjects] = await Promise.all([
      this.pages<Course>('https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE', 'courses'),
      this.db.subject.findMany({ where: { classroomId: { not: null } }, select: { id: true, classroomId: true } }),
    ]);
    return courses.map((course) => ({ id: course.id, name: course.name, section: course.section, importedSubjectId: subjects.find((subject) => subject.classroomId === course.id)?.id }));
  }
  async importCourse(body: unknown) {
    const { courseId, code } = parse(z.strictObject({ courseId: googleId, code: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9 _-]+$/).transform((value) => value.toUpperCase()) }), body);
    const course = (await this.courses()).find((row) => row.id === courseId);
    if (!course) throw new NotFoundException('Choose a course you teach in Classroom.');
    try {
      return await this.db.subject.upsert({ where: { classroomId: course.id }, update: {}, create: { classroomId: course.id, name: course.name.slice(0, 100), code, icon: 'book' } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('That course code is already in use. Choose a different code.');
      throw error;
    }
  }
  async importMaterials(body: unknown) {
    const { subjectId } = parse(z.strictObject({ subjectId: uuid }), body);
    const subject = await this.db.subject.findUnique({ where: { id: subjectId } });
    if (!subject?.classroomId) throw new BadRequestException('Import this subject from Classroom first.');
    if (!(await this.courses()).some((course) => course.id === subject.classroomId)) throw new NotFoundException('This course is no longer available in your teaching account.');
    const materials = await this.pages<CourseMaterial>(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(subject.classroomId)}/courseWorkMaterials?courseWorkMaterialStates=PUBLISHED`, 'courseWorkMaterial');
    let imported = 0;
    for (const material of materials) {
      for (const attachment of material.materials || []) {
        const file = attachment.driveFile?.driveFile;
        if (!file?.id) continue;
        parse(googleId, file.id);
        const existing = await this.db.material.findUnique({ where: { subjectId_driveId: { subjectId, driveId: file.id } } });
        if (!existing) {
          await this.db.material.upsert({ where: { subjectId_driveId: { subjectId, driveId: file.id } }, update: {}, create: { subjectId, driveId: file.id, title: (file.title || material.title).slice(0, 150), content: '', approved: false } });
          imported++;
        }
      }
    }
    return { imported };
  }
  async loadText(id: string) {
    const material = await this.db.material.findUnique({ where: { id: parse(uuid, id) } });
    if (!material?.driveId) throw new BadRequestException('This material has no Drive source.');
    if (!await this.google.connected('classroom')) throw new ServiceUnavailableException('Connect Classroom and grant read access to Drive first.');
    const fileId = encodeURIComponent(parse(googleId, material.driveId));
    let metadata: { mimeType: string; size?: string; capabilities?: { canDownload?: boolean } };
    try { metadata = await (await this.google.request(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,size,capabilities(canDownload)&supportsAllDrives=true`)).json(); }
    catch { throw new ServiceUnavailableException('This private Drive file could not be read. Check the Google account and file permissions.'); }
    if (metadata.capabilities?.canDownload === false) throw new BadRequestException('The file owner has disabled downloading this material.');
    if (Number(metadata.size || 0) > 240_000) throw new BadRequestException('This file is too large. Paste the relevant lecture text instead.');
    let url: string;
    if (metadata.mimeType === 'application/vnd.google-apps.document') url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text%2Fplain`;
    else if (metadata.mimeType === 'text/plain') url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    else throw new BadRequestException('Automatic reading supports Google Docs and plain-text files. For PDF, slides, or other files, paste the relevant text during review.');
    let response: Response;
    try { response = await this.google.request(url); }
    catch { throw new ServiceUnavailableException('Drive content could not be loaded. Check access and retry.'); }
    const reader = response.body?.getReader();
    if (!reader) throw new BadRequestException('The file has no readable text.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 240_000) { await reader.cancel(); throw new BadRequestException('This text is too large. Paste a relevant excerpt instead.'); }
      chunks.push(chunk.value);
    }
    const content = Buffer.concat(chunks).toString('utf8').trim();
    if (content.length < 20 || content.length > 60_000) throw new BadRequestException('Course text must contain 20–60,000 characters. Paste a relevant excerpt instead.');
    return this.db.material.update({ where: { id }, data: { content, approved: false } });
  }
}
