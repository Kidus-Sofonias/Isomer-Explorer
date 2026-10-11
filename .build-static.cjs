const fs = require("fs"), path = require("path");
const root = process.cwd(), build = path.join(root, "build");
try { fs.mkdirSync(build, { recursive: true }); } catch (e) { if (e.code !== "EEXIST") throw e; }
// Overwrite-in-place (no rmSync of the dir — Windows locks build/ while a server serves it).
function copyOver(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) { console.warn("skip (missing):", rel); return; }
  const dst = path.join(build, rel);
  try { fs.rmSync(dst, { recursive: true, force: true }); } catch (e) {}
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copyOver(path.join(rel, name));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log("copied:", rel);
  }
}
["index.html","styles.css","app.js","molecule-viewer-3d.js","service-worker.js","manifest.webmanifest","vendor","assets","chemengine"].forEach(copyOver);
// Best-effort: remove stale files not in the wanted set (not the dir itself).
try {
  for (const name of fs.readdirSync(build)) {
    if (name === "vendor" || name === "assets" || name === "chemengine") continue;
    if (!["index.html","styles.css","app.js","molecule-viewer-3d.js","service-worker.js","manifest.webmanifest"].includes(name)) {
      try { fs.rmSync(path.join(build, name), { recursive: true, force: true }); } catch (e) {}
    }
  }
} catch (e) {}
console.log("build: stale files cleaned (best-effort)");
console.log("build: static app copied to build/");
