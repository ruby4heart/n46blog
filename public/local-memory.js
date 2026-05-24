(() => {
  const key = "nogizaka-blog-studio-local-v1";

  function boot() {
    const rssUrls = document.querySelector("#rssUrls");
    const apiKey = document.querySelector("#apiKey");
    const clearButton = document.querySelector("#clearLocalButton");
    if (!rssUrls || !apiKey) return;

    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.rssUrls === "string") rssUrls.value = draft.rssUrls;
        if (typeof draft.apiKey === "string") apiKey.value = draft.apiKey;
      }
    } catch {
      localStorage.removeItem(key);
    }

    const save = () => {
      try {
        const draft = { rssUrls: rssUrls.value, apiKey: apiKey.value };
        if (!draft.rssUrls.trim() && !draft.apiKey.trim()) {
          localStorage.removeItem(key);
          return;
        }
        localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        setStatus("浏览器阻止了本地保存。", true);
      }
    };

    rssUrls.addEventListener("input", save);
    apiKey.addEventListener("input", save);
    clearButton?.addEventListener("click", () => {
      try { localStorage.removeItem(key); } catch {}
      rssUrls.value = "";
      apiKey.value = "";
      setStatus("本地记录已清除。");
    });
  }

  function setStatus(message, isError = false) {
    const status = document.querySelector("#status");
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
