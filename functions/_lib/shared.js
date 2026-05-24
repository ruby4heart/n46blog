const MAX_RSS_BYTES = 5_000_000;

export const DEFAULT_MODEL = "gpt-5.4-mini";
export const DEFAULT_PROVIDER = "openai";
export const PROVIDERS = {
  openai: {
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: DEFAULT_MODEL
  },
  gemini: {
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "gemini-2.5-flash",
    chatCompletionsUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
  },
  deepseek: {
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-v4-flash",
    chatCompletionsUrl: "https://api.deepseek.com/chat/completions"
  }
};

export const NOGIZAKA_TERM_GUIDE = `
乃木坂46博客翻译术语规则：
1. 人名、歌曲名、演唱会标题、节目名可以保留日文原文；不要强行翻译成员姓名和歌曲名。
2. 组合/饭圈专有名词按下列固定译名处理；首次出现可写成“中文译名（日文原词）”，之后用中文译名或原词均可，保持自然。
3. 不要把“ミグリ”“リアルミグリ”“バスラ”“アンダーライブ”“乃木坂工事中”等误译成普通词。

核心互动：ミグリ=线上见面会；リアルミグリ=线下见面会；部=部/场次；枚数=券数；まとめ出し=叠券；鍵閉め=键闭；認知=认知；連番=连番；レポ=repo/互动报告。
成员层级：表題曲=表题曲；選抜=选拔；アンダー=Under；アンダーライブ=Under Live；福神=福神；センター=Center/C位；期別=期别；キャプテン=队长。
现场文化：OVERTURE 保留英文；真夏の全国ツアー/全ツ=真夏的全国巡演/全巡；神宮=神宫/明治神宫野球场；バスラ=生日演唱会；BIRTHDAY LIVE 保留英文；卒コン=毕业演唱会；サイリウムカラー=推色；推しメンマフラータオル=推巾；影ナレ=影播；座長=座长。
周边生态：生写真=生写真；コンプ=核心套/Complete；ヨリ=近景；チュウ=中景；ヒキ=远景；座り=坐姿；壁=靠墙；祝花/フラスタ=祝花/花篮；界隈=界隈/粉丝圈。
粉丝黑话：箱推=箱推/全团推；単推=单推；推し=推；神推し=神推；DD=DD；釣り師=钓师；塩対応=盐对应；卒業=毕业。
节目企划：乃木坂工事中/乃木中/乃木工=《乃木坂工事中》；バナナマン=香蕉人；ヒット祈願=祈愿/大卖祈愿；16人のプリンシパル=十六人的主角；定点カメラ=定点相机；モバメ=Mail/モバメ；メッセージ=Message。
`;

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function normalizeHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw Object.assign(new Error("请输入有效的 RSS 链接。"), { statusCode: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw Object.assign(new Error("链接必须以 http 或 https 开头。"), { statusCode: 400 });
  }
  return parsed.toString();
}

export function sanitizeProvider(value) {
  const provider = String(value || DEFAULT_PROVIDER).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PROVIDERS, provider) ? provider : DEFAULT_PROVIDER;
}

export function publicProviders() {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([key, provider]) => [
    key,
    {
      label: provider.label,
      defaultModel: provider.defaultModel
    }
  ]));
}

export function sanitizeModel(value, fallback = DEFAULT_MODEL) {
  const model = String(value || fallback).trim();
  return /^[a-zA-Z0-9._:-]+$/.test(model) ? model : fallback;
}

export async function fetchTextWithLimit(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NogizakaBlogRSSStudio/1.0 (+https://pages.cloudflare.com)",
      "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"
    }
  });

  if (!response.ok) {
    throw Object.assign(new Error(`RSS 请求失败：${response.status}`), { statusCode: 502 });
  }

  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RSS_BYTES) {
    throw Object.assign(new Error("RSS 内容过大。"), { statusCode: 413 });
  }
  return text;
}

export function parseFeed(xml, feedUrl, limit) {
  const channel = firstBlock(xml, "channel") || xml;
  const feedTitle = cleanText(getTag(channel, ["title"]) || "RSS Feed");
  const feedLink = cleanText(getTag(channel, ["link"])) || feedUrl;
  const itemBlocks = blocks(xml, "item");
  const atomBlocks = itemBlocks.length ? [] : blocks(xml, "entry");
  const sourceBlocks = itemBlocks.length ? itemBlocks : atomBlocks;

  const entries = sourceBlocks.slice(0, limit).map((block, index) => {
    const rawContent = getTag(block, ["content:encoded", "content", "description", "summary"]) || "";
    const imageContent = decodeEntities(rawContent);
    const imageBlock = decodeEntities(block);
    const title = cleanText(getTag(block, ["title"]) || "Untitled");
    const link = cleanText(getTag(block, ["link"])) || atomLink(block) || feedLink;
    const published = cleanText(getTag(block, ["pubDate", "published", "updated", "dc:date"]));
    const author = cleanText(getTag(block, ["dc:creator", "creator", "author"])) || cleanText(getTag(block, ["name"]));
    const guid = cleanText(getTag(block, ["guid", "id"])) || `${feedUrl}#${index}`;
    const content = extractContent(imageContent, imageBlock, link || feedLink || feedUrl);

    return {
      id: stableId(`${feedUrl}-${guid}-${index}`),
      feedTitle,
      feedLink,
      member: author || feedTitle,
      title,
      link,
      published,
      contentText: content.contentText,
      contentTextMarked: content.contentTextMarked,
      contentBlocks: content.blocks,
      image: content.images[0]?.url || "",
      images: content.images,
      sourceUrl: feedUrl
    };
  });

  return { feed: { title: feedTitle, link: feedLink, url: feedUrl }, entries };
}

function firstBlock(xml, tag) {
  return blocks(xml, tag)[0] || "";
}

function blocks(xml, tag) {
  const escaped = escapeRegExp(tag);
  const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${escaped}>`, "gi");
  return xml.match(pattern) || [];
}

function getTag(xml, names) {
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const pattern = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
    const found = xml.match(pattern);
    if (found) return unwrapXml(found[1]);
  }
  return "";
}

function atomLink(xml) {
  const links = [...xml.matchAll(/<link\b([^>]*)\/?>/gi)];
  const alternate = links.find((link) => /rel=["']alternate["']/i.test(link[1])) || links[0];
  if (!alternate) return "";
  const href = alternate[1].match(/\bhref=["']([^"']+)["']/i);
  return href ? decodeEntities(href[1]) : "";
}

function extractContent(content, block, baseUrl) {
  const images = [];
  const seen = new Map();
  const contentBlocks = [];
  const html = String(content || "");
  let cursor = 0;

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    pushTextBlock(contentBlocks, html.slice(cursor, match.index));
    const attrs = parseAttributes(match[1]);
    const src = attrs.src || attrs["data-src"] || attrs["data-original"] || attrs["data-lazy-src"] || firstSrcsetUrl(attrs.srcset);
    const image = addImage(images, seen, src, attrs.alt || "", baseUrl);
    if (image) contentBlocks.push({ type: "image", imageIndex: images.indexOf(image), marker: image.marker });
    cursor = match.index + match[0].length;
  }
  pushTextBlock(contentBlocks, html.slice(cursor));

  for (const match of String(block || "").matchAll(/<(?:media:content|media:thumbnail|enclosure)\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const type = String(attrs.type || "").toLowerCase();
    if (!attrs.url || (type && !type.startsWith("image/"))) continue;
    const image = addImage(images, seen, attrs.url, attrs.title || attrs.alt || "", baseUrl);
    if (image && !contentBlocks.some((item) => item.type === "image" && item.marker === image.marker)) {
      contentBlocks.push({ type: "image", imageIndex: images.indexOf(image), marker: image.marker });
    }
  }

  const trimmedBlocks = contentBlocks.filter((item) => item.type === "image" || item.text);
  return {
    images: images.slice(0, 12),
    blocks: trimmedBlocks,
    contentText: trimmedBlocks.filter((item) => item.type === "text").map((item) => item.text).join("\n\n"),
    contentTextMarked: trimmedBlocks.map((item) => (item.type === "image" ? item.marker : item.text)).join("\n\n")
  };
}

function pushTextBlock(blocks, html) {
  const text = htmlToText(html);
  if (!text) return;
  for (const paragraph of text.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean)) {
    blocks.push({ type: "text", text: paragraph });
  }
}

function htmlToText(value) {
  return decodeEntities(unwrapXml(value))
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "・")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function addImage(images, seen, value, alt, baseUrl) {
  const url = resolveImageUrl(value, baseUrl);
  if (!url) return null;
  if (seen.has(url)) return seen.get(url);
  if (images.length >= 12) return null;
  const image = {
    url,
    proxyUrl: `/api/proxy-image?url=${encodeURIComponent(url)}`,
    alt: cleanText(alt || ""),
    marker: `[IMAGE_${images.length + 1}]`
  };
  seen.set(url, image);
  images.push(image);
  return image;
}

function parseAttributes(value) {
  const attrs = {};
  const pattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of String(value || "").matchAll(pattern)) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] || match[3] || match[4] || "");
  }
  return attrs;
}

function firstSrcsetUrl(value) {
  const first = String(value || "").split(",")[0]?.trim();
  return first ? first.split(/\s+/)[0] : "";
}

function resolveImageUrl(value, baseUrl) {
  const src = decodeEntities(String(value || "").trim());
  if (!src || src.startsWith("data:")) return "";
  try {
    const url = new URL(src, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanText(value) {
  return htmlToText(value).replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name] || match);
}

function unwrapXml(value) {
  return String(value || "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function stableId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return `post-${Math.abs(hash).toString(36)}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
