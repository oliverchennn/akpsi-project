import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (!path.startsWith(root + "/") && path !== root) {
      res.writeHead(403).end();
      return;
    }
    try {
      const file = path === root ? resolve(root, "index.html") : path;
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(4173, "0.0.0.0", () =>
    console.log("Tarely preview http://localhost:4173"),
  );
