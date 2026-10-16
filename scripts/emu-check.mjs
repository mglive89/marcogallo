// Prova l'app vera in un emulatore Android: si collega alla WebView (DevTools), controlla che le funzioni
// del telefono ci siano, apre ogni schermata e salva gli screenshot in emu-shots/.
import fs from "node:fs";

const out = "emu-shots";
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pages = [];
for (let i = 0; i < 30 && !pages.length; i++) {
  try { pages = (await (await fetch("http://127.0.0.1:9222/json")).json()).filter((p) => p.type === "page" && p.webSocketDebuggerUrl); } catch {}
  if (!pages.length) await sleep(2000);
}
if (!pages.length) { console.error("WebView non trovata"); process.exit(1); }
const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const wait = new Map(); const problems = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); return; }
  if (d.method === "Runtime.exceptionThrown") problems.push("ERRORE JS: " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") problems.push("console.error: " + d.params.args.map((a) => a.value ?? a.description).join(" "));
};
const send = (method, params = {}) => new Promise((r) => { const n = ++id; wait.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, "base64")); };
await send("Runtime.enable"); await send("Page.enable");

const report = {};
report.prima_apertura = await ev("document.title");
await shot("01-benvenuto");
// un utente già iscritto: Uomo, nome Marco
await ev(`(()=>{ for (const [k,v] of Object.entries({gender:'m',started:true,name:'Marco',lang:'it'})) localStorage.setItem('recluta:'+k, JSON.stringify(v)); location.reload(); return 1 })()`);
await sleep(9000);
report.nativa = await ev("JSON.stringify({ native: Capacitor.isNativePlatform(), piattaforma: Capacitor.getPlatform(), salute: typeof FitQuestHealth, ponte: typeof FitQuestNative, voce: typeof speechSynthesis.speak, wakeLock: typeof navigator.wakeLock?.request, share: typeof navigator.share, vibra: typeof navigator.vibrate })");
report.salute_disponibile = await ev("FitQuestHealth.available().then(String)");
report.fotocamera = await ev("navigator.mediaDevices.getUserMedia({video:true}).then(s=>{const n=s.getVideoTracks().length; s.getTracks().forEach(t=>t.stop()); return 'ok, tracce video: '+n}).catch(e=>'NO: '+e.name+' '+e.message)");
report.voce = await ev("new Promise(r=>{ const u=new SpeechSynthesisUtterance('Prova voce'); u.onend=()=>r('ok'); u.onerror=e=>r('errore: '+(e&&e.message||e)); speechSynthesis.speak(u); setTimeout(()=>r('nessuna risposta in 8 s'),8000); })");
report.schermo_acceso = await ev("navigator.wakeLock.request('screen').then(l=>l.release().then(()=>'ok'))");
report.link_condivisione = await ev("siteUrl()");
for (const [i, t] of ["home", "exercises", "duels", "ranking", "profile"].entries()) {
  await ev(`document.querySelector('#tabbar [data-tab="${t}"]').click()`);
  await sleep(2500);
  await shot(`${String(i + 2).padStart(2, "0")}-${t}`);
}
await ev("window.scrollTo(0, 99999)"); await sleep(1200); await shot("07-profilo-fondo");
report.indietro_gestito = await ev("String(fqBack())");
await sleep(1500);
report.dopo_indietro = await ev("document.querySelector('#tabbar [aria-current]')?.dataset.tab");
report.problemi = problems;
fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
ws.close();
