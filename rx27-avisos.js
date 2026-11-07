// RX/27 · Avisos · app Scriptable
// Programa notificaciones del iPhone con lo que te toca: comidas, pre-entreno y creatina, entrenos, pesarte y apuntar el día.
// Lee tu plan del día (el que te escribe el coach en la web) para hoy y mañana.
// Ejecútalo con una automatización de Atajos (por ejemplo a las 7:00, 13:00 y 19:00) para que siempre vaya al día.

const SITE = "https://bodajym.github.io/hyroxmarch/";
const THREAD = "rx27", ANTES_ENTRENO = 20; // minutos de antelación para los entrenos
const ENTRENO = /f45|ufc|retiro|z2|series|test|carrera|rodaje|hyrox|simulaci|fuerza|golf|partido|f[uú]tbol/i;
const COMIDA = /desayuno|comida|merienda|cena|post|pre-entreno|snack|antes/i;
const pad = n => String(n).padStart(2, "0"), ds = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());

async function coach() {
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
  const c = await coach(), now = new Date(), days = [0, 1].map(i => { const d = new Date(now); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d; });
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

const r = await run();
if (config.runsInApp) {
  const a = new Alert(); a.title = "RX/27 · Avisos";
  a.message = r.n + " avisos programados para hoy y mañana." + (r.next ? "\n\nPróximo: " + r.next.title.replace(/^\S+\s/, "") + " a las " + pad(r.next.t.getHours()) + ":" + pad(r.next.t.getMinutes()) : "");
  a.addAction("OK"); await a.present();
}
Script.setShortcutOutput(r.n + " avisos programados");
Script.complete();
