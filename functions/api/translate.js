import { DEFAULT_PROVIDER, NOGIZAKA_TERM_GUIDE, PROVIDERS, json, sanitizeModel, sanitizeProvider } from "../_lib/shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const providerKey = sanitizeProvider(body.provider || request.headers.get("x-ai-provider") || DEFAULT_PROVIDER);
    const provider = PROVIDERS[providerKey];
    const apiKey = request.headers.get("x-provider-api-key") || request.headers.get("x-openai-api-key") || "";
    if (!apiKey) {
      return json({ error: `缺少 ${provider.label} API Key。请在页面里填入你自己的 Key。` }, 400);
    }

    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!entries.length) return json({ error: "没有可翻译的博客条目。" }, 400);

    const model = sanitizeModel(body.model || provider.defaultModel, provider.defaultModel);
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
      "保留成员第一人称、轻松语气、颜文字和 emoji；专有名词、人名、组合名可保留原文或采用常见中文写法。",
      "正文按适合图片排版的短段落输出，段落之间用换行分隔。",
      "如果正文中出现 [IMAGE_1]、[IMAGE_2] 这样的图片占位符，必须原样保留在相同语义位置，并让它们单独成行。",
      "如果原文很短，不要强行扩写。",
      NOGIZAKA_TERM_GUIDE
    ].join("\n");

    const systemPrompt = `${instructions}\n\n只输出一个 JSON 对象，结构必须是 {"posts":[{"id":"...","member":"...","titleZh":"...","bodyZh":"..."}]}。不要输出 Markdown。`;
    const input = JSON.stringify({ targetLanguage, toneStyle, posts });
    const response = providerKey === "openai"
      ? await callOpenAiResponses(apiKey, model, systemPrompt, input)
      : await callChatCompletions(provider, apiKey, model, systemPrompt, input);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ error: data.error?.message || `${provider.label} API 请求失败：${response.status}` }, response.status);
    }

    const outputText = providerKey === "openai" ? extractOutputText(data) : extractChatOutputText(data);
    const parsed = JSON.parse(extractJsonObject(outputText));
    return json({
      provider: providerKey,
      model: data.model || model,
      usage: data.usage || null,
      posts: Array.isArray(parsed.posts) ? parsed.posts : []
    });
  } catch (error) {
    return json({ error: error.message || "翻译请求失败。" }, error.statusCode || 500);
  }
}

function callOpenAiResponses(apiKey, model, instructions, input) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
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
    })
  });
}

function callChatCompletions(provider, apiKey, model, systemPrompt, userPayload) {
  return fetch(provider.chatCompletionsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload }
      ],
      temperature: 0.2,
      max_tokens: 12000
    })
  });
}

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
      if (typeof content.output_text === "string") chunks.push(content.output_text);
    }
  }
  return chunks.join("");
}

function extractChatOutputText(data) {
  return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "";
}

function extractJsonObject(text) {
  const value = String(text || "").trim();
  if (value.startsWith("{") && value.endsWith("}")) return value;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) return value.slice(start, end + 1);
  return value;
}
