// RX/27 · Anillos · widget para iPhone (app Scriptable)
// Solo porcentajes: camino a 85 kg, kcal, proteína, déficit, kcal activas y kcal en reposo.
// Usa el mismo ID del Gist que el widget RX27 (se guarda en el llavero, no hace falta volver a pegarlo).

const APP = "https://bodajym.github.io/hyroxmarch/#panel";
const START_W = 100, GOAL_W = 85, KEY = "rx27-gist", ALTURA = 176, EDAD = 32, DEF_OBJ = 650;
const KCAL = { descanso: [1700, 1850], z2: [1750, 1900], calidad: [1850, 2000], hyrox: [1950, 2100], doble: [2100, 2300], mant: [2850, 3050] };
const BG = new Color("#0C0F13"), INK = new Color("#EEF1F5"), MUT = new Color("#8A94A6"), TRK = new Color("#232A36");

async function gistId() {
  if (Keychain.contains(KEY)) return Keychain.get(KEY);
  if (config.runsInWidget) return null;
  const a = new Alert(); a.title = "RX/27"; a.message = "Pega el ID de tu Gist (Ajustes de la web → Copiar ID del Gist).";
  a.addTextField("ID del Gist", Pasteboard.paste() || ""); a.addAction("Guardar"); a.addCancelAction("Cancelar");
  if (await a.presentAlert() === -1) return null;
  const id = a.textFieldValue(0).trim().replace(/[^0-9a-f]/gi, ""); if (!id) return null; Keychain.set(KEY, id); return id;
}
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "rx27-cache.json");
async function load(id) {
  try {
    const r = new Request("https://api.github.com/gists/" + id); r.headers = { Accept: "application/vnd.github+json" }; r.timeoutInterval = 12;
    const j = await r.loadJSON(), f = j.files && j.files["rx27-datos.json"]; if (!f) throw new Error("sin archivo");
    let t = f.content; if (f.truncated) t = await new Request(f.raw_url).loadString();
    fm.writeString(cache, t); return { d: JSON.parse(t), live: true };
  } catch (e) { return fm.fileExists(cache) ? { d: JSON.parse(fm.readString(cache)), live: false } : null; }
}
const pad = n => String(n).padStart(2, "0"), ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

function calc(data) {
  const now = new Date(), t = ds(now), days = data.days || {}, d = days[t] || {};
  const w = Object.values(days).filter(x => x && x.peso != null).sort((a, b) => a.date < b.date ? -1 : 1), last = w[w.length - 1];
  const kg = last ? last.peso : 97.5;
  const tot = (d.comidas || []).reduce((a, c) => ({ k: a.k + (+c.kcal || 0), p: a.p + (+c.p || 0) }), { k: 0, p: 0 });
  const tipo = d.tipo && KCAL[d.tipo] ? d.tipo : ((d.entrenos || []).length > 1 ? "doble" : "calidad");
  const kObj = Math.round((KCAL[tipo][0] + KCAL[tipo][1]) / 2);
  const full = Math.round(10 * kg + 6.25 * ALTURA - 5 * EDAD + 5), frac = Math.min(1, (now.getHours() * 60 + now.getMinutes()) / 1440);
  const reposo = Math.max(d.reposo || 0, Math.round(full * frac)), act = d.activas || 0;
  const deficit = reposo + act - tot.k;
  return [
    { k: "PESO", sub: "camino a 85", v: last ? (START_W - kg) / (START_W - GOAL_W) : 0, c: "#8FA8FF" },
    { k: "KCAL", sub: "comidas", v: tot.k / kObj, c: "#FFC86B", over: true },
    { k: "PROTEÍNA", sub: "de 190 g", v: tot.p / 190, c: "#5FE0B0" },
    { k: "DÉFICIT", sub: "de 650", v: Math.max(0, deficit) / DEF_OBJ, c: "#FF7A95" },
    { k: "ACTIVAS", sub: "de 600", v: act / 600, c: "#C792FF" },
    { k: "REPOSO", sub: "del día", v: reposo / full, c: "#73EFF7" }
  ];
}

// anillo con el % dentro
function ring(m, size, big) {
  const dc = new DrawContext(); dc.size = new Size(size, size); dc.opaque = false; dc.respectScreenScale = true;
  const lw = Math.max(5, size * (big ? 0.1 : 0.11)), r = size / 2 - lw / 2 - 1, cx = size / 2, cy = size / 2, col = new Color(m.c);
  const arc = (a0, a1, color, width) => {
    const p = new Path(), n = Math.max(2, Math.ceil((a1 - a0) / 0.06)), pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a))); }
    p.addLines(pts); dc.addPath(p); dc.setStrokeColor(color); dc.setLineWidth(width); dc.strokePath();
    [pts[0], pts[pts.length - 1]].forEach(q => { dc.setFillColor(color); dc.fillEllipse(new Rect(q.x - width / 2, q.y - width / 2, width, width)); });
  };
  const p = new Path(); p.addEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r)); dc.addPath(p); dc.setStrokeColor(TRK); dc.setLineWidth(lw); dc.strokePath();
  const v = Math.max(0, m.v), a0 = -Math.PI / 2;
  if (v > 0.003) arc(a0, a0 + 2 * Math.PI * Math.min(1, v) - (v >= 1 ? 0.001 : 0), col, lw);
  if (v > 1) arc(a0, a0 + 2 * Math.PI * Math.min(1, v - 1), m.over && v > 1.08 ? new Color("#FF5A5A") : new Color("#FFFFFF", 0.85), lw * 0.45);
  const pct = Math.round(v * 100) + "%";
  dc.setFont(Font.heavyRoundedSystemFont(size * (pct.length > 4 ? 0.2 : 0.24))); dc.setTextColor(INK); dc.setTextAlignedCenter();
  dc.drawTextInRect(pct, new Rect(0, cy - size * 0.15, size, size * 0.32));
  return dc.getImage();
}
function cell(st, m, size, big) {
  const s = st.addStack(); s.layoutVertically(); s.centerAlignContent();
  const ih = s.addStack(); ih.addSpacer(); ih.addImage(ring(m, size, big)).imageSize = new Size(size, size); ih.addSpacer();
  s.addSpacer(3);
  const lh = s.addStack(); lh.addSpacer(); const t = lh.addText(m.k); t.font = Font.semiboldMonospacedSystemFont(big ? 10 : 8); t.textColor = new Color(m.c); t.lineLimit = 1; t.minimumScaleFactor = .6; lh.addSpacer();
  if (big) { const sh = s.addStack(); sh.addSpacer(); const u = sh.addText(m.sub); u.font = Font.systemFont(9); u.textColor = MUT; sh.addSpacer(); }
}

async function build() {
  const fam = config.widgetFamily || "medium", w = new ListWidget();
  w.url = APP; w.backgroundColor = BG; w.refreshAfterDate = new Date(Date.now() + 15 * 60e3);
  const g = new LinearGradient(); g.colors = [new Color("#161C30"), BG]; g.locations = [0, .75]; w.backgroundGradient = g;
  w.setPadding(12, 10, 12, 10);
  const id = await gistId(), res = id ? await load(id) : null;
  if (!res) { const t = w.addText(id ? "Sin conexión" : "Abre Scriptable y ejecuta el script"); t.font = Font.boldSystemFont(12); t.textColor = INK; return w; }
  const M = calc(res.d);
  if (fam === "small") {
    const pick = [M[0], M[2], M[3], M[1]];
    for (let r = 0; r < 2; r++) { const row = w.addStack(); row.spacing = 6; for (let c = 0; c < 2; c++) cell(row, pick[r * 2 + c], 52, false); if (!r) w.addSpacer(6); }
  } else if (fam === "large") {
    const h = w.addStack(); h.centerAlignContent();
    const t1 = h.addText("RX/27 · HOY"); t1.font = Font.blackSystemFont(16); t1.textColor = INK; h.addSpacer();
    const t2 = h.addText(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })); t2.font = Font.mediumMonospacedSystemFont(11); t2.textColor = MUT;
    w.addSpacer();
    for (let r = 0; r < 2; r++) { const row = w.addStack(); row.spacing = 10; for (let c = 0; c < 3; c++) { cell(row, M[r * 3 + c], 88, true); } if (!r) w.addSpacer(14); }
    w.addSpacer();
  } else {
    const row = w.addStack(); row.spacing = 4; row.centerAlignContent();
    M.forEach(m => cell(row, m, 46, false));
  }
  if (!res.live) { w.addSpacer(2); const t = w.addText("sin conexión"); t.font = Font.systemFont(8); t.textColor = MUT; }
  return w;
}
const wd = await build();
if (config.runsInWidget) Script.setWidget(wd); else await wd.presentLarge();
Script.complete();
