// Offline cache: app shell + pose model, so training works without signal once installed.
const CACHE = "recluta-v30";
const CORE = ["./", "index.html", "manifest.webmanifest", "vision_bundle.mjs", "peerjs.min.js", "pose_landmarker_lite.task", "icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts etc. go to the network
  // the voice generator page and its phrase list always come from the network
  if (/voce\.html$|voice-phrases\.json$|voice\/manifest\.json$/.test(url.pathname)) return;
  const isPage = req.mode === "navigate";
  if (isPage) {
    // network first for the page, so updates arrive; cache when offline
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put("index.html", c)); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })));
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
