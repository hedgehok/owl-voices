import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.normalize(path.join(root, url === "/" ? "index.html" : url));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    if (stat.isDirectory()) file = path.join(file, "index.html");
    fs.stat(file, (statError, fileStat) => {
      if (statError || !fileStat.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
      const total = fileStat.size;
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) {
          res.writeHead(416, { "Content-Range": `bytes */${total}` });
          res.end();
          return;
        }
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : total - 1;
        if (start > end || end >= total) {
          res.writeHead(416, { "Content-Range": `bytes */${total}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          "Content-Type": type,
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes"
        });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": type,
        "Content-Length": total,
        "Accept-Ranges": "bytes"
      });
      fs.createReadStream(file).pipe(res);
    });
  });
});

server.listen(port, () => {
  console.log(`Ночные голоса: http://localhost:${port}`);
});
