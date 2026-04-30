import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createServer } from "node:http";

const port = Number(process.env.PORT || 3000);
const root = resolve(".");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function safePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const filePath = resolve(join(root, cleanPath || "index.html"));
  return filePath.startsWith(root) ? filePath : join(root, "index.html");
}

createServer((request, response) => {
  const filePath = safePath(request.url || "/");
  const finalPath = existsSync(filePath) ? filePath : join(root, "index.html");
  const type = mimeTypes[extname(finalPath)] || "application/octet-stream";

  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });

  createReadStream(finalPath).pipe(response);
}).listen(port, () => {
  console.log(`Emergency Ward AI running at http://localhost:${port}`);
});
