import 'reflect-metadata';
import { createApp } from './app';

async function bootstrap() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT || 3001), '127.0.0.1');
  console.log(`ConsultAI API ready at http://localhost:${process.env.PORT || 3001}`);
}
void bootstrap();
