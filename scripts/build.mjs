import { mkdir, cp, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("src", "dist", { recursive: true });
await cp("public", "dist", { recursive: true });
console.log(
  "Production build complete: dist (static assets, no server or secrets).",
);
