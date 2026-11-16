const CORE = "owl-core-v1";
const AUDIO = "owl-audio-v1";
const PHOTOS = "owl-photos-v1";
const META = "owl-meta";
const MARK = "/offline-pack";

const SHELL = [
  "./",
  "index.html",
  "favicon.svg",
  "manifest.webmanifest",
  "css/styles.css",
  "css/fonts.css",
  "js/app.js",
  "js/data.js",
  "js/land.js",
  "js/pwa.js",
  "q/",
  "q/index.html",
  "q/quiz.css",
  "q/quiz.js",
  "v",
  "v/",
  "v/index.html",
  "v/voice.css",
  "v/voice.js",
  "h/",
  "h/index.html",
  "h/film.css",
  "h/film.js",
  "h/frames.js",
  "fonts/golos-cyrillic.woff2",
  "fonts/golos-latin-ext.woff2",
  "fonts/golos-latin.woff2",
  "fonts/spectral-500i-cyrillic.woff2",
  "fonts/spectral-500i-latin-ext.woff2",
  "fonts/spectral-500i-latin.woff2",
  "fonts/spectral-600-cyrillic.woff2",
  "fonts/spectral-600-latin-ext.woff2",
  "fonts/spectral-600-latin.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

let photoJob = null;
let pack = null;
let enabling = null;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(forgetUnasked().then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "enable-offline") return;
  const urls = (event.data.urls || []).map(photoUrl).filter(Boolean);
  event.waitUntil(enableOffline(urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.href === self.location.href) return;
  event.respondWith(route(request, event, url));
});

function fromRoot(path) {
  return new URL(path, self.registration.scope);
}

function relativePath(url) {
  const base = new URL(self.registration.scope).pathname;
  if (url.pathname.startsWith(base)) return url.pathname.slice(base.length);
  return url.pathname.replace(/^\//, "");
}

async function packEnabled() {
  if (pack !== null) return pack;
  const keys = await caches.keys();
  if (!keys.includes(META)) {
    pack = false;
    return false;
  }
  const cache = await caches.open(META);
  pack = !!(await cache.match(MARK));
  return pack;
}

async function forgetUnasked() {
  if (await packEnabled()) return;
  await caches.delete(CORE);
  await caches.delete(AUDIO);
  await caches.delete(PHOTOS);
}

async function enableOffline(urls) {
  if (enabling) return enabling;
  enabling = (async () => {
    if (!(await packEnabled())) {
      await cacheApp();
      const cache = await caches.open(META);
      await cache.put(MARK, new Response("1"));
      pack = true;
    }
    await prefetchPhotos(urls);
  })().finally(() => {
    enabling = null;
  });
  return enabling;
}

async function route(request, event, url) {
  if (!(await packEnabled())) return fetch(request);
  const rel = relativePath(url);
  if (request.mode === "navigate" || isShell(rel)) return networkFirst(request, CORE);
  if (rel.startsWith("media/audio/") && /\.(mp3|ogg)$/i.test(rel)) return audioResponse(request, event);
  if (/\.jpe?g$/i.test(rel)) return photoResponse(request);
  return fetch(request);
}

async function cacheApp() {
  const cache = await caches.open(CORE);
  await addBatched(cache, SHELL.map((path) => fromRoot(path).href));
  const audio = await voiceUrls();
  const sounds = await caches.open(AUDIO);
  await addBatched(sounds, audio);
}

async function voiceUrls() {
  const response = await fetch(fromRoot("js/data.js"));
  if (!response.ok) throw new Error("Не удалось прочитать каталог голосов");
  const source = await response.text();
  const urls = new Set();
  for (const match of source.matchAll(/src: "(media\/audio\/[^"]+)"/g)) urls.add(fromRoot(match[1]).href);
  return [...urls];
}

async function addBatched(cache, urls) {
  for (let index = 0; index < urls.length; index += 4) {
    await cache.addAll(urls.slice(index, index + 4));
  }
}

function isShell(pathname) {
  return /\.(?:html|css|js|mjs|svg|woff2|webmanifest)$/i.test(pathname) || pathname.startsWith("icons/");
}

function photoUrl(value) {
  let url;
  try {
    url = new URL(value, self.location.origin);
  } catch (error) {
    return "";
  }
  if (url.origin !== self.location.origin) return "";
  if (!/\.jpe?g$/i.test(url.pathname)) return "";
  return url.href;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok && response.status === 200) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("Нет сети, и эта страница ещё не сохранена.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function audioResponse(request, event) {
  const cache = await caches.open(AUDIO);
  const cached = await cache.match(request.url);
  if (cached) {
    const range = request.headers.get("range");
    if (!range) return cached;
    return sliceRange(cached, range);
  }
  if (request.headers.get("range")) {
    event.waitUntil(storeAudio(request.url));
    return fetch(request);
  }
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request.url, response.clone());
  return response;
}

async function storeAudio(url) {
  const cache = await caches.open(AUDIO);
  if (await cache.match(url)) return;
  const response = await fetch(url);
  if (response.ok && response.status === 200) await cache.put(url, response);
}

async function photoResponse(request) {
  const cache = await caches.open(PHOTOS);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request.url, response.clone());
  return response;
}

async function sliceRange(response, rangeHeader) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return response;
  const buffer = await response.clone().arrayBuffer();
  const size = buffer.byteLength;
  let start;
  let end;
  if (match[1] === "" && match[2] !== "") {
    const suffix = Number(match[2]);
    start = Number.isFinite(suffix) ? Math.max(0, size - suffix) : 0;
    end = size - 1;
  } else {
    start = match[1] === "" ? 0 : Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` }
    });
  }
  const last = Math.min(end, size - 1);
  if (start === 0 && last === size - 1) return response;
  const chunk = buffer.slice(start, last + 1);
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(chunk.byteLength));
  headers.set("Content-Range", `bytes ${start}-${last}/${size}`);
  return new Response(chunk, { status: 206, statusText: "Partial Content", headers });
}

async function prefetchPhotos(urls) {
  if (photoJob) return photoJob;
  photoJob = downloadPhotos(urls).finally(() => {
    photoJob = null;
  });
  return photoJob;
}

async function downloadPhotos(urls) {
  const unique = [...new Set(urls)];
  const cache = await caches.open(PHOTOS);
  const pending = [];
  let done = 0;
  for (const url of unique) {
    if (await cache.match(url)) done += 1;
    else pending.push(url);
  }
  const total = unique.length;
  if (!pending.length) {
    await report(done, total, 0, true);
    return;
  }
  await report(done, total, 0, false);
  let failed = 0;
  let cursor = 0;
  let stopped = false;

  async function worker() {
    while (!stopped && cursor < pending.length) {
      const url = pending[cursor];
      cursor += 1;
      try {
        const response = await fetch(url);
        if (!response.ok || response.status !== 200) throw new Error("status");
        await cache.put(url, response);
      } catch (error) {
        failed += 1;
        if (error && error.name === "QuotaExceededError") {
          stopped = true;
          await report(done, total, failed, true, "storage");
          return;
        }
        const offline = !error || error.name === "TypeError";
        if (offline && failed >= 3 && done === total - pending.length) {
          stopped = true;
          await report(done, total, failed, true, "offline");
          return;
        }
      }
      done += 1;
      await report(done, total, failed, false);
    }
  }

  await Promise.all([worker(), worker()]);
  if (!stopped) await report(done, total, failed, true, failed ? "partial" : "");
}

async function report(done, total, failed, finished, reason) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const message = { type: "photos", done, total, failed, finished: !!finished, reason: reason || "" };
  for (const client of clients) client.postMessage(message);
}
