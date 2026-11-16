const pwaScript = document.currentScript;

(function () {
  if (!("serviceWorker" in navigator) || !pwaScript) return;

  const root = new URL("../", pwaScript.src);
  let status = null;
  let starting = false;

  function installedApp() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function ensureStatus() {
    if (status) return status;
    status = document.createElement("p");
    status.className = "pwa-status";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    document.body.appendChild(status);
    const style = document.createElement("style");
    style.textContent = ".pwa-status{position:fixed;z-index:8;left:50%;bottom:18px;transform:translateX(-50%);max-width:calc(100% - 28px);margin:0;padding:8px 14px;border-radius:999px;border:1px solid rgba(226,177,90,.45);background:rgba(20,18,14,.94);color:#f4f0e6;font:14px/1.35 \"Golos Text\",\"Segoe UI\",sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.28);pointer-events:none}.pwa-status[hidden]{display:none !important}";
    document.head.appendChild(style);
    const place = () => {
      const dock = document.querySelector("#dock");
      const listen = document.querySelector("#listen");
      const raised = (dock && !dock.hidden) || (listen && !listen.hidden);
      status.style.bottom = raised ? "96px" : "18px";
    };
    place();
    const dock = document.querySelector("#dock");
    const listen = document.querySelector("#listen");
    if (dock) new MutationObserver(place).observe(dock, { attributes: true, attributeFilter: ["hidden"] });
    if (listen) new MutationObserver(place).observe(listen, { attributes: true, attributeFilter: ["hidden"] });
    return status;
  }

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "photos" || !status) return;
    if (data.finished && !data.failed && !data.reason) {
      status.hidden = true;
      return;
    }
    if (data.reason === "storage") {
      status.hidden = false;
      status.textContent = "Памяти хватило не на все фотографии";
      return;
    }
    if (data.reason === "offline") {
      status.hidden = false;
      status.textContent = "Фотографии скачаются, когда появится сеть";
      return;
    }
    if (data.finished && data.reason === "partial") {
      status.hidden = false;
      status.textContent = `Скачано ${data.done - data.failed} из ${data.total} фотографий`;
      return;
    }
    if (!data.finished) {
      status.hidden = false;
      status.textContent = `Фотографии скачиваются · ${data.done} из ${data.total}`;
    }
  });

  async function startOffline(worker) {
    if (starting || !worker) return;
    starting = true;
    const note = ensureStatus();
    note.hidden = false;
    note.textContent = "Сохраняем тексты и голоса…";
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    const urls = await photoUrls(root);
    worker.postMessage({ type: "enable-offline", urls });
  }

  navigator.serviceWorker.register(new URL("../sw.js", pwaScript.src), {
    scope: root.pathname,
    updateViaCache: "none"
  }).then(() => navigator.serviceWorker.ready).then((ready) => {
    const worker = ready.active || navigator.serviceWorker.controller;
    if (installedApp()) startOffline(worker);
    window.addEventListener("appinstalled", () => startOffline(worker));
  }).catch(() => {});
})();

async function photoUrls(root) {
  const urls = new Set();
  if (window.OWLS) {
    for (const owl of window.OWLS) addOwlPhotos(urls, root, owl);
  } else {
    try {
      const source = await fetch(new URL("js/data.js", root)).then((response) => response.text());
      for (const path of photosInCatalog(source)) urls.add(new URL(path, root).href);
    } catch (error) {
      /* Каталог дочитается при следующем открытии. */
    }
  }
  try {
    const frames = await fetch(new URL("h/frames.js", root)).then((response) => response.text());
    for (const match of frames.matchAll(/photos\/\d+\.jpg/g)) {
      urls.add(new URL(`h/${match[0]}`, root).href);
    }
  } catch (error) {
    /* Кадры фильма докачаются вместе со следующим открытием. */
  }
  return [...urls];
}

function addOwlPhotos(urls, root, owl) {
  const count = (owl.photos || []).length;
  for (let index = 1; index <= count; index += 1) {
    urls.add(new URL(`media/photos/${owl.id}-${index}.jpg`, root).href);
  }
}

function photosInCatalog(source) {
  const owls = source.split("window.MIMICS")[0];
  const paths = [];
  for (const part of owls.split(/\bid: "/).slice(1)) {
    const idEnd = part.indexOf('"');
    const photosAt = part.indexOf("photos:");
    if (idEnd < 0 || photosAt < 0) continue;
    const id = part.slice(0, idEnd);
    const body = part.slice(photosAt, part.indexOf("]", photosAt));
    const count = (body.match(/\{/g) || []).length;
    for (let index = 1; index <= count; index += 1) paths.push(`media/photos/${id}-${index}.jpg`);
  }
  return paths;
}
