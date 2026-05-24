const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml; charset=utf-8" };

loadEnv();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "Method not allowed" });
    const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const file = path.normalize(path.join(publicDir, requested));
    if (!file.startsWith(publicDir)) return sendJson(res, 403, { error: "Forbidden" });
    fs.readFile(file, (err, data) => {
      if (err) return sendJson(res, 404, { error: "Not found" });
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : data);
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || "Server error" });
  }
}).listen(port, () => console.log(`Nogizaka Blog RSS Studio running at http://localhost:${port}`));

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, "");
  const modulePath = route === "health" ? "./functions/api/health.js" : route === "fetch-rss" ? "./functions/api/fetch-rss.js" : route === "proxy-image" ? "./functions/api/proxy-image.js" : route === "translate" ? "./functions/api/translate.js" : "";
  if (!modulePath) return sendJson(res, 404, { error: "Not found" });
  const mod = await import(modulePath);
  const body = await readBody(req);
  const request = new Request(`http://localhost:${port}${url.pathname}${url.search}`, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
  const handler = req.method === "GET" ? mod.onRequestGet : mod.onRequestPost;
  if (!handler) return sendJson(res, 405, { error: "Method not allowed" });
  const response = await handler({ request, env: process.env });
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body) {
    const reader = response.body.getReader();
    while (true) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
    res.end();
  } else res.end(await response.text());
}
function readBody(req) { return new Promise((resolve, reject) => { const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject); }); }
function sendJson(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(payload)); }
function loadEnv() { const file = path.join(root, ".env"); if (!fs.existsSync(file)) return; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); } }
