# 乃木坂 Blog RSS Studio

抓取乃木坂46成员博客 RSS，调用 OpenAI / Gemini / DeepSeek 翻译成中文，保留正文图片位置，并把排版后的文章导出为 PNG 图片。

## Cloudflare Pages

把这个仓库连接到 Cloudflare Pages 后推荐这样设置：

- Framework preset：`None`
- Build command：留空
- Build output directory：`public`

仓库里的 `functions/api/*` 会在 Pages 上提供 RSS 抓取、图片代理和翻译接口；静态页面会从 `public` 目录发布。页面默认使用：

```text
https://rsshub.yuk15n0w.asia/nogizaka46/blog
```

## API Key

每个访问者在网页左侧选择翻译服务并填入自己的 API Key。Key 只保存在访问者自己的浏览器 localStorage 中，翻译请求时通过请求头发送，不会写入仓库，也不会被 Cloudflare Functions 持久化。

默认模型可在页面里修改：

- OpenAI / ChatGPT：`gpt-5.4-mini`
- Gemini：`gemini-2.5-flash`
- DeepSeek：`deepseek-chat`

## 功能

- 默认自动抓取乃木坂46博客 RSS，也支持手动替换 RSS 链接。
- 自动提取博客正文图片，并保留在 RSS 正文里的原始位置。
- 支持 OpenAI Responses API，以及 Gemini / DeepSeek 的 OpenAI-compatible Chat Completions API。
- 翻译后可直接在预览里修改标题和正文。
- 可调节正文的字号、行距、段距，以及罗马音注音的显示、大小和透明度。
- 识别成员罗马音和应援色，并把应援色作为低透明背景渐变。
- 官网风格模板保留灰色标题时间区域，导出的 PNG 也使用同一类标题区。
