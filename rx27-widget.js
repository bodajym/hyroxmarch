// RX/27 · Widget para iPhone (app Scriptable)
// Pégalo en un script nuevo de Scriptable. La primera vez te pide el ID de tu Gist
// (Ajustes de la web → «Copiar ID del Gist») y lo guarda en el llavero del iPhone.
// Tamaños: pequeño, mediano y grande. Al tocarlo se abre la web.

const APP = "https://bodajym.github.io/hyroxmarch/#panel";
const START_W = 100, GOAL_W = 85, RACE = new Date(2027, 2, 17), KEY = "rx27-gist";
const C = {
  bg: new Color("#0C0F13"), bg2: new Color("#161B22"), line: new Color("#262D38"),
  ink: new Color("#EEF1F5"), mut: new Color("#8A94A6"), acc: new Color("#8FA8FF"),
  ok: new Color("#5FE0B0"), warn: new Color("#FFC86B"), bad: new Color("#FF7A95")
};

// ---------- ID del Gist ----------
async function gistId() {
  if (Keychain.contains(KEY)) return Keychain.get(KEY);
  if (config.runsInWidget) return null;
  const a = new Alert();
  a.title = "RX/27";
  a.message = "Pega el ID de tu Gist (en la web: Ajustes → Copiar ID del Gist).";
  a.addTextField("ID del Gist", Pasteboard.paste() || "");
  a.addAction("Guardar"); a.addCancelAction("Cancelar");
  if (await a.presentAlert() === -1) return null;
  const id = a.textFieldValue(0).trim().replace(/.*gist\.github\.com\/[^/]+\//, "").replace(/[^0-9a-f]/gi, "");
  if (!id) return null;
  Keychain.set(KEY, id);
  return id;
}

// ---------- datos (con copia local por si no hay red) ----------
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "rx27-cache.json");
async function load(id) {
  try {
    const r = new Request("https://api.github.com/gists/" + id);
    r.headers = { Accept: "application/vnd.github+json" };
    r.timeoutInterval = 12;
    const j = await r.loadJSON();
    const f = j.files && j.files["rx27-datos.json"];
    if (!f) throw new Error("sin archivo");
    let txt = f.content;
    if (f.truncated) { const r2 = new Request(f.raw_url); txt = await r2.loadString(); }
    fm.writeString(cache, txt);
    return { d: JSON.parse(txt), live: true };
  } catch (e) {
    if (fm.fileExists(cache)) return { d: JSON.parse(fm.readString(cache)), live: false };
    return null;
  }
}

const pad = n => String(n).padStart(2, "0");
const ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const f1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
const f0 = n => Math.round(n).toLocaleString("es-ES");
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function stats(data) {
  const t = ds(new Date()), days = Object.values(data.days || {}).filter(x => x && x.date).sort((a, b) => a.date < b.date ? -1 : 1);
  const w = days.filter(x => x.peso != null), last = w[w.length - 1] || null;
  const d = (data.days || {})[t] || {};
  const tot = (d.comidas || []).reduce((a, c) => ({ k: a.k + (+c.kcal || 0), p: a.p + (+c.p || 0) }), { k: 0, p: 0 });
  const left = Math.max(0, Math.round((RACE - new Date(new Date().toDateString())) / 864e5));
  const lost = last ? START_W - last.peso : null;
  const prog = last ? Math.max(0, Math.min(1, (START_W - last.peso) / (START_W - GOAL_W))) : 0;
  return {
    last, lost, prog, left, w: w.slice(-10),
    pasos: d.pasos || 0, activas: d.activas || 0, prot: Math.round(tot.p), kcal: Math.round(tot.k),
    entrenos: (d.entrenos || []).length, creatina: !!d.creatina, grasa: last && last.grasa != null ? last.grasa : null
  };
}

// ---------- dibujo ----------
function javi(scale) {
  const k = "#1a1c2c", sk = "#f2c39b", ss = "#d08f6a", hr = "#3b2a20", b = "#3b5dc9", B = "#29366f", p = "#333c57", e = "#b13e53", cy = "#73eff7";
  const dc = new DrawContext(); dc.size = new Size(16 * scale, 16 * scale); dc.opaque = false; dc.respectScreenScale = true;
  const R = (x, y, w, h, c) => { dc.setFillColor(new Color(c)); dc.fillRect(new Rect(x * scale, y * scale, w * scale, h * scale)); };
  R(4, 11, 8, 4, k); R(5, 11, 2, 3, p); R(9, 11, 2, 3, p); R(5, 14, 2, 1, e); R(9, 14, 2, 1, e); R(7, 11, 2, 3, k);
  R(3, 7, 10, 5, k); R(4, 7, 8, 4, b); R(4, 10, 8, 1, B); R(7, 8, 2, 1, cy);
  R(2, 8, 2, 4, k); R(12, 8, 2, 4, k); R(2, 8, 1, 2, b); R(13, 8, 1, 2, b); R(2, 10, 1, 1, sk); R(13, 10, 1, 1, sk);
  R(3, 0, 10, 8, k); R(4, 1, 8, 6, sk); R(4, 6, 8, 1, ss); R(4, 1, 8, 2, hr); R(4, 3, 1, 2, hr); R(11, 3, 1, 2, hr);
  R(6, 4, 1, 1, k); R(9, 4, 1, 1, k); R(5, 6, 6, 1, hr); R(6, 5, 4, 1, ss);
  return dc.getImage();
}
function bar(w, h, v, col) {
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  const p = new Path(); p.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2); dc.addPath(p); dc.setFillColor(C.line); dc.fillPath();
  const fw = Math.max(h, w * Math.max(0, Math.min(1, v)));
  if (v > 0) { const q = new Path(); q.addRoundedRect(new Rect(0, 0, fw, h), h / 2, h / 2); dc.addPath(q); dc.setFillColor(col); dc.fillPath(); }
  return dc.getImage();
}
function spark(pts, w, h) {
  const dc = new DrawContext(); dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true;
  if (pts.length < 2) return dc.getImage();
  const ys = pts.map(p => p.peso).concat([GOAL_W + 0.0001]), lo = Math.min(...pts.map(p => p.peso)) - .4, hi = Math.max(...pts.map(p => p.peso)) + .4;
  const X = i => 4 + i * (w - 8) / (pts.length - 1), Y = v => 4 + (hi - v) / (hi - lo) * (h - 8);
  const path = new Path(); pts.forEach((p, i) => i ? path.addLine(new Point(X(i), Y(p.peso))) : path.move(new Point(X(i), Y(p.peso))));
  dc.addPath(path); dc.setStrokeColor(C.acc); dc.setLineWidth(2.5); dc.strokePath();
  pts.forEach((p, i) => { dc.setFillColor(i === pts.length - 1 ? C.ink : C.acc); dc.fillEllipse(new Rect(X(i) - 3, Y(p.peso) - 3, 6, 6)); });
  return dc.getImage();
}
function txt(st, s, size, col, weight) {
  const t = st.addText(s);
  t.font = weight === "black" ? Font.blackSystemFont(size) : weight === "mono" ? Font.mediumMonospacedSystemFont(size) : weight === "bold" ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = col; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  return t;
}
function metric(st, label, v, goal, unit, col, w) {
  const s = st.addStack(); s.layoutVertically(); s.spacing = 3;
  const h = s.addStack(); h.centerAlignContent();
  txt(h, label.toUpperCase(), 9, C.mut, "mono"); h.addSpacer();
  txt(h, f0(v) + unit, 10, C.ink, "mono");
  s.addImage(bar(w, 6, v / goal, col)).imageSize = new Size(w, 6);
}

// ---------- widget ----------
async function build() {
  const fam = config.widgetFamily || "medium";
  const wd = new ListWidget(); wd.url = APP; wd.backgroundColor = C.bg;
  const g = new LinearGradient(); g.colors = [new Color("#18213A"), C.bg]; g.locations = [0, 0.7]; wd.backgroundGradient = g;
  wd.setPadding(14, 14, 14, 14);
  wd.refreshAfterDate = new Date(Date.now() + 15 * 60e3);
  const id = await gistId();
  if (!id) { txt(wd, "RX/27", 22, C.ink, "black"); txt(wd, "Abre Scriptable y ejecuta el script para poner tu ID del Gist.", 11, C.mut); return wd; }
  const res = await load(id);
  if (!res) { txt(wd, "RX/27", 22, C.ink, "black"); txt(wd, "Sin conexión ni datos guardados.", 11, C.mut); return wd; }
  const S = stats(res.d), wN = fam === "small" ? 120 : fam === "large" ? 140 : 130;

  // cabecera
  const top = wd.addStack(); top.centerAlignContent();
  const brand = top.addStack();
  txt(brand, "RX", 13, C.ink, "black"); txt(brand, "/", 13, C.acc, "black"); txt(brand, "27", 13, C.ink, "black");
  top.addSpacer();
  txt(top, S.left + " DÍAS", 9, C.acc, "mono");
  wd.addSpacer(fam === "small" ? 6 : 8);

  if (fam === "small") {
    const r = wd.addStack(); r.bottomAlignContent();
    txt(r, S.last ? f1(S.last.peso) : "—", 34, C.ink, "black"); r.addSpacer(3); txt(r, "kg", 11, C.mut, "bold");
    txt(wd, S.lost != null ? (S.lost >= 0 ? "−" : "+") + f1(Math.abs(S.lost)) + " kg · " + Math.round(S.prog * 100) + "%" : "Sin pesajes", 11, C.ok, "bold");
    wd.addSpacer(4);
    wd.addImage(bar(wN, 6, S.prog, C.acc)).imageSize = new Size(wN, 6);
    wd.addSpacer();
    metric(wd, "Pasos", S.pasos, 10000, "", C.ok, wN);
    return wd;
  }

  const row = wd.addStack(); row.centerAlignContent(); row.spacing = 12;
  const left = row.addStack(); left.layoutVertically();
  const img = left.addImage(javi(fam === "large" ? 5 : 4)); img.imageSize = fam === "large" ? new Size(80, 80) : new Size(56, 56);
  const mid = row.addStack(); mid.layoutVertically(); mid.spacing = 2;
  const r = mid.addStack(); r.bottomAlignContent();
  txt(r, S.last ? f1(S.last.peso) : "—", fam === "large" ? 44 : 36, C.ink, "black"); r.addSpacer(3); txt(r, "kg", 12, C.mut, "bold");
  txt(mid, S.lost != null ? (S.lost >= 0 ? "−" : "+") + f1(Math.abs(S.lost)) + " kg desde 100 · " + Math.round(S.prog * 100) + "% hecho" : "Aún sin pesajes", 11, C.ok, "bold");
  if (S.last) txt(mid, "Último: " + Number(S.last.date.slice(8)) + " " + MON[Number(S.last.date.slice(5, 7)) - 1] + (S.grasa != null ? " · grasa " + f1(S.grasa) + " %" : "") + " · objetivo 85", 9, C.mut, "mono");
  mid.addSpacer(4);
  const pb = mid.addImage(bar(fam === "large" ? 190 : 170, 6, S.prog, C.acc)); pb.imageSize = new Size(fam === "large" ? 190 : 170, 6);
  wd.addSpacer();

  const m = wd.addStack(); m.spacing = 12;
  metric(m, "Pasos", S.pasos, 10000, "", C.ok, 90);
  metric(m, "Prot.", S.prot, 190, " g", C.warn, 90);
  metric(m, "Activas", S.activas, 600, "", C.bad, 90);

  if (fam === "large") {
    wd.addSpacer(12);
    txt(wd, "ÚLTIMOS PESAJES", 9, C.mut, "mono");
    wd.addSpacer(4);
    wd.addImage(spark(S.w, 290, 90)).imageSize = new Size(290, 90);
    wd.addSpacer(6);
    const f = wd.addStack(); f.spacing = 10;
    txt(f, "Kcal comidas " + f0(S.kcal), 10, C.mut, "mono");
    txt(f, "Entrenos hoy " + S.entrenos, 10, C.mut, "mono");
    if (S.creatina) txt(f, "Creatina ✓", 10, C.ok, "mono");
  }
  if (!res.live) { wd.addSpacer(4); txt(wd, "Sin conexión · datos guardados", 8, C.mut, "mono"); }
  return wd;
}

const w = await build();
if (config.runsInWidget) Script.setWidget(w);
else await w.presentMedium();
Script.complete();
