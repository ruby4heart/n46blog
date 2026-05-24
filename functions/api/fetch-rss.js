import { fetchTextWithLimit, json, normalizeHttpUrl, parseFeed } from "../_lib/shared.js";

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const feedUrl = normalizeHttpUrl(body.url);
    const limit = Math.max(1, Math.min(10, Number(body.limit || 3)));
    const xml = await fetchTextWithLimit(feedUrl);
    return json(parseFeed(xml, feedUrl, limit));
  } catch (error) {
    return json({ error: error.message || "RSS 请求失败。" }, error.statusCode || 500);
  }
}
