export const DEFAULT_MODEL = "gpt-5.4-mini";
export const NOGIZAKA_TERM_GUIDE = `
乃木坂46博客翻译术语规则：
1. 人名、歌曲名、演唱会标题、节目名可保留日文原文，不要硬翻成员姓名和歌曲名。
2. 组合/饭圈专有名词按固定译名处理：ミグリ=线上见面会；リアルミグリ=线下见面会；部=部/场次；枚数=券数；まとめ出し=叠券；鍵閉め=键闭；認知=认知；連番=连番；レポ=互动报告。
3. 成员层级：表題曲=表题曲；選抜=选拔；アンダー=Under；アンダーライブ=Under Live；福神=福神；センター=Center/C位；期別=期别；キャプテン=队长。
4. 现场文化：OVERTURE 保留英文；真夏の全国ツアー/全ツ=真夏的全国巡演/全巡；神宮=神宫/明治神宫野球场；バスラ=BIRTHDAY LIVE/生日演唱会；卒コン=毕业演唱会；サイリウムカラー=推色；推しメンマフラータオル=推巾；影ナレ=影播；座長=座长。
5. 周边生态：生写真=生写真；コンプ=Complete/核心套；ヨリ=近景；チュウ=中景；ヒキ=远景；祝花/フラスタ=祝花；界隈=界隈/小圈子。
6. 粉丝黑话：箱推=箱推/全团推；単推=单推；推し=推；神推し=神推；DD=DD；釣り師=钓师；塩対応=盐对应；卒業=毕业。
7. 团综企划：乃木坂工事中/乃木中/乃木工=《乃木坂工事中》；バナナマン=香蕉人；ヒット祈願=祈愿/大卖祈愿；16人のプリンシパル=十六人的主角；定点カメラ=定点相机；モバメ=Mail；メッセージ=Message。
`;

const MAX_RSS_BYTES = 5_000_000;
const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}
export function sanitizeModel(value) {
  const model = String(value || DEFAULT_MODEL).trim();
  return /^[a-zA-Z0-9._:-]+$/.test(model) ? model : DEFAULT_MODEL;
}
export function normalizeHttpUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || "").trim()); } catch { const err = new Error("请输入有效的 RSS 链接。"); err.statusCode = 400; throw err; }
  if (!["http:", "https:"].includes(parsed.protocol)) { const err = new Error("链接必须以 http 或 https 开头。"); err.statusCode = 400; throw err; }
  return parsed.toString();
}
export async function fetchTextWithLimit(url) {
  const response = await fetch(url, { headers: { "User-Agent": "NogizakaBlogRSSStudio/1.0 (+https://pages.cloudflare.com)", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
  if (!response.ok) { const err = new Error(`RSS 请求失败：${response.status}`); err.statusCode = 502; throw err; }
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_RSS_BYTES) { const err = new Error("RSS 内容过大。"); err.statusCode = 413; throw err; } chunks.push(value); }
  return new TextDecoder().decode(concat(chunks, total));
}
function concat(chunks, total) { const out = new Uint8Array(total); let offset = 0; for (const c of chunks) { out.set(c, offset); offset += c.byteLength; } return out; }
export function parseFeed(xml, feedUrl, limit) {
  const channel = firstBlock(xml, "channel") || xml;
  const feedTitle = cleanText(getTag(channel, ["title"]) || "RSS Feed");
  const feedLink = cleanText(getTag(channel, ["link"])) || feedUrl;
  const itemBlocks = blocks(xml, "item");
  const atomBlocks = itemBlocks.length ? [] : blocks(xml, "entry");
  const sourceBlocks = itemBlocks.length ? itemBlocks : atomBlocks;
  const entries = sourceBlocks.slice(0, limit).map((block, index) => {
    const rawContent = getTag(block, ["content:encoded", "content", "description", "summary"]) || "";
    const contentHtml = decodeEntities(rawContent);
    const blockHtml = decodeEntities(block);
    const title = cleanText(getTag(block, ["title"]) || "Untitled");
    const link = cleanText(getTag(block, ["link"])) || atomLink(block) || feedLink;
    const published = cleanText(getTag(block, ["pubDate", "published", "updated", "dc:date"]));
    const author = cleanText(getTag(block, ["dc:creator", "creator", "author"])) || cleanText(getTag(block, ["name"]));
    const guid = cleanText(getTag(block, ["guid", "id"])) || `${feedUrl}#${index}`;
    const content = extractContent(contentHtml, blockHtml, link || feedLink || feedUrl);
    return { id: stableId(`${feedUrl}-${guid}-${index}`), feedTitle, feedLink, member: author || feedTitle, title, link, published, contentText: content.contentText, contentTextMarked: content.contentTextMarked, contentBlocks: content.blocks, image: content.images[0]?.url || "", images: content.images, sourceUrl: feedUrl };
  });
  return { feed: { title: feedTitle, link: feedLink, url: feedUrl }, entries };
}
function firstBlock(xml, tag) { return blocks(xml, tag)[0] || ""; }
function blocks(xml, tag) { const escaped = escapeRegExp(tag); return xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escaped}>`, "gi")) || []; }
function getTag(xml, names) { for (const name of names) { const escaped = escapeRegExp(name); const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i")); if (match) return unwrapXml(match[1]); } return ""; }
function atomLink(xml) { const links = [...xml.matchAll(/<link\b([^>]*)\/?\s*>/gi)]; const alt = links.find((m) => /rel=["']alternate["']/i.test(m[1])) || links[0]; if (!alt) return ""; const href = alt[1].match(/\bhref=["']([^"']+)["']/i); return href ? decodeEntities(href[1]) : ""; }
function extractContent(content, block, baseUrl) {
  const images = []; const seen = new Map(); const contentBlocks = []; const html = String(content || ""); let cursor = 0;
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) { pushTextBlock(contentBlocks, html.slice(cursor, match.index)); const attrs = parseAttrs(match[1]); const src = attrs.src || attrs["data-src"] || attrs["data-original"] || attrs["data-lazy-src"] || firstSrcset(attrs.srcset); const image = addImage(images, seen, src, attrs.alt || "", baseUrl); if (image) contentBlocks.push({ type: "image", imageIndex: images.indexOf(image), marker: image.marker }); cursor = match.index + match[0].length; }
  pushTextBlock(contentBlocks, html.slice(cursor));
  for (const match of String(block || "").matchAll(/<(?:media:content|media:thumbnail|enclosure)\b([^>]*)>/gi)) { const attrs = parseAttrs(match[1]); const type = String(attrs.type || "").toLowerCase(); if (!attrs.url || (type && !type.startsWith("image/"))) continue; const image = addImage(images, seen, attrs.url, attrs.title || attrs.alt || "", baseUrl); if (image && !contentBlocks.some((b) => b.type === "image" && b.marker === image.marker)) contentBlocks.push({ type: "image", imageIndex: images.indexOf(image), marker: image.marker }); }
  const trimmed = contentBlocks.filter((b) => b.type === "image" || b.text);
  return { images: images.slice(0, 12), blocks: trimmed, contentText: trimmed.filter((b) => b.type === "text").map((b) => b.text).join("\n\n"), contentTextMarked: trimmed.map((b) => b.type === "image" ? b.marker : b.text).join("\n\n") };
}
function pushTextBlock(list, html) { const text = htmlToText(html); if (!text) return; for (const p of text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) list.push({ type: "text", text: p }); }
function addImage(images, seen, value, alt, baseUrl) { const url = resolveImage(value, baseUrl); if (!url) return null; if (seen.has(url)) return seen.get(url); if (images.length >= 12) return null; const image = { url, proxyUrl: `/api/proxy-image?url=${encodeURIComponent(url)}`, alt: cleanText(alt || ""), marker: `[IMAGE_${images.length + 1}]` }; seen.set(url, image); images.push(image); return image; }
function parseAttrs(value) { const attrs = {}; const pattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g; for (const m of String(value || "").matchAll(pattern)) attrs[m[1].toLowerCase()] = decodeEntities(m[2] || m[3] || m[4] || ""); return attrs; }
function firstSrcset(value) { const first = String(value || "").split(",")[0]?.trim(); return first ? first.split(/\s+/)[0] : ""; }
function resolveImage(value, baseUrl) { const src = decodeEntities(String(value || "").trim()); if (!src || src.startsWith("data:")) return ""; try { const url = new URL(src, baseUrl); return ["http:", "https:"].includes(url.protocol) ? url.toString() : ""; } catch { return ""; } }
function htmlToText(value) { return decodeEntities(unwrapXml(value)).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n").replace(/<li[^>]*>/gi, "・").replace(/<[^>]+>/g, "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").split("\n").map((line) => line.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim(); }
function unwrapXml(value) { return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim(); }
function cleanText(value) { return htmlToText(value).replace(/\s+/g, " ").trim(); }
function decodeEntities(value) { return String(value || "").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&([a-z]+);/gi, (m, name) => named[name] || m); }
function stableId(value) { let hash = 0; for (let i = 0; i < value.length; i++) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0; return `post-${Math.abs(hash).toString(36)}`; }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
