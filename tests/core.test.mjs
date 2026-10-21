import "reflect-metadata";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createApp } from "../server/dist/app.js";
import { Database } from "../server/dist/database.js";
import { slotTimes } from "../server/dist/validation.js";
import { GoogleService } from "../server/dist/google.service.js";
import { ServiceUnavailableException } from "@nestjs/common";
import { verifiedSources } from "../server/dist/study.service.js";
import { ProfessorAuth } from "../server/dist/professor-auth.js";
import { request as httpRequest } from "node:http";

// Use a new isolated PostgreSQL schema each run. Never reset or remove existing data.
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const originalUrl = process.env.DATABASE_URL;
let app, db, base, subjects;
const futureDay = (offset = 1) =>
  new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);
async function request(path, body, method = "POST", headers = {}) {
  const result = await fetch(`${base}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: result.status, body: await result.json() };
}
const slotBody = (offset, startTime = "09:00") => ({
  date: futureDay(offset),
  startTime,
  duration: 30,
});
const bookingBody = (slot, subject = subjects[0]) => ({
  slotId: slot.id,
  subjectId: subject.id,
  expectedStartsAt: new Date(slot.startsAt).toISOString(),
  expectedEndsAt: new Date(slot.endsAt).toISOString(),
  name: "Test Student",
  email: "student@example.edu",
  question: "Please explain tree traversal.",
  requestKey: randomUUID(),
});

before(async () => {
  const bootstrap = new Database();
  await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await bootstrap.$disconnect();
  const url = new URL(originalUrl);
  url.searchParams.set("schema", schema);
  process.env.DATABASE_URL = url.toString();
  execFileSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "pipe" },
  );
  db = new Database();
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  subjects = await Promise.all(
    ["CS-A", "CS-B"].map((code) =>
      db.subject.create({ data: { name: `Subject ${code}`, code } }),
    ),
  );
});
after(async () => {
  await app?.close();
  await db?.$disconnect();
  process.env.DATABASE_URL = originalUrl;
  console.log(`Isolated test records retained in PostgreSQL schema ${schema}.`);
});

test("book, hide across subjects, retry idempotently, and persist after API restart", async () => {
  const slot = (await request("/admin/slots", slotBody(2))).body;
  const input = bookingBody(slot);
  const saved = await request("/bookings", input);
  assert.equal(saved.status, 201);
  assert.equal(
    saved.body.slot.startsAt,
    slotTimes(slotBody(2)).startsAt.toISOString(),
  );
  assert.equal((await request("/bookings", input)).body.id, saved.body.id);
  assert.equal(
    (await request("/bookings", { ...input, subjectId: subjects[1].id }))
      .status,
    409,
  );
  const available = await request(
    `/slots?from=${futureDay(2)}&to=${futureDay(2)}`,
    null,
    "GET",
  );
  assert.ok(!available.body.some((value) => value.id === slot.id));
  await app.close();
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  const list = await request("/admin/bookings", null, "GET");
  assert.equal(
    list.body.find((value) => value.id === saved.body.id).email,
    input.email,
  );
  assert.equal(
    (await request(`/admin/slots/${slot.id}`, slotBody(3), "PATCH")).status,
    409,
  );
  assert.equal(
    (await request(`/admin/slots/${slot.id}`, null, "DELETE")).status,
    409,
  );
});

test("simultaneous HTTP bookings allow exactly one student, including across subjects", async () => {
  const slot = (await request("/admin/slots", slotBody(4))).body;
  const attempts = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      request("/bookings", bookingBody(slot, subjects[i % 2])),
    ),
  );
  assert.equal(attempts.filter((value) => value.status === 201).length, 1);
  assert.equal(attempts.filter((value) => value.status === 409).length, 11);
  assert.equal(await db.booking.count({ where: { slotId: slot.id } }), 1);
});

test("PostgreSQL prevents concurrent overlapping slots and direct duplicate bookings", async () => {
  const apiOverlaps = await Promise.all(
    Array.from({ length: 6 }, () => request("/admin/slots", slotBody(14))),
  );
  assert.equal(apiOverlaps.filter((value) => value.status === 201).length, 1);
  assert.equal(apiOverlaps.filter((value) => value.status === 409).length, 5);
  const times = slotTimes(slotBody(6));
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => db.slot.create({ data: times })),
  );
  assert.equal(
    results.filter((value) => value.status === "fulfilled").length,
    1,
  );
  const slot = results.find((value) => value.status === "fulfilled").value;
  const adjacent = {
    startsAt: slot.endsAt,
    endsAt: new Date(slot.endsAt.getTime() + 30 * 60_000),
  };
  await db.slot.create({ data: adjacent });
  const attempts = await Promise.allSettled(
    Array.from({ length: 4 }, () => {
      const { expectedStartsAt, expectedEndsAt, ...data } = bookingBody(slot);
      return db.booking.create({ data });
    }),
  );
  assert.equal(
    attempts.filter((value) => value.status === "fulfilled").length,
    1,
  );
  await assert.rejects(
    db.slot.update({
      where: { id: slot.id },
      data: { endsAt: new Date(slot.endsAt.getTime() - 60_000) },
    }),
  );
});

test("reject invalid inputs, time ranges, and cross-origin mutations; keep PII private", async () => {
  const remoteHostStatus = await new Promise((resolve, reject) => {
    const call = httpRequest(`${base}/api/admin/bookings`, { headers: { Host: "public.example" } }, response => {
      response.resume();
      resolve(response.statusCode);
    });
    call.on("error", reject);
    call.end();
  });
  assert.equal(remoteHostStatus, 401);
  assert.equal(
    (await request("/admin/slots", { ...slotBody(8), duration: 0 })).status,
    400,
  );
  assert.equal(
    (await request("/admin/slots", { ...slotBody(8), date: "2027-02-30" }))
      .status,
    400,
  );
  assert.equal(
    (
      await request("/admin/slots", slotBody(8), "POST", {
        Origin: "https://untrusted.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/admin/slots", slotBody(16), "POST", {
        Origin: "http://127.0.0.1:5173",
      })
    ).status,
    201,
  );
  assert.equal(
    (await request("/bookings", { name: "A", email: "invalid" })).status,
    400,
  );
  assert.equal(
    (await request("/slots?from=2027-01-01&to=2028-01-01", null, "GET")).status,
    400,
  );
  const available = await request("/slots", null, "GET");
  assert.ok(available.body.every((value) => !("booking" in value)));
  const stale = (await request("/admin/slots", slotBody(12))).body;
  assert.equal(
    (await request(`/admin/slots/${stale.id}`, slotBody(12, "10:00"), "PATCH"))
      .status,
    200,
  );
  assert.equal((await request("/bookings", bookingBody(stale))).status, 409);
});

test("hosted professor access protects records, limits login attempts, and revokes sessions", async () => {
  const saved = Object.fromEntries(
    ["ADMIN_PASSWORD", "APP_ORIGIN", "NODE_ENV", "HOST"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  const password = `integration-test-only-${randomUUID()}`;
  let protectedApp;
  try {
    process.env.ADMIN_PASSWORD = password;
    process.env.APP_ORIGIN = "https://consultai.example";
    protectedApp = await createApp();
    await protectedApp.listen(0, "127.0.0.1");
    let origin = await protectedApp.getUrl();
    const call = (path, body, cookie, extra = {}) =>
      fetch(`${origin}/api${path}`, {
        method: body ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...extra,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await call("/admin/bookings")).status, 401);
    assert.equal(
      (await (await call("/auth/professor")).json()).authenticated,
      false,
    );
    assert.equal(
      (await call("/auth/professor", { password: "wrong" })).status,
      401,
    );
    assert.equal(
      (
        await call("/auth/professor", { password }, undefined, {
          Origin: "https://evil.example",
        })
      ).status,
      403,
    );
    const login = async () => {
      const response = await call("/auth/professor", { password });
      assert.equal(response.status, 201);
      const header = response.headers.get("set-cookie");
      assert.match(header, /__Host-consultai-professor=/);
      assert.match(header, /HttpOnly/);
      assert.match(header, /Secure/);
      assert.match(header, /SameSite=Lax/);
      assert.match(header, /Path=\//);
      return header.split(";")[0];
    };
    const first = await login();
    assert.equal((await call("/admin/bookings", null, first)).status, 200);
    assert.equal(
      (await call("/admin/bookings", null, `${first.slice(0, -2)}xx`)).status,
      401,
    );
    assert.equal((await call("/auth/professor/logout", {}, first)).status, 201);
    assert.equal((await call("/admin/bookings", null, first)).status, 401);
    const expiring = await login();
    const now = Date.now;
    try {
      Date.now = () => now() + 8 * 60 * 60 * 1000 + 1;
      assert.equal((await call("/admin/bookings", null, expiring)).status, 401);
    } finally {
      Date.now = now;
    }
    const restart = await login();
    await protectedApp.close();
    protectedApp = await createApp();
    await protectedApp.listen(0, "127.0.0.1");
    origin = await protectedApp.getUrl();
    assert.equal((await call("/admin/bookings", null, restart)).status, 401);
    for (let attempt = 0; attempt < 10; attempt++)
      assert.equal(
        (await call("/auth/professor", { password: "wrong" })).status,
        401,
      );
    assert.equal((await call("/auth/professor", { password })).status, 429);
    delete process.env.ADMIN_PASSWORD;
    process.env.NODE_ENV = "production";
    assert.throws(() => new ProfessorAuth(), /ADMIN_PASSWORD/);
  } finally {
    await protectedApp?.close();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Skopje clock changes reject ambiguous and nonexistent local times", () => {
  const year = new Date().getUTCFullYear() + 1;
  const lastSunday = (month) => {
    const date = new Date(Date.UTC(year, month, 0, 12));
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    return date.toISOString().slice(0, 10);
  };
  assert.throws(
    () => slotTimes({ date: lastSunday(3), startTime: "02:30", duration: 30 }),
    /missing or ambiguous/,
  );
  assert.throws(
    () => slotTimes({ date: lastSunday(10), startTime: "02:30", duration: 30 }),
    /missing or ambiguous/,
  );
  assert.equal(
    slotTimes({
      date: `${year}-01-12`,
      startTime: "09:00",
      duration: 30,
    }).startsAt.toISOString(),
    `${year}-01-12T08:00:00.000Z`,
  );
  assert.equal(
    slotTimes({
      date: `${year}-07-12`,
      startTime: "09:00",
      duration: 30,
    }).startsAt.toISOString(),
    `${year}-07-12T07:00:00.000Z`,
  );
});

test("Calendar check failure rejects safely; sync failure preserves confirmed booking", async () => {
  const google = app.get(GoogleService);
  const original = {
    busy: google.busy,
    connected: google.connected,
    request: google.request,
  };
  const slot = (await request("/admin/slots", slotBody(10))).body;
  const input = bookingBody(slot);
  try {
    google.busy = async () => {
      throw new ServiceUnavailableException("Calendar unavailable");
    };
    assert.equal((await request("/bookings", input)).status, 503);
    assert.equal(await db.booking.count({ where: { slotId: slot.id } }), 0);
    google.busy = async () => [];
    google.connected = async () => true;
    google.request = async () => {
      throw new ServiceUnavailableException("Google unavailable");
    };
    const result = await request("/bookings", input);
    assert.equal(result.status, 201);
    assert.equal(result.body.calendarStatus, "failed");
    assert.equal((await request("/bookings", input)).body.id, result.body.id);
    assert.equal(await db.booking.count({ where: { slotId: slot.id } }), 1);
  } finally {
    Object.assign(google, original);
  }
});

test("only approved material metadata is public; AI requires setup and verifies quotes", async () => {
  const content =
    "A binary tree is a hierarchical data structure. Each node has at most two children, a left child and a right child.";
  const saved = await request("/admin/materials", {
    subjectId: subjects[0].id,
    title: "Binary trees",
    content,
    approved: false,
  });
  assert.equal(saved.status, 201);
  const material = saved.body;
  const prompt = {
    subjectId: subjects[0].id,
    materialId: material.id,
    question: "What is a binary tree?",
    history: [],
  };
  assert.equal((await request("/ai", prompt)).status, 404);
  assert.deepEqual(
    (await request(`/subjects/${subjects[0].id}/materials`, null, "GET")).body,
    [],
  );
  assert.equal(
    (
      await request(
        `/admin/materials/${material.id}/approval`,
        { approved: true },
        "PATCH",
      )
    ).status,
    200,
  );
  const list = (
    await request(`/subjects/${subjects[0].id}/materials`, null, "GET")
  ).body;
  assert.equal(list[0].title, "Binary trees");
  assert.ok(!("content" in list[0]) && !("driveId" in list[0]));
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "";
  try {
    assert.equal((await request("/ai", prompt)).status, 503);
  } finally {
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
  const sources = verifiedSources(material, [
    "Each node has at most two children, a left child and a right child.",
    "This fabricated reference is not in the source.",
  ]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].materialId, material.id);
});

test("Classroom imports are repeatable, private, and scoped to each subject", async () => {
  const google = app.get(GoogleService);
  const original = { connected: google.connected, request: google.request };
  const courseData = [
    { id: "course_one", name: "Imported course one" },
    { id: "course_two", name: "Imported course two" },
  ];
  try {
    google.connected = async () => true;
    google.request = async (url) => {
      const path = new URL(url).pathname;
      let body;
      if (path === "/v1/courses") body = { courses: courseData };
      else if (path.endsWith("/courseWorkMaterials"))
        body = {
          courseWorkMaterial: [
            {
              id: "lecture_one",
              title: "Imported lecture",
              materials: [
                {
                  driveFile: {
                    driveFile: {
                      id: "shared_drive_source",
                      title: "Private notes",
                    },
                  },
                },
              ],
            },
          ],
        };
      else if (path.endsWith("/export"))
        return new Response(
          "These private lecture notes describe how a binary tree stores at most two child nodes per parent.",
        );
      else if (path.endsWith("/shared_drive_source"))
        body = {
          mimeType: "application/vnd.google-apps.document",
          capabilities: { canDownload: true },
        };
      else throw new Error("Unexpected provider URL");
      return Response.json(body);
    };
    for (const [index, course] of courseData.entries()) {
      const imported = await request("/admin/classroom/courses", {
        courseId: course.id,
        code: `IMPORT-${index}`,
      });
      assert.equal(imported.status, 201);
      const subject = imported.body;
      assert.equal(
        (
          await request("/admin/classroom/courses", {
            courseId: course.id,
            code: `IMPORT-${index}`,
          })
        ).body.id,
        subject.id,
      );
      assert.equal(
        (await request("/admin/classroom/materials", { subjectId: subject.id }))
          .body.imported,
        1,
      );
      assert.equal(
        (await request("/admin/classroom/materials", { subjectId: subject.id }))
          .body.imported,
        0,
      );
      const material = await db.material.findFirstOrThrow({
        where: { subjectId: subject.id },
      });
      assert.equal(material.approved, false);
      assert.equal(material.content, "");
      const loaded = await request(`/admin/materials/${material.id}/drive`, {});
      assert.equal(loaded.status, 201);
      assert.equal(loaded.body.approved, false);
      assert.ok(loaded.body.content.startsWith("These private lecture notes"));
      assert.deepEqual(
        (await request(`/subjects/${subject.id}/materials`, null, "GET")).body,
        [],
      );
    }
    assert.equal(
      await db.material.count({ where: { driveId: "shared_drive_source" } }),
      2,
    );
  } finally {
    Object.assign(google, original);
  }
});
