/* しーちゃんのタロット占い — service worker
   新しい版をGitHubに上げたら VERSION の数字を変えるだけで、ホーム画面のアプリも自動で新しくなります */
const VERSION = "tarot-v1.0.1";
const FILES = [
  "./", "index.html", "manifest.json",
  "icon-180.png", "icon-192.png", "icon-512.png",
  "logo.png", "guide-home.jpg",
  "shi-normal.png", "shi-serious.png", "shi-joy.png", "shi-surprise.png", "shi-worry.png", "shi-angry.png",
  "key-ramune.png", "key-hibiscus.png", "key-sakura.png", "key-mango.png", "key-himawari.png",
  "key-umi.png", "key-beniimo.png", "key-yozora.png", "key-kuro.png", "key-midori.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // AIへの通信はそのまま通す

  const isPage = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/") ||
                 url.pathname.endsWith("sw.js") || url.pathname.endsWith("manifest.json");
  if (isPage) {
    // 画面は「まず最新を取りに行く」→ ダメならしまってある版
    e.respondWith(
      fetch(req, { cache: "no-store" }).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("index.html")))
    );
    return;
  }
  // 画像など：しまってある物をすぐ出して、裏で新しくする
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
