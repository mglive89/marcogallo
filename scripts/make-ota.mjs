// Prepara l'aggiornamento automatico della parte web dell'app (si usa dopo make-www.mjs).
// Uso: node scripts/make-ota.mjs <cartella del sito gh-pages>
// Scrive nel sito: app/update.json (versione + elenco file con impronta SHA-256) e app/files/… (solo i file che nell'app
// sono diversi dal sito, es. index.html con native.js). Il telefono scarica solo i file che non ha già.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const site = process.argv[2];
if (!site || !fs.existsSync(path.join(site, "index.html"))) { console.error("uso: node scripts/make-ota.mjs <cartella del sito>"); process.exit(1); }
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const www = path.join(root, "www");
const BASE = "https://mglive89.github.io/marcogallo/";
const sha = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const enc = p => p.split("/").map(encodeURIComponent).join("/");
const html = fs.readFileSync(path.join(www, "index.html"), "utf8");
const web = (html.match(/APP_VER = "([^"]+)"/) || [])[1];
const native = +((fs.readFileSync(path.join(root, "native-web/native.js"), "utf8").match(/NATIVE_VER = (\d+)/) || [])[1] || 0);
if (!web || !native) throw new Error("versioni non trovate");
const out = path.join(site, "app");
fs.rmSync(path.join(out, "files"), { recursive: true, force: true });
const manifest = []; let own = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name), rel = path.relative(www, f).split(path.sep).join("/");
    if (e.isDirectory()) { walk(f); continue; }
    const h = sha(f), s = path.join(site, rel);
    let url;
    if (fs.existsSync(s) && sha(s) === h) url = BASE + enc(rel);
    else { const d = path.join(out, "files", rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(f, d); url = BASE + "app/files/" + enc(rel); own++; }
    manifest.push({ file_name: rel, file_hash: h, download_url: url });
  }
})(www);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "update.json"), JSON.stringify({ web, native, apk: "https://github.com/mglive89/marcogallo/raw/app-apk/FitQuest.apk", manifest }));
console.log("aggiornamento", web, "nativa", native, "-", manifest.length, "file,", own, "propri dell'app");
