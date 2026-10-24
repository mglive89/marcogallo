// Offline: the app shell is cached per version; heavy assets (photos, vision engine, model, fonts) live in a
// separate cache kept across updates, where only files whose hash changed in assets.json are dropped.
const CACHE = "recluta-v62";
const ASSETS = "fq-assets";
const CORE = ["./", "index.html", "manifest.webmanifest", "vision_bundle.mjs", "peerjs.min.js", "icons/icon-192.png"];
const isAsset = p => /\/(img|wasm|icons)\/|pose_landmarker_lite\.task$/.test(p);
const FONT = /^https:\/\/fonts\.(googleapis|gstatic)\.com$/;
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
async function pruneAssets() {
  try {
    const r = await fetch("assets.json", { cache: "no-store" }); if (!r.ok) return;
    const now = await r.clone().json();
    const c = await caches.open(ASSETS);
    const oldR = await c.match("__assets.json"); const old = oldR ? await oldR.json() : null;
    const base = new URL("./", self.registration.scope).href;
    for (const req of await c.keys()) {
      const p = req.url.startsWith(base) ? req.url.slice(base.length).split("?")[0] : null;
      if (!p || p === "__assets.json") continue;
      if (!(p in now) || (old && old[p] !== now[p])) await c.delete(req);
    }
    await c.put("__assets.json", r);
  } catch {}
}
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== ASSETS).map(k => caches.delete(k)))).then(pruneAssets).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // web fonts: kept so the app looks the same offline
  if (FONT.test(url.origin)) {
    e.respondWith(caches.open(ASSETS).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // the test copy of the app in /prova/ and the prize dashboard in /premi/ are never cached, so they can't replace the real app offline
  if (url.pathname.includes("/prova/") || url.pathname.includes("/premi/")) return;
  // the voice generator page and its phrase list always come from the network
  if (/voce\.html$|voice-phrases\.json$|voice\/manifest\.json$|assets\.json$/.test(url.pathname)) return;
  if (req.mode === "navigate") {
    // network first for the page, so updates arrive; cache when offline
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  const store = isAsset(url.pathname) ? ASSETS : CACHE;
  e.respondWith(caches.open(store).then(c => c.match(req, { ignoreSearch: store === ASSETS }).then(hit => hit || fetch(req).then(r => { if (r.ok && r.status === 200) c.put(req, r.clone()); return r; }))).catch(() => caches.match(req)));
});
// a tap on a challenge notification brings the app to the front
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => "focus" in x);
    if (c) { c.postMessage({ t: "fq-focus" }); return c.focus(); }
    return self.clients.openWindow("./");
  }));
});
