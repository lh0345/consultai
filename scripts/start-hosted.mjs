import { spawnSync } from "node:child_process";
import { createApp } from "../server/dist/app.js";

process.env.APP_ORIGIN ||= process.env.RENDER_EXTERNAL_URL;
if (
  !process.env.DATABASE_URL ||
  !process.env.ADMIN_PASSWORD ||
  !process.env.APP_ORIGIN?.startsWith("https:")
)
  throw new Error(
    "Set DATABASE_URL, ADMIN_PASSWORD, and an HTTPS APP_ORIGIN before hosting.",
  );

// Fail closed before migrations or listening if hosted authentication is invalid.
process.env.NODE_ENV = "production";
process.env.HOST = "0.0.0.0";
const app = await createApp();
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
if (migration.status !== 0) {
  await app.close();
  process.exit(migration.status || 1);
}
if (process.env.SEED_DEMO === "true") {
  const seed = spawnSync(process.execPath, ["scripts/seed.mjs"], {
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (seed.status !== 0) {
    await app.close();
    process.exit(seed.status || 1);
  }
}
await app.listen(Number(process.env.PORT || 10000), "0.0.0.0");
console.log("ConsultAI is ready.");
