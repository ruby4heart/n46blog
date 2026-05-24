import { json, normalizeHttpUrl } from "../_lib/shared.js";

export async function onRequestGet({ request }) {
  try {
    const requestUrl = new URL(request.url);
    const imageUrl = normalizeHttpUrl(requestUrl.searchParams.get("url"));
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "NogizakaBlogRSSStudio/1.0 (+https://pages.cloudflare.com)",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
      }
    });
    if (!response.ok) return json({ error: `Image request failed: ${response.status}` }, 502);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.toLowerCase().startsWith("image/")) return json({ error: "URL did not return an image." }, 415);
    return new Response(response.body, { status: 200, headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    return json({ error: error.message || "图片代理请求失败。" }, error.statusCode || 500);
  }
}
