const state = { feeds: [], entries: [], selectedId: null, hasServerKey: false, defaultModel: "gpt-5.4-mini" };

const $ = (id) => document.getElementById(id);
const els = {
  rssUrls: $("rssUrls"), entryLimit: $("entryLimit"), targetLanguage: $("targetLanguage"), apiKey: $("apiKey"),
  model: $("model"), toneStyle: $("toneStyle"), theme: $("theme"), imageSize: $("imageSize"),
  fetchButton: $("fetchButton"), translateButton: $("translateButton"), downloadButton: $("downloadButton"), downloadAllButton: $("downloadAllButton"),
  status: $("status"), entryCount: $("entryCount"), feedChips: $("feedChips"), entryList: $("entryList"),
  previewCard: $("previewCard"), previewTitle: $("previewTitle"), sourceLink: $("sourceLink"),
  bodyFontSize: $("bodyFontSize"), bodyFontSizeValue: $("bodyFontSizeValue"), bodyLineHeight: $("bodyLineHeight"), bodyLineHeightValue: $("bodyLineHeightValue"),
  paragraphGap: $("paragraphGap"), paragraphGapValue: $("paragraphGapValue"), rubyMode: $("rubyMode"), rubySize: $("rubySize"), rubySizeValue: $("rubySizeValue"), rubyOpacity: $("rubyOpacity"), rubyOpacityValue: $("rubyOpacityValue")
};

const colors = { "白":"#ffffff", "オレンジ":"#f28a24", "青":"#2f66d8", "黄":"#f4d23a", "紫":"#7f2aa5", "紫色":"#7f2aa5", "緑":"#22a65d", "ピンク":"#f06aa7", "赤":"#df3f45", "水色":"#5bc8ee", "黄緑":"#9bd84a", "ターコイズ":"#28bfc3" };
const members = [
  ["伊藤理々杏","Ito Riria","紫","赤"],["岩本蓮加","Iwamoto Renka","赤","ピンク"],["梅澤美波","Umezawa Minami","青","水色"],["吉田綾乃クリスティー","Yoshida Ayano Christie","ピンク","紫"],
  ["遠藤さくら","Endo Sakura","ピンク","白"],["賀喜遥香","Kaki Haruka","オレンジ","緑"],["金川紗耶","Kanagawa Saya","水色","赤"],["黒見明香","Kuromi Haruka","紫","緑"],["柴田柚菜","Shibata Yuna","青","黄緑"],["田村真佑","Tamura Mayu","紫","水色"],["筒井あやめ","Tsutsui Ayame","紫","紫色"],["林瑠奈","Hayashi Runa","ピンク","ピンク"],["弓木奈於","Yumiki Nao","赤","黄緑"],
  ["五百城茉央","Ioki Mao","ターコイズ","青"],["池田瑛紗","Ikeda Teresa","緑","白"],["一ノ瀬美空","Ichinose Miku","水色","水色"],["井上和","Inoue Nagi","赤","白"],["岡本姫奈","Okamoto Hina","紫","青"],["小川彩","Ogawa Aya","白","白"],["奥田いろは","Okuda Iroha","黄緑","ピンク"],["川﨑桜","Kawasaki Sakura","ピンク","緑"],["菅原咲月","Sugawara Satsuki","ピンク","水色"],["冨里奈央","Tomisato Nao","ターコイズ","ターコイズ"],["中西アルノ","Nakanishi Aruno","水色","ターコイズ"],
  ["愛宕心響","Atago Kokone","ピンク","青"],["大越ひなの","Okoshi Hinano","白","黄"],["小津玲奈","Ozu Reina","紫","ターコイズ"],["川端晃菜","Kawabata Hina","水色","緑"],["海邉朱莉","Kaibe Akari","青","赤"],["鈴木佑捺","Suzuki Yuna","水色","白"],["瀬戸口心月","Setoguchi Mitsuki","青","黄"],["長嶋凛桜","Nagashima Rio","ピンク","オレンジ"],["増田三莉音","Masuda Mirine","青","青"],["森平麗心","Morihira Urumi","黄","黄"],["矢田萌華","Yada Moeka","白","紫"]
].map(([name, roman, a, b]) => ({ name, key: normalizeName(name), roman, colorNames: [a, b], colors: [colors[a], colors[b]] }));
const rubyTerms = [["リアルミーグリ","real meet"],["バースデーライブ","birthday live"],["東京ドーム","tokyo dome"],["サウナハット","sauna hat"],["イベント","event"],["ライブ","live"],["タイプ","type"],["サウナ","sauna"],["ハット","hat"],["ゲット","get"],["パック","pack"],["ドーム","dome"]].sort((a,b)=>b[0].length-a[0].length);

init();
async function init() {
  bind(); updateControls(); setBusy(false);
  try { const h = await request("/api/health"); state.hasServerKey = h.hasServerKey; state.defaultModel = h.defaultModel || state.defaultModel; els.model.value = state.defaultModel; setStatus(h.hasServerKey ? "已连接服务器 API Key" : "准备就绪"); }
  catch { setStatus("服务器状态不可用", true); }
}
function bind() {
  els.fetchButton.addEventListener("click", fetchFeeds); els.translateButton.addEventListener("click", translateEntries);
  els.downloadButton.addEventListener("click", () => downloadCurrent()); els.downloadAllButton.addEventListener("click", downloadAll);
  [els.theme, els.imageSize, els.bodyFontSize, els.bodyLineHeight, els.paragraphGap, els.rubyMode, els.rubySize, els.rubyOpacity].forEach((el) => { el.addEventListener("input", () => { updateControls(); renderPreview(); }); el.addEventListener("change", () => { updateControls(); renderPreview(); }); });
}
async function fetchFeeds() {
  const urls = els.rssUrls.value.split(/\r?\n/).map((v)=>v.trim()).filter(Boolean);
  if (!urls.length) return setStatus("请先输入 RSS 链接。", true);
  setBusy(true); setStatus("正在抓取 RSS...");
  try {
    const results = [];
    for (const url of urls) results.push(await request("/api/fetch-rss", { method:"POST", body:{ url, limit:Number(els.entryLimit.value || 3) } }));
    state.feeds = results.map((r)=>r.feed); state.entries = results.flatMap((r)=>r.entries).map((e)=>({ ...e, translation:null })); state.selectedId = state.entries[0]?.id || null;
    renderEntries(); renderPreview(); setStatus(`已抓取 ${state.entries.length} 篇博客。`);
  } catch (err) { setStatus(err.message, true); } finally { setBusy(false); }
}
async function translateEntries() {
  if (!state.entries.length) return setStatus("没有可翻译的博客。", true);
  setBusy(true); setStatus("正在调用 ChatGPT 翻译...");
  try {
    const result = await request("/api/translate", { method:"POST", headers: openAiHeaders(), body:{ entries:state.entries, targetLanguage:els.targetLanguage.value, toneStyle:els.toneStyle.value, model:els.model.value } });
    const map = new Map((result.posts || []).map((p)=>[p.id,p]));
    state.entries = state.entries.map((e)=>({ ...e, translation: map.get(e.id) || e.translation }));
    renderEntries(); renderPreview(); setStatus(`翻译完成：${result.posts?.length || 0} 篇。`);
  } catch (err) { setStatus(err.message, true); } finally { setBusy(false); }
}
function renderEntries() {
  els.entryCount.textContent = String(state.entries.length);
  els.feedChips.innerHTML = state.feeds.map((f)=>`<span class="chip">${esc(f.title)}</span>`).join("");
  els.entryList.innerHTML = state.entries.map((e)=>{ const title = e.translation?.titleZh || e.title; const imgs = normImages(e.images || e.image).length; return `<button class="entry-item ${e.id===state.selectedId?"is-selected":""}" data-id="${esc(e.id)}"><span class="entry-title">${esc(title)}</span><span class="entry-meta">${esc(e.member || e.feedTitle)} · ${esc(formatDate(e.published))}${imgs?` · ${imgs} 图`:""}</span></button>`; }).join("");
  els.entryList.querySelectorAll(".entry-item").forEach((btn)=>btn.addEventListener("click",()=>{ state.selectedId=btn.dataset.id; renderEntries(); renderPreview(); }));
}
function renderPreview() {
  const entry = selected(); els.previewCard.className = `blog-card theme-${els.theme.value}`;
  if (!entry) { els.previewTitle.textContent="等待 RSS"; els.sourceLink.href="#"; els.previewCard.innerHTML = `<div class="empty-state"><strong>把 RSS 链接放进左侧</strong><span>抓取后选择文章，翻译完成即可导出图片。</span></div>`; return; }
  const post = viewModel(entry); const theme = themeFor(post.member, post.profile); applyTheme(theme); els.previewTitle.textContent = post.title; els.sourceLink.href = post.link || "#";
  els.previewCard.innerHTML = `<div class="blog-kicker"><span class="blog-roman">${esc(post.roman)}</span><span class="blog-member">${esc(post.member)}</span></div><div class="blog-title-row"><h3 class="blog-title" contenteditable="true" spellcheck="false" data-edit="title">${esc(post.title)}</h3><span class="blog-date">${esc(formatDateTime(post.published))}</span></div><div class="blog-source">${esc(post.feedTitle)}</div><div class="blog-body">${post.blocks.map((b,i)=>renderBlock(b,i)).join("")}</div>`;
  els.previewCard.querySelectorAll("img").forEach((img)=>img.addEventListener("error",()=>img.closest(".blog-photo")?.remove())); bindEditing(entry);
}
function renderBlock(block, index) { if (block.type === "image") return `<figure class="blog-photo"><img src="${esc(imgSrc(block.image))}" alt="${esc(block.image?.alt || "")}"></figure>`; return `<p contenteditable="true" spellcheck="false" data-block="${index}">${rubyHtml(block.text || "")}</p>`; }
function bindEditing(entry) {
  const title = els.previewCard.querySelector("[data-edit='title']");
  title?.addEventListener("blur",()=>{ ensureTranslation(entry).titleZh = clean(title.textContent); renderEntries(); });
  els.previewCard.querySelectorAll("[data-block]").forEach((p)=>{ p.addEventListener("focus",()=>{ p.textContent = p.textContent; }); p.addEventListener("blur",()=>{ const post=viewModel(entry); const idx=Number(p.dataset.block); const text=clean(p.textContent); post.blocks[idx].text=text; ensureTranslation(entry).bodyZh = blocksToText(post.blocks); renderPreview(); }); });
}
function viewModel(entry) {
  const tr = entry.translation || {}; const member = tr.member || entry.member || entry.feedTitle || "乃木坂46"; const profile = findMember(member); const images = normImages(entry.images || entry.image);
  const body = clean(tr.bodyZh || entry.contentTextMarked || entry.contentText || entry.summary || "");
  return { id:entry.id, title:clean(tr.titleZh || entry.title || "Untitled"), member, roman:profile?.roman || "Nogizaka46", profile, feedTitle:entry.feedTitle || "乃木坂46 Blog", published:entry.published || "", link:entry.link || "", images, blocks:buildBlocks(body, images, entry.contentBlocks || [], Boolean(tr.bodyZh)) };
}
function buildBlocks(text, images, original, translated) {
  const marked = parseMarked(text, images); if (marked.some((b)=>b.type==="image")) return marked;
  const source = normalizeBlocks(original, images); if (translated && source.some((b)=>b.type==="image")) return distributeText(text, source, images);
  if (source.length && !translated) return source;
  return [...paras(text).map((p)=>({ type:"text", text:p })), ...images.map((image, imageIndex)=>({ type:"image", image, imageIndex }))];
}
function parseMarked(text, images) { const out=[]; for (const part of String(text||"").split(/(\[IMAGE_\d+\])/g)) { const m=part.match(/^\[IMAGE_(\d+)\]$/); if (m) { const i=Number(m[1])-1; if (images[i]) out.push({ type:"image", image:images[i], imageIndex:i }); } else paras(part).forEach((p)=>out.push({ type:"text", text:p })); } return out; }
function normalizeBlocks(blocks, images) { return Array.isArray(blocks) ? blocks.flatMap((b)=> b.type==="image" && images[Number(b.imageIndex)] ? [{ type:"image", image:images[Number(b.imageIndex)], imageIndex:Number(b.imageIndex) }] : paras(b.text).map((p)=>({ type:"text", text:p }))) : []; }
function distributeText(text, original, images) { const ps=paras(text.replace(/\[IMAGE_\d+\]/g,"")); const textCount=Math.max(1, original.filter((b)=>b.type==="text").length); const out=[]; let p=0, remain=textCount; for (const b of original) { if (b.type==="image") { const image=images[b.imageIndex]; if (image) out.push({ type:"image", image, imageIndex:b.imageIndex }); continue; } const left=ps.length-p; const take=Math.max(left>0?1:0, Math.ceil(left/remain)); const chunk=ps.slice(p,p+take).join("\n\n"); if (chunk) out.push({ type:"text", text:chunk }); p+=take; remain--; } const rest=ps.slice(p).join("\n\n"); if (rest) out.push({ type:"text", text:rest }); return out.length?out:[{type:"text",text}]; }
function ensureTranslation(entry) { entry.translation ||= { id:entry.id, member:entry.member || entry.feedTitle || "乃木坂46", titleZh:entry.title || "", bodyZh:entry.contentTextMarked || entry.contentText || "" }; return entry.translation; }
function blocksToText(blocks) { let n=0; return blocks.map((b)=> b.type==="image" ? `[IMAGE_${++n}]` : b.text).join("\n\n"); }
function updateControls() { const s=settings(); els.bodyFontSizeValue.textContent=s.bodyFontSize; els.bodyLineHeightValue.textContent=s.bodyLineHeight.toFixed(2); els.paragraphGapValue.textContent=s.paragraphGap; els.rubySizeValue.textContent=s.rubySize; els.rubyOpacityValue.textContent=s.rubyOpacity.toFixed(2); }
function settings() { return { bodyFontSize:num(els.bodyFontSize.value,20), bodyLineHeight:num(els.bodyLineHeight.value,1.85), paragraphGap:num(els.paragraphGap.value,34), rubyOn:els.rubyMode.value!=="off", rubySize:num(els.rubySize.value,10), rubyOpacity:num(els.rubyOpacity.value,.6) }; }
function applyTheme(theme) { const s=settings(); const c=els.previewCard.style; c.setProperty("--member-a", theme.a); c.setProperty("--member-b", theme.b); c.setProperty("--member-soft-a", rgba(theme.a,.12)); c.setProperty("--member-soft-b", rgba(theme.b,.12)); c.setProperty("--body-font-size", `${s.bodyFontSize}px`); c.setProperty("--body-line-height", s.bodyLineHeight); c.setProperty("--body-paragraph-gap", `${s.paragraphGap}px`); c.setProperty("--ruby-size", `${s.rubySize}px`); c.setProperty("--ruby-opacity", s.rubyOpacity); }
function themeFor(member, profile=findMember(member)) { if (profile?.colors?.length===2) return { a: readable(profile.colors[0], profile.colors[1], "#b447c8"), b: readable(profile.colors[1], profile.colors[0], "#7f2aa5") }; return { a:"#b447c8", b:"#7f2aa5" }; }
function rubyHtml(text) { if (!settings().rubyOn) return esc(text); let html=""; let i=0; while (i<text.length) { const hit=rubyTerms.find(([jp])=>text.startsWith(jp,i)); if (hit) { html += `<ruby>${esc(hit[0])}<rt>${esc(hit[1])}</rt></ruby>`; i += hit[0].length; } else html += esc(text[i++]); } return html; }
async function downloadCurrent() { const entry=selected(); if (!entry) return setStatus("没有可导出的文章。", true); await downloadPost(viewModel(entry)); }
async function downloadAll() { for (const entry of state.entries) await downloadPost(viewModel(entry)); }
async function downloadPost(post) { setStatus(`正在导出：${post.title}`); const canvas=await renderCanvas(post); await saveCanvas(canvas, `${fileBase(post.member)}-${fileBase(post.title)}.png`); setStatus("PNG 已生成。"); }
async function renderCanvas(post) {
  const s=settings(), w=canvasSize().w, pad=96, bodyW=w-pad*2, theme=themeFor(post.member, post.profile); const imgs=await loadImages(post.blocks.filter((b)=>b.type==="image").map((b)=>b.image));
  const c=document.createElement("canvas"), ctx=c.getContext("2d"); c.width=w; ctx.font=font(s.bodyFontSize*1.5,600); const lines=[]; let h=360;
  post.blocks.forEach((b)=>{ if (b.type==="image") h += Math.min(680, Math.round(w*.56)) + 42; else { const ls=wrap(ctx,b.text,bodyW); lines.push({b,ls}); h += ls.length*s.bodyFontSize*s.bodyLineHeight*1.5 + s.paragraphGap*1.5; } });
  c.height=Math.max(canvasSize().h,h+120); const g=ctx.createLinearGradient(0,0,w,c.height); g.addColorStop(0,rgba(theme.a,.10)); g.addColorStop(.5,"#ffffff"); g.addColorStop(1,rgba(theme.b,.10)); ctx.fillStyle=g; ctx.fillRect(0,0,w,c.height);
  ctx.textAlign="center"; ctx.fillStyle=theme.a; ctx.font=font(24,700,true); ctx.fillText(post.roman, w/2, 94); ctx.font=font(40,700,true); ctx.fillText(post.member, w/2, 140);
  ctx.textAlign="left"; ctx.fillStyle=theme.a; ctx.font=font(64,500,true); wrap(ctx,post.title,bodyW-210).forEach((l,i)=>ctx.fillText(l,pad,245+i*74)); ctx.fillStyle="#8f93a3"; ctx.font=font(24,600); ctx.fillText(formatDateTime(post.published), pad, 332); ctx.fillStyle="#70798b"; ctx.fillText(post.feedTitle, pad, 374);
  let y=470, textIndex=0, imgIndex=0; ctx.fillStyle="#1f2a42"; ctx.font=font(s.bodyFontSize*1.5,600);
  for (const b of post.blocks) { if (b.type==="image") { const img=imgs[imgIndex++]; if (img) { const boxH=Math.min(680, Math.round(w*.56)); drawImageContain(ctx,img,pad,y,bodyW,boxH); y+=boxH+42; } continue; } const ls=(lines[textIndex++]?.ls)||[]; for (const l of ls) { ctx.fillText(l,pad,y); y += s.bodyFontSize*s.bodyLineHeight*1.5; } y += s.paragraphGap*1.5; }
  return c;
}
function canvasSize(){ return els.imageSize.value==="square"?{w:1200,h:1200}:els.imageSize.value==="portrait"?{w:1080,h:1500}:{w:1200,h:1800}; }
function wrap(ctx,text,max){ const out=[]; for (const p of String(text||"").split(/\r?\n/)) { let line=""; for (const ch of Array.from(p)) { const n=line+ch; if (line && ctx.measureText(n).width>max) { out.push(line); line=ch; } else line=n; } if (line) out.push(line); } return out; }
function loadImages(images){ return Promise.all(images.map((image)=>new Promise((res)=>{ const img=new Image(); img.crossOrigin="anonymous"; img.onload=()=>res(img); img.onerror=()=>res(null); img.src=imgSrc(image); }))); }
function drawImageContain(ctx,img,x,y,w,h){ const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight); const dw=img.naturalWidth*scale, dh=img.naturalHeight*scale; ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh); }
function saveCanvas(canvas,name){ return new Promise((resolve,reject)=>canvas.toBlob((blob)=>{ if(!blob) return reject(new Error("PNG 生成失败。")); const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); resolve(); },"image/png")); }
function selected(){ return state.entries.find((e)=>e.id===state.selectedId) || null; }
async function request(url, options={}) { const res=await fetch(url,{ method:options.method||"GET", headers:{"Content-Type":"application/json", ...(options.headers||{})}, body:options.body?JSON.stringify(options.body):undefined }); const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data.error || `请求失败：${res.status}`); return data; }
function openAiHeaders(){ const key=els.apiKey.value.trim(); return key ? {"x-openai-api-key": key} : {}; }
function setBusy(b){ [els.fetchButton,els.translateButton,els.downloadButton,els.downloadAllButton].forEach((el)=>el.disabled=b); }
function setStatus(msg, err=false){ els.status.textContent=msg; els.status.classList.toggle("is-error",err); }
function normImages(v){ const arr=Array.isArray(v)?v:(v?[{url:v}]:[]), seen=new Set(); return arr.map((x)=> typeof x==="string"?{url:x}:x).filter((x)=>x?.url&&!seen.has(x.url)&&seen.add(x.url)); }
function imgSrc(image){ return image.proxyUrl || `/api/proxy-image?url=${encodeURIComponent(image.url)}`; }
function paras(v){ return String(v||"").split(/\n{1,}/).map((x)=>x.trim()).filter(Boolean); }
function clean(v){ return String(v||"").replace(/<\/?(?:strong|b|em|i|span)[^>]*>/gi,"").replace(/\*\*([^*]+)\*\*/g,"$1").replace(/__([^_]+)__/g,"$1").replace(/`([^`]+)`/g,"$1").trim(); }
function esc(v){ return String(v||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function formatDate(v){ if(!v) return "未注明日期"; const d=new Date(v); return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d); }
function formatDateTime(v){ if(!v) return "未注明日期"; const d=new Date(v); return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(d).replace(/\//g,"."); }
function normalizeName(v){ return String(v||"").replace(/\s+/g,"").replace(/髙/g,"高").replace(/﨑/g,"崎").replace(/ヶ/g,"ケ").trim(); }
function findMember(member){ const key=normalizeName(member); return members.find((p)=>p.key===key || key.includes(p.key) || p.key.includes(key)); }
function rgba(hex,a){ const {r,g,b}=hexRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; }
function hexRgb(hex){ const s=String(hex||"#000").replace("#",""); const f=(s.length===3?s.split("").map((c)=>c+c).join(""):s.padEnd(6,"0")).slice(0,6); const n=parseInt(f,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }; }
function lum(hex){ const c=hexRgb(hex), tr=(v)=>{ v/=255; return v<=.03928?v/12.92:((v+.055)/1.055)**2.4; }; return .2126*tr(c.r)+.7152*tr(c.g)+.0722*tr(c.b); }
function readable(a,b,f){ if(lum(a)<.78) return a; if(lum(b)<.78) return b; return f; }
function num(v,d){ const n=Number(v); return Number.isFinite(n)?n:d; }
function fileBase(v){ return String(v||"nogizaka-blog").replace(/[\\/:*?"<>|]/g,"").replace(/\s+/g,"-").slice(0,42) || "nogizaka-blog"; }
function font(size, weight=500, serif=false){ return `${weight} ${size}px ${serif ? "Georgia, 'Times New Roman', 'Noto Serif SC', serif" : "'Noto Sans SC', 'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'Hiragino Sans', 'Meiryo', 'Yu Gothic', 'Noto Sans JP', sans-serif"}`; }
