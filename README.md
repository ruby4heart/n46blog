# 乃木坂 Blog RSS Studio

抓取乃木坂46成员博客 RSS，调用 OpenAI API 翻译成中文，保留正文图片位置，并把排版后的文章导出为 PNG 图片。

## Cloudflare Pages

把这个仓库连接到 Cloudflare Pages 后推荐这样设置：

- Framework preset：`None`
- Build command：留空
- Build output directory：`public`
- Environment variables：添加 `OPENAI_API_KEY`

仓库里的 `functions/api/*` 会在 Pages 上提供 RSS 抓取、图片代理和翻译接口；静态页面会从 `public` 目录发布。

## API Key

可以在 Cloudflare Pages 环境变量里设置 `OPENAI_API_KEY`，也可以直接在网页左侧的 `OpenAI API Key` 输入框填入本次会话使用的 Key。

## 功能

- 支持多条 RSS 链接，每行一个。
- 自动提取博客正文图片，并保留在 RSS 正文里的原始位置。
- 使用 OpenAI Responses API 翻译，并用 JSON Schema 约束输出。
- 翻译后可直接在预览里修改标题和正文。
- 可调节正文的字号、行距、段距，以及罗马音注音的显示、大小和透明度。
- 识别成员罗马音和应援色，并把应援色作为低透明背景渐变。
- 支持当前文章导出或批量导出 PNG。
