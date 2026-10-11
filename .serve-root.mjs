import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { argv } from "node:process";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const baseDir = path.join(projectDir, "build");
const base = path.resolve(baseDir);
const host = "127.0.0.1";
const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

const s = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  const requestedPath = path.resolve(base, "." + pathname);
  const relativePath = path.relative(base, requestedPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let f = requestedPath;
  if (pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});

const port = Number(argv[2] || 5173);
const maxPort = Math.min(port + 20, 65535);

function listen(nextPort) {
  s.once("error", (error) => {
    if (error.code === "EADDRINUSE" && nextPort < maxPort) {
      console.warn(`Port ${nextPort} is busy; trying ${nextPort + 1}.`);
      listen(nextPort + 1);
      return;
    }
    console.error(`Could not start the development server on port ${nextPort}:`, error.message);
    process.exitCode = 1;
  });
  s.listen(nextPort, host, () => {
    console.log(`Development server: http://${host}:${nextPort}/`);
    console.log("Serving", baseDir, "from", base);
  });
}

listen(port);
