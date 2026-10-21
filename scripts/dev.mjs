import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".env"))
  throw new Error("Copy .env.example to .env before starting.");
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === "win32")
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    else child.kill("SIGTERM");
  }
  process.exit(code);
}
function run(args) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", () => stop(1));
  children.push(child);
  return child;
}
const compile = run([
  "node_modules/typescript/bin/tsc",
  "-p",
  "server/tsconfig.json",
]);
compile.on("exit", (code) => {
  if (code) return stop(code);
  run([
    "node_modules/typescript/bin/tsc",
    "-p",
    "server/tsconfig.json",
    "--watch",
    "--preserveWatchOutput",
  ]);
  const api = run(["--watch", "--env-file=.env", "server/dist/main.js"]);
  const web = run(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"]);
  api.on("exit", (status) => {
    if (!stopping) stop(status || 0);
  });
  web.on("exit", (status) => {
    if (!stopping) stop(status || 0);
  });
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
