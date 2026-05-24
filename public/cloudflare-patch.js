(() => {
  const DEFAULT_RSS_URL = "https://rsshub.yuk15n0w.asia/nogizaka46/blog";
  const LOCAL_STORAGE_KEY = "nogizaka-blog-studio-local-v1";
  const PROVIDER_MODELS = {
    openai: "gpt-5.4-mini",
    gemini: "gemini-2.5-flash",
    deepseek: "deepseek-chat"
  };

  const $ = (id) => document.getElementById(id);

  function boot() {
    const rss = $("rssUrls");
    const apiKey = $("apiKey");
    const provider = $("provider");
    const model = $("model");
    const clear = $("clearLocalButton");
    if (!rss || !apiKey || !provider || !model) return;

    loadDraft(rss, apiKey, provider, model);
    bindDraft(rss, apiKey, provider, model, clear);
    patchTranslateFetch(provider, apiKey);
    patchOfficialTitleRow();
    patchCanvasRenderer();

    window.setTimeout(() => {
      restoreProviderModel(provider, model);
      if (!rss.value.trim()) rss.value = DEFAULT_RSS_URL;
      const count = Number(($("entryCount")?.textContent || "0").trim());
      if (!count) {
        if (typeof window.fetchFeeds === "function") window.fetchFeeds({ silentIfEmpty: true });
        else $("fetchButton")?.click();
      }
    }, 260);
  }

  function restoreProviderModel(provider, model) {
    if (model.dataset.touched === "true") return;
    try {
      const draft = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
      model.value = typeof draft.model === "string" && draft.model.trim()
        ? draft.model
        : PROVIDER_MODELS[provider.value] || PROVIDER_MODELS.openai;
    } catch {
      model.value = PROVIDER_MODELS[provider.value] || PROVIDER_MODELS.openai;
    }
  }

  function loadDraft(rss, apiKey, provider, model) {
    try {
      const draft = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
      rss.value = typeof draft.rssUrls === "string" && draft.rssUrls.trim() ? draft.rssUrls : DEFAULT_RSS_URL;
      apiKey.value = typeof draft.apiKey === "string" ? draft.apiKey : "";
      provider.value = PROVIDER_MODELS[draft.provider] ? draft.provider : "openai";
      model.value = typeof draft.model === "string" && draft.model.trim() ? draft.model : PROVIDER_MODELS[provider.value];
    } catch {
      rss.value = DEFAULT_RSS_URL;
      provider.value = "openai";
      model.value = PROVIDER_MODELS.openai;
    }
  }

  function bindDraft(rss, apiKey, provider, model, clear) {
    const save = () => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
          rssUrls: rss.value,
          apiKey: apiKey.value,
          provider: provider.value,
          model: model.value
        }));
      } catch {}
    };
    rss.addEventListener("input", save);
    apiKey.addEventListener("input", save);
    model.addEventListener("input", () => {
      model.dataset.touched = "true";
      save();
    });
    provider.addEventListener("change", () => {
      if (model.dataset.touched !== "true") model.value = PROVIDER_MODELS[provider.value] || PROVIDER_MODELS.openai;
      save();
    });
    clear?.addEventListener("click", () => {
      try { localStorage.removeItem(LOCAL_STORAGE_KEY); } catch {}
      rss.value = DEFAULT_RSS_URL;
      apiKey.value = "";
      provider.value = "openai";
      model.value = PROVIDER_MODELS.openai;
      model.dataset.touched = "";
      setStatus("本地记录已清除，RSS 已恢复默认。");
    });
  }

  function patchTranslateFetch(provider, apiKey) {
    if (window.__n46ProviderFetchPatched) return;
    window.__n46ProviderFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url || "";
      if (url.includes("/api/translate") && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          body.provider = provider.value || "openai";
          const headers = new Headers(init.headers || {});
          const key = apiKey.value.trim();
          if (key) headers.set("x-provider-api-key", key);
          headers.set("x-ai-provider", body.provider);
          return nativeFetch(input, { ...init, headers, body: JSON.stringify(body) });
        } catch {}
      }
      return nativeFetch(input, init);
    };
  }

  function patchOfficialTitleRow() {
    const card = $("previewCard");
    if (!card) return;
    const enhance = () => {
      softenSupportColors();
      const row = card.querySelector(".theme-official .blog-title-row, .blog-card.theme-official .blog-title-row");
      if (!row || row.querySelector(".blog-share")) return;
      const title = row.querySelector(".blog-title");
      const date = row.querySelector(".blog-date");
      if (!title || !date) return;
      const meta = document.createElement("div");
      meta.className = "blog-title-meta";
      row.insertBefore(meta, title);
      meta.append(title, date);
      const share = document.createElement("span");
      share.className = "blog-share";
      share.setAttribute("aria-hidden", "true");
      share.innerHTML = "<i></i><i></i><i></i>";
      row.append(share);
    };
    new MutationObserver(enhance).observe(card, { childList: true, subtree: true });
    enhance();
  }

  function softenSupportColors() {
    const card = $("previewCard");
    if (!card) return;
    const styles = getComputedStyle(card);
    const colorA = styles.getPropertyValue("--member-a").trim() || "#b447c8";
    const colorB = styles.getPropertyValue("--member-b").trim() || "#7f2aa5";
    card.style.setProperty("--member-soft-a", rgbaSafe(colorA, 0.055));
    card.style.setProperty("--member-soft-b", rgbaSafe(colorB, 0.055));
    card.style.setProperty("--member-mid-a", rgbaSafe(colorA, 0.14));
    card.style.setProperty("--member-mid-b", rgbaSafe(colorB, 0.14));
  }

  function patchCanvasRenderer() {
    const patched = async function renderCanvasPatched(post) {
      const s = call("settings", { bodyFontSize: 20, bodyLineHeight: 1.85, paragraphGap: 34 });
      const size = call("canvasSize", { w: 1200, h: 1800 });
      const w = size.w;
      const pad = 96;
      const bodyW = w - pad * 2;
      const theme = call("themeFor", { a: "#b447c8", b: "#7f2aa5" }, post.member, post.profile);
      const blocks = Array.isArray(post.blocks) ? post.blocks : [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = w;

      ctx.font = fontFor(64, 500, true);
      const titleLines = wrapText(ctx, post.title || "", bodyW - 190);
      const bandTop = 190;
      const bandHeight = Math.max(230, 164 + titleLines.length * 74);
      const bandBottom = bandTop + bandHeight;
      const measured = [];
      let height = bandBottom + 110;
      let imageCount = 0;
      for (const block of blocks) {
        if (block.type === "image") {
          imageCount += 1;
          height += Math.min(680, Math.round(w * 0.56)) + 42;
        } else {
          ctx.font = fontFor(s.bodyFontSize * 1.5, 600);
          const lines = wrapText(ctx, block.text || "", bodyW);
          measured.push(lines);
          height += lines.length * s.bodyFontSize * s.bodyLineHeight * 1.5 + s.paragraphGap * 1.5;
        }
      }
      canvas.height = Math.max(size.h, height + 120);

      const gradient = ctx.createLinearGradient(0, 0, w, canvas.height);
      gradient.addColorStop(0, rgbaSafe(theme.a, 0.018));
      gradient.addColorStop(0.46, "#ffffff");
      gradient.addColorStop(1, rgbaSafe(theme.b, 0.018));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, bandTop);
      ctx.fillStyle = "#f7f7f8";
      ctx.fillRect(0, bandTop, w, bandHeight);
      ctx.fillStyle = theme.a || "#b447c8";
      ctx.fillRect(0, 0, w, 5);

      ctx.textAlign = "center";
      ctx.fillStyle = theme.a || "#b447c8";
      ctx.font = fontFor(24, 700, true);
      ctx.fillText(post.roman || "Nogizaka46", w / 2, 94);
      ctx.font = fontFor(40, 700, true);
      ctx.fillText(post.member || "乃木坂46", w / 2, 140);

      ctx.textAlign = "left";
      ctx.fillStyle = theme.a || "#b447c8";
      ctx.font = fontFor(64, 500, true);
      const titleY = bandTop + 82;
      titleLines.forEach((line, index) => ctx.fillText(line, pad, titleY + index * 74));
      const dateY = titleY + titleLines.length * 74 + 34;
      ctx.fillStyle = "#8f93a3";
      ctx.font = fontFor(24, 600);
      ctx.fillText(formatDate(post.published), pad, dateY);
      ctx.fillStyle = "#70798b";
      ctx.fillText(post.feedTitle || "乃木坂46 Blog", pad, dateY + 42);
      drawShare(ctx, w - pad - 44, bandTop + bandHeight / 2 - 22);

      const imageBlocks = blocks.filter((block) => block.type === "image").map((block) => block.image);
      const images = typeof window.loadImages === "function" ? await window.loadImages(imageBlocks) : [];
      let y = bandBottom + 78;
      let textIndex = 0;
      let imageIndex = 0;
      ctx.textAlign = "left";
      ctx.fillStyle = "#1f2a42";
      ctx.font = fontFor(s.bodyFontSize * 1.5, 600);
      for (const block of blocks) {
        if (block.type === "image") {
          const img = images[imageIndex++];
          if (img) {
            const boxH = Math.min(680, Math.round(w * 0.56));
            drawContain(ctx, img, pad, y, bodyW, boxH);
            y += boxH + 42;
          }
          continue;
        }
        const lines = measured[textIndex++] || [];
        for (const line of lines) {
          ctx.fillText(line, pad, y);
          y += s.bodyFontSize * s.bodyLineHeight * 1.5;
        }
        y += s.paragraphGap * 1.5;
      }
      if (!imageCount && !blocks.length) {
        ctx.fillText("", pad, y);
      }
      return canvas;
    };

    window.renderCanvas = patched;
    try { renderCanvas = patched; } catch {}
  }

  function call(name, fallback, ...args) {
    return typeof window[name] === "function" ? window[name](...args) : fallback;
  }

  function wrapText(ctx, text, maxWidth) {
    if (typeof window.wrap === "function") return window.wrap(ctx, text, maxWidth);
    const out = [];
    for (const paragraph of String(text || "").split(/\r?\n/)) {
      let line = "";
      for (const ch of Array.from(paragraph)) {
        const next = line + ch;
        if (line && ctx.measureText(next).width > maxWidth) {
          out.push(line);
          line = ch;
        } else {
          line = next;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }

  function drawContain(ctx, img, x, y, w, h) {
    if (typeof window.drawImageContain === "function") return window.drawImageContain(ctx, img, x, y, w, h);
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawShare(ctx, x, y) {
    ctx.save();
    ctx.strokeStyle = "#d9dce4";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.arc(x + 22, y + 22, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#4c5260";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 17, y + 22);
    ctx.lineTo(x + 30, y + 15);
    ctx.moveTo(x + 17, y + 22);
    ctx.lineTo(x + 30, y + 29);
    ctx.stroke();
    ctx.fillStyle = "#4c5260";
    for (const [px, py] of [[15, 22], [31, 14], [31, 30]]) {
      ctx.beginPath();
      ctx.arc(x + px, y + py, 3.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function fontFor(size, weight = 500, serif = false) {
    if (typeof window.font === "function") return window.font(size, weight, serif);
    return `${weight} ${size}px ${serif ? "Georgia, 'Times New Roman', 'Noto Serif SC', serif" : "'Noto Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', sans-serif"}`;
  }

  function rgbaSafe(hex, alpha) {
    if (typeof window.rgba === "function") return window.rgba(hex, alpha);
    const value = String(hex || "#000000").replace("#", "").padEnd(6, "0").slice(0, 6);
    const number = Number.parseInt(value, 16);
    return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
  }

  function formatDate(value) {
    if (typeof window.formatDateTime === "function") return window.formatDateTime(value);
    if (!value) return "未注明日期";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replace(/\//g, ".");
  }

  function setStatus(message, isError = false) {
    const status = $("status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
