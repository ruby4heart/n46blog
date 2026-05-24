import { DEFAULT_MODEL, NOGIZAKA_TERM_GUIDE, json, sanitizeModel } from "../_lib/shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const apiKey = request.headers.get("x-openai-api-key") || env.OPENAI_API_KEY;
    if (!apiKey) return json({ error: "缺少 OpenAI API Key。可以在 Cloudflare Pages 环境变量设置 OPENAI_API_KEY，或在页面里填入本次会话 Key。" }, 400);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!entries.length) return json({ error: "没有可翻译的博客条目。" }, 400);

    const model = sanitizeModel(body.model || DEFAULT_MODEL);
    const targetLanguage = String(body.targetLanguage || "简体中文").slice(0, 40);
    const toneStyle = String(body.toneStyle || "自然、亲切、忠实").slice(0, 80);
    const posts = entries.slice(0, 12).map((entry, index) => ({
      id: String(entry.id || `entry-${index}`),
      member: String(entry.member || entry.feedTitle || "乃木坂46").slice(0, 80),
      title: String(entry.title || "").slice(0, 300),
      published: String(entry.published || "").slice(0, 80),
      body: String(entry.contentTextMarked || entry.contentText || entry.summary || "").slice(0, 9000),
      sourceUrl: String(entry.link || "").slice(0, 500)
    }));

    const instructions = [
      "你是面向中文读者的日文偶像博客翻译编辑。",
      "把日文博客忠实翻译成自然的中文，不杜撰原文没有的信息。",
      "保留成员第一人称、轻松语气、颜文字和 emoji；歌曲名、人名、组合名和演唱会名可以保留日文原文。",
      "正文按适合图片排版的短段落输出，段落之间用换行分隔。",
      "如果正文中出现 [IMAGE_1]、[IMAGE_2] 这样的图片占位符，必须原样保留在相同语义位置，并让它们单独成行。",
      "不要输出 AI 总结，不要输出 tag。",
      NOGIZAKA_TERM_GUIDE
    ].join("\n");

    const payload = {
      model,
      instructions,
      input: JSON.stringify({ targetLanguage, toneStyle, posts }),
      text: {
        format: {
          type: "json_schema",
          name: "blog_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              posts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    member: { type: "string" },
                    titleZh: { type: "string" },
                    bodyZh: { type: "string" }
                  },
                  required: ["id", "member", "titleZh", "bodyZh"]
                }
              }
            },
            required: ["posts"]
          }
        }
      },
      max_output_tokens: 12000
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: data.error?.message || `OpenAI API 请求失败：${response.status}` }, response.status);
    const parsed = JSON.parse(extractOutputText(data));
    return json({ model: data.model || model, usage: data.usage || null, posts: Array.isArray(parsed.posts) ? parsed.posts : [] });
  } catch (error) {
    return json({ error: error.message || "翻译请求失败。" }, error.statusCode || 500);
  }
}
function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) for (const content of item.content || []) {
    if (typeof content.text === "string") chunks.push(content.text);
    if (typeof content.output_text === "string") chunks.push(content.output_text);
  }
  return chunks.join("");
}
