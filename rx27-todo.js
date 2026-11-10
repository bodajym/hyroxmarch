// RX/27 · TODO EN UNO · app Scriptable
// Un solo script para:
//  1) Widget de peso y progreso   → parámetro del widget: peso
//  2) Widget de anillos (solo %)   → parámetro del widget: anillos (o vacío)
//  3) Avisos de "te toca…" (comidas, entrenos, creatina, pesarte, cerrar el día) según el plan de hoy y mañana.
//     Se reprograman solos cada vez que el widget se actualiza.
// La primera vez, ejecútalo con ▶︎: te pide el ID de tu Gist y te deja activar los avisos.

const APP = "https://bodajym.github.io/hyroxmarch/#panel", SITE = "https://bodajym.github.io/hyroxmarch/";
const START_W = 100, GOAL_W = 85, RACE = new Date(2027, 2, 17), KEY = "rx27-gist", ALTURA = 176, EDAD = 32, DEF_OBJ = 500;
const THREAD = "rx27", ANTES_ENTRENO = 20;
const KCAL = { descanso: [1850, 2000], z2: [2050, 2200], calidad: [2200, 2350], hyrox: [2300, 2450], doble: [2500, 2700], mant: [2850, 3050] };
const C = {
  bg: new Color("#0C0F13"), bg2: new Color("#161B22"), line: new Color("#262D38"),
  ink: new Color("#EEF1F5"), mut: new Color("#8A94A6"), acc: new Color("#8FA8FF"),
  ok: new Color("#5FE0B0"), warn: new Color("#FFC86B"), bad: new Color("#FF7A95")
};
const BG = C.bg, INK = C.ink, MUT = C.mut, TRK = new Color("#232A36");
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), "rx27-cache.json"), stamp = fm.joinPath(fm.documentsDirectory(), "rx27-avisos-stamp.txt");

async function gistId() {
  if (Keychain.contains(KEY)) return Keychain.get(KEY);
  if (config.runsInWidget) return null;
  const a = new Alert(); a.title = "RX/27"; a.message = "Pega el ID de tu Gist (en la web: Ajustes → Copiar ID del Gist).";
  a.addTextField("ID del Gist", Pasteboard.paste() || ""); a.addAction("Guardar"); a.addCancelAction("Cancelar");
  if (await a.presentAlert() === -1) return null;
  const id = a.textFieldValue(0).trim().replace(/.*gist\.github\.com\/[^/]+\//, "").replace(/[^0-9a-f]/gi, ""); if (!id) return null;
  Keychain.set(KEY, id); return id;
}
async function load(id) {
  try {
    const r = new Request("https://api.github.com/gists/" + id); r.headers = { Accept: "application/vnd.github+json" }; r.timeoutInterval = 12;
    const j = await r.loadJSON(), f = j.files && j.files["rx27-datos.json"]; if (!f) throw new Error("sin archivo");
    let t = f.content; if (f.truncated) t = await new Request(f.raw_url).loadString();
    fm.writeString(cache, t); return { d: JSON.parse(t), live: true };
  } catch (e) { return fm.fileExists(cache) ? { d: JSON.parse(fm.readString(cache)), live: false } : null; }
}

// ---------- dónde estás (ubicación del iPhone + tus sitios guardados en la app) ----------
const PLACE = { casa: "En casa", padres: "Casa de tus padres", suegros: "Casa de tus suegros", f45: "En el F45", amazon: "En Amazon Ads", retiro: "En el Retiro" };
const PICON = { casa: "house.fill", padres: "house.fill", suegros: "house.fill", f45: "dumbbell.fill", amazon: "briefcase.fill", retiro: "tree.fill", fuera: "figure.walk" };
async function where(data) {
  const lp = fm.joinPath(fm.documentsDirectory(), "rx27-where.json");
  try {
    Location.setAccuracyToHundredMeters();
    const l = await Location.current(), sites = Object.assign({ retiro: { lat: 40.4148, lon: -3.6842, r: 520 } }, data.lugares || {});
    let best = null;
    for (const [k, v] of Object.entries(sites)) { if (!v || v.lat == null) continue; const R = 6371e3, r = Math.PI / 180, x = (v.lon - l.longitude) * r * Math.cos((v.lat + l.latitude) / 2 * r), y = (v.lat - l.latitude) * r, d = Math.sqrt(x * x + y * y) * R; if (d <= (v.r || 140) + 40 && (!best || d < best.d)) best = { k, d }; }
    const o = best ? { k: best.k, n: PLACE[best.k] || best.k } : { k: "fuera", n: "Por Madrid" };
    fm.writeString(lp, JSON.stringify(o)); return o;
  } catch (e) { return fm.fileExists(lp) ? JSON.parse(fm.readString(lp)) : null; }
}
function placeChip(st, p, size) {
  if (!p) return;
  const c = st.addStack(); c.centerAlignContent(); c.spacing = 4; c.setPadding(3, 7, 3, 8); c.cornerRadius = 9;
  c.backgroundColor = new Color("#8FA8FF", 0.16); c.borderColor = new Color("#8FA8FF", 0.45); c.borderWidth = 1;
  const i = c.addImage(SFSymbol.named(PICON[p.k] || "location.fill").image); i.imageSize = new Size(size, size); i.tintColor = C.acc;
  const t = c.addText(p.n); t.font = Font.semiboldSystemFont(size); t.textColor = INK; t.lineLimit = 1;
}

// ---------- widget de peso ----------
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
async function buildPeso(res) {
  const fam = config.widgetFamily || "medium";
  const wd = new ListWidget(); wd.url = APP; wd.backgroundColor = C.bg;
  const g = new LinearGradient(); g.colors = [new Color("#18213A"), C.bg]; g.locations = [0, 0.7]; wd.backgroundGradient = g;
  wd.setPadding(14, 14, 14, 14);
  wd.refreshAfterDate = new Date(Date.now() + 15 * 60e3);
  const S = stats(res.d), wN = fam === "small" ? 120 : fam === "large" ? 140 : 130;

  // cabecera
  const top = wd.addStack(); top.centerAlignContent();
  const brand = top.addStack();
  txt(brand, "RX", 13, C.ink, "black"); txt(brand, "/", 13, C.acc, "black"); txt(brand, "27", 13, C.ink, "black");
  top.addSpacer();
  if (res.place && fam !== "small") { placeChip(top, res.place, 10); top.addSpacer(6); }
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


// ---------- widget de anillos ----------
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
    { k: "DÉFICIT", sub: "de 500", v: Math.max(0, deficit) / DEF_OBJ, c: "#FF7A95" },
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
  if (v > 0.003) { const e = a0 + 2 * Math.PI * Math.min(1, v) - (v >= 1 ? 0.001 : 0); arc(a0, e, new Color(m.c, 0.18), lw * 1.9); arc(a0, e, col, lw); }
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

async function buildAnillos(res) {
  const fam = config.widgetFamily || "large", w = new ListWidget();
  w.url = APP; w.backgroundColor = BG; w.refreshAfterDate = new Date(Date.now() + 15 * 60e3);
  const g = new LinearGradient(); g.colors = [new Color("#1B2240"), new Color("#0E1220"), BG]; g.locations = [0, .55, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1); w.backgroundGradient = g;
  w.setPadding(12, 10, 12, 10);
  const M = calc(res.d);
  if (fam === "small") {
    const pick = [M[0], M[2], M[3], M[1]];
    for (let r = 0; r < 2; r++) { const row = w.addStack(); row.spacing = 6; for (let c = 0; c < 2; c++) cell(row, pick[r * 2 + c], 52, false); if (!r) w.addSpacer(6); }
  } else if (fam === "large") {
    const h = w.addStack(); h.centerAlignContent(); h.spacing = 8;
    const jv = h.addImage(javi(3)); jv.imageSize = new Size(36, 36);
    const hv = h.addStack(); hv.layoutVertically(); hv.spacing = 3;
    const t1 = hv.addText("RX/27 · HOY"); t1.font = Font.blackSystemFont(17); t1.textColor = INK;
    placeChip(hv, res.place, 10);
    h.addSpacer();
    const t2 = h.addText(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })); t2.font = Font.mediumMonospacedSystemFont(11); t2.textColor = MUT;
    w.addSpacer();
    for (let r = 0; r < 2; r++) { const row = w.addStack(); row.spacing = 10; for (let c = 0; c < 3; c++) { cell(row, M[r * 3 + c], 88, true); } if (!r) w.addSpacer(14); }
    w.addSpacer();
  } else {
    const h = w.addStack(); h.centerAlignContent(); h.spacing = 6;
    const t1 = h.addText("RX/27"); t1.font = Font.blackSystemFont(13); t1.textColor = INK;
    placeChip(h, res.place, 9); h.addSpacer();
    const t2 = h.addText(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })); t2.font = Font.mediumMonospacedSystemFont(9); t2.textColor = MUT;
    w.addSpacer(6);
    const row = w.addStack(); row.spacing = 4; row.centerAlignContent();
    M.forEach(m => cell(row, m, 46, false));
  }
  if (!res.live) { w.addSpacer(2); const t = w.addText("sin conexión"); t.font = Font.systemFont(8); t.textColor = MUT; }
  return w;
}

// ---------- avisos ----------
const ENTRENO = /f45|ufc|retiro|z2|series|test|carrera|rodaje|hyrox|simulaci|fuerza|golf|partido|f[uú]tbol/i;
const COMIDA = /desayuno|comida|merienda|cena|post|pre-entreno|snack|antes/i;

async function coachJSON() {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), "rx27-coach.json");
  try { const j = await new Request(SITE + "coach.json?t=" + Date.now()).loadJSON(); fm.writeString(p, JSON.stringify(j)); return j; }
  catch (e) { return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : { dias: {} }; }
}
function at(day, hm) { const [h, m] = hm.split(":").map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return d; }
function short(t, n) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; }

function plan(c, day) {
  const s = ds(day), d = c.dias && c.dias[s], out = [];
  if (d && Array.isArray(d.sesiones)) {
    d.sesiones.forEach(x => {
      const m = String(x.h || "").match(/^(\d{1,2})[:.](\d{2})$/); if (!m) return;
      const hm = pad(m[1]) + ":" + m[2], name = String(x.d || ""), isTrain = ENTRENO.test(name) && !COMIDA.test(name);
      if (/^dormir/i.test(name)) out.push({ t: at(day, hm), title: "😴 Hora de ir a dormir", body: short(x.t, 160) });
      else if (isTrain) {
        const t = new Date(at(day, hm).getTime() - ANTES_ENTRENO * 60e3);
        out.push({ t, title: "🏋️ En " + ANTES_ENTRENO + " min: " + name, body: short(x.t, 160) });
      } else if (name.length < 8 && /^(antes|después|despues|tarde)/i.test(name)) out.push({ t: at(day, hm), title: "⏰ " + short(x.t, 60), body: short(x.t, 160) });
      else out.push({ t: at(day, hm), title: (COMIDA.test(name) ? "🍽️ Te toca: " : "⏰ Te toca: ") + name, body: short(x.t, 160) });
    });
  } else {
    [["08:30", "🍽️ Te toca: Desayuno", "Mira el menú de hoy en la app."], ["14:30", "🍽️ Te toca: Comida", "Proteína primero. Apúntalo en la app."],
     ["17:30", "🍽️ Te toca: Merienda", "Y la creatina si entrenas por la tarde."], ["21:00", "🍽️ Te toca: Cena", "Ligera y con proteína."]]
      .forEach(([hm, title, body]) => out.push({ t: at(day, hm), title, body }));
  }
  const has = re => out.some(o => re.test(o.title));
  out.push({ t: at(day, "08:00"), title: "⚖️ Pésate", body: "En ayunas, después del baño. Luego abre RX27 para que suba el peso." });
  if (!has(/creatina/i)) out.push({ t: at(day, "10:00"), title: "💊 Creatina", body: "5 g (un cacito y medio) antes de entrenar o con el desayuno. Márcala en la app." });
  out.push({ t: at(day, "22:30"), title: "📝 Cierra el día", body: "Apunta comidas y entrenos en RX27. Revisa el déficit." });
  return out;
}

async function run() {
  const c = await coachJSON(), now = new Date(), days = [0, 1].map(i => { const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d; });
  // borrar los avisos RX27 pendientes para no duplicar
  const pend = await Notification.allPending();
  const ids = pend.filter(n => n.threadIdentifier === THREAD || String(n.identifier).startsWith("rx27-")).map(n => n.identifier);
  if (ids.length) await Notification.removePending(ids);
  let n = 0, next = null;
  for (const day of days) {
    for (const [i, o] of plan(c, day).entries()) {
      if (o.t <= new Date(now.getTime() + 60e3)) continue;
      const x = new Notification();
      x.identifier = "rx27-" + ds(day) + "-" + pad(o.t.getHours()) + pad(o.t.getMinutes()) + "-" + i;
      x.threadIdentifier = THREAD; x.title = o.title; x.body = o.body; x.sound = "default";
      x.openURL = SITE + "#dia"; x.setTriggerDate(o.t);
      await x.schedule(); n++;
      if (!next || o.t < next.t) next = o;
    }
  }
  return { n, next };
}


// ---------- avisos: reprogramar como mucho cada 30 min ----------
async function avisos(force) {
  if (Keychain.contains("rx27-avisos") && Keychain.get("rx27-avisos") === "no") return null;
  const last = fm.fileExists(stamp) ? Number(fm.readString(stamp)) : 0;
  if (!force && Date.now() - last < 30 * 60e3) return null;
  try { const r = await run(); fm.writeString(stamp, String(Date.now())); return r; } catch (e) { return null; }
}

// ---------- arranque ----------
const param = String(args.widgetParameter || "").trim().toLowerCase();
if (config.runsInWidget) {
  const id = await gistId(), res = id ? await load(id) : null;
  let wd;
  if (!res) { wd = new ListWidget(); wd.backgroundColor = BG; const t = wd.addText(id ? "RX/27 · sin conexión" : "Abre Scriptable y ejecuta RX27 con ▶︎"); t.font = Font.boldSystemFont(12); t.textColor = INK; }
  else { res.place = await where(res.d); wd = param.startsWith("peso") ? await buildPeso(res) : await buildAnillos(res); }
  await avisos(false);
  Script.setWidget(wd);
} else {
  const id = await gistId();
  if (config.runsInApp) {
    const m = new Alert(); m.title = "RX/27"; m.message = "¿Qué quieres hacer?";
    m.addAction("Ver widget de anillos"); m.addAction("Ver widget de peso"); m.addAction("Programar avisos ahora");
    m.addAction(Keychain.contains("rx27-avisos") && Keychain.get("rx27-avisos") === "no" ? "Activar avisos" : "Desactivar avisos");
    m.addCancelAction("Cerrar");
    const i = await m.presentSheet();
    const res = id ? await load(id) : null; if (res) res.place = await where(res.d);
    if ((i === 0 || i === 1) && res) { const wd = i === 0 ? await buildAnillos(res) : await buildPeso(res); if (i === 0) await wd.presentLarge(); else await wd.presentMedium(); }
    else if (i === 2) { if (Keychain.contains("rx27-avisos")) Keychain.remove("rx27-avisos"); const r = await avisos(true); const a = new Alert(); a.title = "Avisos"; a.message = r ? r.n + " avisos programados para hoy y mañana." + (r.next ? "\nPróximo: " + r.next.title.replace(/^\S+\s/, "") + " a las " + pad(r.next.t.getHours()) + ":" + pad(r.next.t.getMinutes()) : "") : "No se han podido programar."; a.addAction("OK"); await a.present(); }
    else if (i === 3) { const off = Keychain.contains("rx27-avisos") && Keychain.get("rx27-avisos") === "no"; if (off) { Keychain.remove("rx27-avisos"); await avisos(true) } else { Keychain.set("rx27-avisos", "no"); const p = await Notification.allPending(); const ids = p.filter(n => n.threadIdentifier === THREAD).map(n => n.identifier); if (ids.length) await Notification.removePending(ids) } }
  } else {
    const r = await avisos(true); Script.setShortcutOutput(r ? r.n + " avisos programados" : "Avisos desactivados");
  }
}
Script.complete();
