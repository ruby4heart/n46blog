const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const targets = [
  { path: "server.js", chunks: 2, sha256: "97a945e1e09358800a241719ed7b0be10051a40d13a4ebbf9e3628b72b0e0b1e" },
  { path: "public/index.html", chunks: 1, sha256: "460313dc96a9bb0ebc283c789d364cdb2a1e93bfde505ebd663f370a45ac7ed2" },
  { path: "public/styles.css", chunks: 1, sha256: "600f44c4731c2a9f87063762dc9e0a21811ba0fa3512712ad218cf0507e13aa5" },
  { path: "public/app.js", chunks: 4, sha256: "e858effde27048bca2451819b9c712ee84c7eb83ac33d6725fbe6ddf84d0b099" },
  { path: "functions/_lib/shared.js", chunks: 1, sha256: "b569faaf55ce3dc2892bc162ca8d4bda1a51c89bd43bc1d5e98fb690904e5016" },
  { path: "functions/api/health.js", chunks: 1, sha256: "332f0d609631685de3dffc7c9298f43fd1f438fe85f9206d0f06f34bc5fd12c3" },
  { path: "functions/api/fetch-rss.js", chunks: 1, sha256: "39b9ae2a75a4f99c1680c8a25c059335bda9b825ad32ccbd4b7be22e228b0f36" },
  { path: "functions/api/proxy-image.js", chunks: 1, sha256: "a5b16b9b9932180fb1560a223bc298a2286db92d3740916b65546619967f0b4d" },
  { path: "functions/api/translate.js", chunks: 1, sha256: "ad7a8677ed85cd2cc4f821daf6b12059a2e8141a068c21eae8b659a2f6921a9e" }
];

for (const target of targets) {
  const encoded = Array.from({ length: target.chunks }, (_, index) => {
    const chunkPath = path.join("chunks", target.path.replace(/[\\/]/g, "__") + `.${String(index).padStart(2, "0")}.b64`);
    return fs.readFileSync(chunkPath, "utf8").trim();
  }).join("");

  const bytes = Buffer.from(encoded, "base64");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== target.sha256) {
    throw new Error(`Checksum mismatch for ${target.path}: ${digest}`);
  }

  fs.mkdirSync(path.dirname(target.path), { recursive: true });
  fs.writeFileSync(target.path, bytes);
  console.log(`restored ${target.path}`);
}
