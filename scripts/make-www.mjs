// Prepara www/ per l'app: prende il sito pubblicato (ramo gh-pages) e lo adatta al telefono.
// Uso: node scripts/make-www.mjs <cartella del sito>
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, "index.html"))) { console.error("manca il sito: node scripts/make-www.mjs <cartella>"); process.exit(1); }
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const www = path.join(root, "www");
fs.rmSync(www, { recursive: true, force: true });
const SKIP = new Set([".git", ".github", "sw.js", "README.md", "voce.html", ".nojekyll"]);
fs.cpSync(src, www, { recursive: true, filter: (p) => !SKIP.has(path.basename(p)) || path.resolve(p) === path.resolve(src) });

let html = fs.readFileSync(path.join(www, "index.html"), "utf8");
const swReg = 'navigator.serviceWorker.register("sw.js")';
if (!html.includes(swReg)) throw new Error("registrazione del service worker non trovata");
html = html.replace(swReg, "Promise.reject()"); // nell'app i file sono già sul telefono
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', "");
const head = '<script src="capacitor.js"></script>\n<script src="native.js"></script>\n';
const at = html.indexOf("<script");
if (at < 0) throw new Error("nessuno script in index.html");
html = html.slice(0, at) + head + html.slice(at);
fs.writeFileSync(path.join(www, "index.html"), html);
fs.copyFileSync(path.join(root, "node_modules/@capacitor/core/dist/capacitor.js"), path.join(www, "capacitor.js"));
fs.copyFileSync(path.join(root, "native-web/native.js"), path.join(www, "native.js"));
fs.copyFileSync(path.join(root, "native-web/privacy.html"), path.join(www, "privacy.html"));
// il WebView di Android e iOS legge le WebP: le copie PNG (riserva per browser vecchi) non servono e pesano ~60 MB
let tolte = 0;
(function prune(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) prune(f);
    else if (f.endsWith(".png") && fs.existsSync(f.slice(0, -4) + ".webp")) { fs.rmSync(f); tolte++; }
  }
})(path.join(www, "img"));
console.log("www pronta:", www, "- PNG doppie tolte:", tolte);
