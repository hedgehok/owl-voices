const audio = document.querySelector("#player");
const app = document.querySelector("#app");
const lightbox = document.querySelector("#lightbox");
const GROUPS = [
  { id: "all", label: "Все" },
  { id: "forest", label: "Лес" },
  { id: "taiga", label: "Тайга" },
  { id: "tundra", label: "Тундра" },
  { id: "open", label: "Открытые места" },
  { id: "south", label: "Юг" }
];
const LICENSES = {
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
  "CC BY-SA 2.5": "https://creativecommons.org/licenses/by-sa/2.5/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-NC 4.0": "https://creativecommons.org/licenses/by-nc/4.0/",
  "CC BY-NC-SA 4.0": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC0": "https://creativecommons.org/publicdomain/zero/1.0/"
};

let query = "";
let group = "all";
let photoIndex = 0;
let waveToken = 0;
let waveCache = new Map();
let tourToken = 0;
let touring = false;
let tourTimer = 0;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function filePage(name) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replaceAll(" ", "_"))}`;
}

function sourceHref(item) {
  return item.href || filePage(item.file);
}

function sourceName(item) {
  const href = sourceHref(item);
  if (href.includes("inaturalist.org")) return "iNaturalist";
  if (href.includes("xeno-canto.org")) return "Xeno-canto";
  return "Wikimedia Commons";
}

function licenseLink(license) {
  const href = LICENSES[license];
  if (!href) return esc(license);
  return `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(license)}</a>`;
}

function norm(value) {
  return String(value).toLowerCase().replaceAll("ё", "е");
}

function owlById(id) {
  return window.OWLS.find((owl) => owl.id === id);
}

function mimicById(id) {
  return (window.MIMICS || []).find((item) => item.id === id);
}

function voiceById(id) {
  return owlById(id) || mimicById(id);
}

function clipIndex(source) {
  const raw = source?.dataset ? source.dataset.clip : source;
  if (raw === undefined || raw === null || raw === "") return 0;
  const index = Number(raw);
  return Number.isFinite(index) ? index : 0;
}

function callAt(owl, index) {
  return owl.calls[index] || owl.calls[0];
}

function routeId() {
  return decodeURIComponent(location.hash.replace(/^#\/?/, ""));
}

function photoSrc(owl, index) {
  return `media/photos/${owl.id}-${index + 1}.jpg`;
}

function project(lon, lat) {
  const map = window.MAP;
  return [
    ((lon - map.lon0) / (map.lon1 - map.lon0)) * map.w,
    ((map.lat1 - lat) / (map.lat1 - map.lat0)) * map.h
  ];
}

function fmt(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function playIcon() {
  return `<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg><svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.2v14H7zm6.8 0H17v14h-3.2z"/></svg>`;
}

function render() {
  const id = routeId();
  if (!id) renderCatalog();
  else if (owlById(id)) renderDetail(owlById(id));
  else if (mimicById(id)) renderMimic(mimicById(id));
  else renderMissing();
  syncPlaying();
}

function renderCatalog() {
  document.title = "Ночные голоса — атлас сов";
  const cards = window.OWLS.map((owl, index) => {
    const voices = owl.calls.map((call) => `${call.title} ${call.when} ${call.hint}`).join(" ");
    const hay = norm([owl.name, owl.latin, owl.mnemonic, owl.place, owl.habitat, voices, ...owl.about].join(" "));
    return `<article class="card" data-id="${owl.id}" data-groups="${owl.groups.join(",")}" data-hay="${esc(hay)}">
      <a class="card-photo" href="#/${owl.id}"><img src="${photoSrc(owl, 0)}" alt="${esc(owl.photos[0].alt)}" ${index < 4 ? "loading=\"eager\"" : "loading=\"lazy\""}></a>
      <div class="card-body">
        <div class="card-title">
          <a href="#/${owl.id}"><h2>${esc(owl.name)}</h2></a>
          <button class="play" type="button" data-play="${owl.id}" aria-label="Слушать: ${esc(owl.name)}">${playIcon()}</button>
        </div>
        <p class="latin">${esc(owl.latin)}</p>
        <p class="mnemonic">«${esc(owl.mnemonic)}»</p>
        <p class="place">${esc(owl.place)}</p>
      </div>
    </article>`;
  }).join("");
  const mimics = (window.MIMICS || []).map((item) => {
    const call = item.calls[0];
    const hay = norm([item.name, item.latin, item.line, item.note, call.title, call.when, call.hint].join(" "));
    return `<article class="mimic" data-id="${item.id}" data-hay="${esc(hay)}">
      <div class="mimic-title">
        <a href="#/${item.id}"><h3>${esc(item.name)}</h3></a>
        <button class="play" type="button" data-play="${item.id}" aria-label="Слушать: ${esc(item.name)}">${playIcon()}</button>
      </div>
      <p class="latin">${esc(item.latin)}</p>
      <p class="place">${esc(item.note)}</p>
    </article>`;
  }).join("");
  const filters = GROUPS.map((item) => `<button class="filter${item.id === group ? " is-on" : ""}" type="button" data-group="${item.id}" aria-pressed="${item.id === group}">${item.label}</button>`).join("");
  app.innerHTML = `<section class="hero">
      <div>
        <p class="eyebrow">Полевой атлас · ${window.OWLS.length} видов</p>
        <h1>Голоса сов</h1>
        <p class="lede">Совы северной Евразии. Откройте вид — или включите голос прямо в списке и сравните, кто как говорит.</p>
      </div>
      <button class="tour" type="button" data-tour aria-pressed="${touring}">${touring ? "Остановить экскурсию" : "Слушать подряд"}</button>
    </section>
    <div class="toolbar">
      <div class="filters" role="group" aria-label="Места обитания">${filters}</div>
      <label class="search"><input id="q" type="search" placeholder="Имя, латынь или голос" value="${esc(query)}" autocomplete="off"></label>
    </div>
    <div class="grid">${cards}</div>
    <p class="empty" hidden>Ничего не нашлось. Попробуйте «неясыть» или «у-ху».</p>
    <section class="mimics">
      <h2>Это не сова</h2>
      <p class="mimic-lead">Ночные голоса, которые часто принимают за уханье.</p>
      <div class="mimic-grid">${mimics}</div>
    </section>
    <p class="map-note">Фотографии и записи — на условиях Creative Commons. Авторы и лицензии указаны на странице каждого вида.</p>`;
  applyFilter();
}

function renderDetail(owl) {
  document.title = `${owl.name} — Ночные голоса`;
  photoIndex = 0;
  const facts = [
    ["Длина", owl.length],
    ["Размах", owl.wingspan],
    ["Масса", owl.weight],
    ["Когда активна", owl.activity],
    ["Добыча", owl.diet],
    ["Когда слышно", owl.season]
  ].map(([term, value]) => `<dt>${esc(term)}</dt><dd>${esc(value)}</dd>`).join("");
  const thumbs = owl.photos.map((photo, index) => `<button class="thumb" type="button" data-photo="${index}" aria-label="Фото ${index + 1}" ${index === 0 ? 'aria-current="true"' : ""}><img src="${photoSrc(owl, index)}" alt=""></button>`).join("");
  const similar = owl.similar.map((item) => {
    const other = owlById(item.id);
    return `<a href="#/${other.id}"><img src="${photoSrc(other, 0)}" alt=""><div><h3>${esc(other.name)}</h3><p>${esc(item.note)}</p></div></a>`;
  }).join("");
  const credits = [
    ...owl.photos.map((photo, index) => `<li>Фото ${index + 1}: ${esc(photo.author)}. <a href="${esc(sourceHref(photo))}" target="_blank" rel="noopener">${esc(sourceName(photo))}</a>, ${licenseLink(photo.license)}.</li>`),
    ...owl.calls.map((call) => `<li>Запись «${esc(call.title)}»: ${esc(call.author)}. <a href="${esc(sourceHref(call))}" target="_blank" rel="noopener">${esc(call.via)}</a>, ${licenseLink(call.license)}.</li>`)
  ].join("");
  const calls = owl.calls.map((call, index) => {
    const nc = call.license.includes("NC")
      ? `<p class="license-note">Запись под лицензией ${esc(call.license)}: её можно слушать и хранить в некоммерческом учебном проекте, с указанием автора.</p>`
      : "";
    return `<section class="voice-call">
        <h3>${esc(call.title)}</h3>
        <p class="when">${esc(call.when)}</p>
        <p class="hint">${esc(call.hint)}</p>
        <div class="player">
          <button class="play" type="button" data-play="${owl.id}" data-clip="${index}" aria-label="Слушать: ${esc(owl.name)}, ${esc(call.title)}">${playIcon()}</button>
          <div class="wave" data-clip="${index}" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Позиция: ${esc(call.title)}"><canvas></canvas><div class="shade"></div></div>
          <div class="times"><span class="now">0:00</span><span class="dur">0:00</span></div>
        </div>
        ${nc}
      </section>`;
  }).join("");
  const repertoire = owl.calls.length > 1
    ? `<p class="repertoire">В каталоге звучит первый голос — по нему этот вид узнают.</p>`
    : "";
  app.innerHTML = `<a class="back" href="#/">← К каталогу</a>
    <article class="species">
      <header class="species-head">
        <div>
          <p class="eyebrow">${esc(owl.latin)}</p>
          <h1>${esc(owl.name)}</h1>
          <p class="voice-line">«${esc(owl.mnemonic)}»</p>
        </div>
        <p class="status" data-status="${esc(owl.status)}">${esc(owl.statusText)}</p>
      </header>
      <div class="species-grid">
        <div class="gallery">
          <button class="hero-photo" type="button" data-lightbox aria-label="Открыть фото крупно"><img src="${photoSrc(owl, 0)}" alt="${esc(owl.photos[0].alt)}"></button>
          <div class="thumbs">${thumbs}</div>
          <p class="caption"></p>
        </div>
        <aside class="voice-panel">
          <p class="eyebrow">Голос</p>
          ${repertoire}
          <div class="calls">${calls}</div>
          <dl class="facts">${facts}</dl>
        </aside>
      </div>
      <div class="stack">
        <section class="prose"><h2>Коротко о виде</h2>${owl.about.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</section>
        <section class="habitat">
          <div>
            <h2>Где живёт</h2>
            <p>${esc(owl.habitat)}</p>
            <ul class="chips">${owl.biomes.map((biome) => `<li>${esc(biome)}</li>`).join("")}</ul>
          </div>
          ${mapMarkup(owl)}
        </section>
        <section class="similar"><h2>Не перепутать</h2><div class="similar-list">${similar}</div></section>
        <details class="credits"><summary>Источники фотографий и записи</summary><ul>${credits}</ul></details>
      </div>
    </article>`;
  showPhoto(0);
  drawWave(owl);
  syncProgress();
}

function mapMarkup(owl) {
  const map = window.MAP;
  const blobs = owl.range.map((blob) => {
    const [cx, cy] = project(blob.lon, blob.lat);
    const rx = (blob.rx / (map.lon1 - map.lon0)) * map.w;
    const ry = (blob.ry / (map.lat1 - map.lat0)) * map.h;
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"></ellipse>`;
  }).join("");
  const labels = [
    ["Европа", 10, 51],
    ["Средиземноморье", 18, 36],
    ["Сибирь", 95, 62],
    ["Арктика", 70, 76],
    ["Америка", -115, 52]
  ].map(([name, lon, lat]) => {
    const [x, y] = project(lon, lat);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${name}</text>`;
  }).join("");
  return `<div class="map-card">
    <svg viewBox="0 0 ${map.w} ${map.h}" role="img" aria-label="Схема ареала: ${esc(owl.name)}">
      <path class="land" d="${map.land}"></path>
      <g class="range">${blobs}</g>
      <g class="map-labels">${labels}</g>
    </svg>
    <p class="map-note">Схема гнездового ареала, не точная граница. Светлым отмечено, где вид обычно гнездится.</p>
  </div>`;
}

function renderMimic(item) {
  document.title = `${item.name} — Ночные голоса`;
  const call = item.calls[0];
  const nc = call.license.includes("NC")
    ? `<p class="license-note">Запись под лицензией ${esc(call.license)}: её можно слушать и хранить в некоммерческом учебном проекте, с указанием автора.</p>`
    : "";
  app.innerHTML = `<a class="back" href="#/">← К каталогу</a>
    <article class="mimic-page">
      <header>
        <p class="eyebrow">Это не сова</p>
        <h1>${esc(item.name)}</h1>
        <p class="latin">${esc(item.latin)}</p>
      </header>
      <p class="mimic-lead">${esc(item.note)}</p>
      <section class="voice-call">
        <h3>${esc(call.title)}</h3>
        <p class="when">${esc(call.when)}</p>
        <p class="hint">${esc(call.hint)}</p>
        <div class="player">
          <button class="play" type="button" data-play="${item.id}" data-clip="0" aria-label="Слушать: ${esc(item.name)}, ${esc(call.title)}">${playIcon()}</button>
          <div class="wave" data-clip="0" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Позиция: ${esc(call.title)}"><canvas></canvas><div class="shade"></div></div>
          <div class="times"><span class="now">0:00</span><span class="dur">0:00</span></div>
        </div>
        ${nc}
      </section>
      <details class="credits"><summary>Источник записи</summary><ul><li>Запись «${esc(call.title)}»: ${esc(call.author)}. <a href="${esc(sourceHref(call))}" target="_blank" rel="noopener">${esc(call.via)}</a>, ${licenseLink(call.license)}.</li></ul></details>
    </article>`;
  drawWave(item);
  syncProgress();
}

function renderMissing() {
  document.title = "Вид не найден — Ночные голоса";
  app.innerHTML = `<a class="back" href="#/">← К каталогу</a><section class="prose"><h1>Такой совы в атласе нет</h1><p>Вернитесь к списку и выберите вид оттуда.</p></section>`;
}

function applyFilter() {
  const needle = norm(query.trim());
  let visible = 0;
  document.querySelectorAll(".card").forEach((card) => {
    const groups = card.dataset.groups.split(",");
    const matches = (!needle || card.dataset.hay.includes(needle)) && (group === "all" || groups.includes(group));
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  let mimics = 0;
  document.querySelectorAll(".mimic").forEach((card) => {
    const matches = !needle || card.dataset.hay.includes(needle);
    card.hidden = !matches;
    if (matches) mimics += 1;
  });
  const section = document.querySelector(".mimics");
  if (section) section.hidden = needle.length > 0 && mimics === 0;
  const empty = document.querySelector(".empty");
  if (empty) empty.hidden = visible !== 0 || mimics !== 0;
}

function showPhoto(index) {
  const owl = owlById(routeId());
  if (!owl) return;
  photoIndex = (index + owl.photos.length) % owl.photos.length;
  const photo = owl.photos[photoIndex];
  const hero = document.querySelector(".hero-photo img");
  if (!hero) return;
  hero.src = photoSrc(owl, photoIndex);
  hero.alt = photo.alt;
  document.querySelector(".caption").innerHTML = `${esc(photo.author)} · ${licenseLink(photo.license)}`;
  document.querySelectorAll(".thumb").forEach((thumb, thumbIndex) => {
    if (thumbIndex === photoIndex) thumb.setAttribute("aria-current", "true");
    else thumb.removeAttribute("aria-current");
  });
  const frame = lightbox.querySelector("img");
  frame.src = hero.src;
  frame.alt = photo.alt;
}

async function drawWave(owl) {
  const token = ++waveToken;
  await Promise.all(owl.calls.map(async (call, index) => {
    const canvas = document.querySelector(`.wave[data-clip="${index}"] canvas`);
    if (!canvas) return;
    try {
      let cached = waveCache.get(call.src);
      if (!cached) {
        const response = await fetch(call.src);
        const buffer = await response.arrayBuffer();
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(buffer.slice(0));
        const channel = decoded.getChannelData(0);
        const bars = 96;
        const peaks = [];
        const step = Math.floor(channel.length / bars);
        for (let i = 0; i < bars; i += 1) {
          let peak = 0;
          for (let j = 0; j < step; j += 24) peak = Math.max(peak, Math.abs(channel[i * step + j] || 0));
          peaks.push(peak);
        }
        cached = { peaks, duration: decoded.duration };
        waveCache.set(call.src, cached);
        context.close();
      }
      if (token !== waveToken) return;
      paintWave(canvas, cached.peaks);
    } catch (error) {
      paintWave(canvas, []);
    }
  }));
  if (token === waveToken) syncProgress();
}

function paintWave(canvas, peaks) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 74;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);
  const count = peaks.length || 64;
  const gap = width / count;
  ctx.fillStyle = "#e2b15a";
  for (let i = 0; i < count; i += 1) {
    const amp = peaks.length ? peaks[i] : 0.18 + ((i * 17) % 7) / 28;
    const bar = Math.max(3, amp * height * 1.7);
    ctx.globalAlpha = 0.45 + amp;
    ctx.fillRect(i * gap + 1, (height - bar) / 2, Math.max(2, gap - 2.2), bar);
  }
}

function toggle(id, clip = 0) {
  const owl = voiceById(id);
  if (!owl) return;
  const call = callAt(owl, clip);
  const index = owl.calls[clip] ? clip : 0;
  if (touring) stopTour(false);
  const same = audio.dataset.id === id && clipIndex(audio) === index;
  if (same && !audio.paused) {
    audio.pause();
    return;
  }
  if (!same) {
    audio.dataset.id = id;
    audio.dataset.clip = String(index);
    audio.src = call.src;
  }
  audio.play().catch(() => {});
}

function stopAll() {
  stopTour(false);
  audio.pause();
  audio.currentTime = 0;
}

function stopTour(pause) {
  touring = false;
  tourToken += 1;
  clearTimeout(tourTimer);
  if (pause) audio.pause();
  const button = document.querySelector("[data-tour]");
  if (button) {
    button.textContent = "Слушать подряд";
    button.setAttribute("aria-pressed", "false");
  }
}

async function startTour() {
  touring = true;
  const token = ++tourToken;
  const button = document.querySelector("[data-tour]");
  if (button) {
    button.textContent = "Остановить экскурсию";
    button.setAttribute("aria-pressed", "true");
  }
  const owls = [...document.querySelectorAll(".card:not([hidden])")]
    .map((card) => owlById(card.dataset.id))
    .filter(Boolean);
  for (const owl of owls) {
    if (token !== tourToken) return;
    document.querySelector(`[data-id="${owl.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    await playLimited(owl, 14000, token);
  }
  if (token === tourToken) stopTour(true);
}

function playLimited(owl, limit, token) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", finish);
      clearTimeout(tourTimer);
      resolve();
    };
    audio.addEventListener("ended", finish);
    audio.dataset.id = owl.id;
    audio.dataset.clip = "0";
    audio.src = owl.calls[0].src;
    audio.play().then(() => {
      if (token !== tourToken) {
        finish();
        return;
      }
      tourTimer = setTimeout(() => {
        if (token !== tourToken) {
          finish();
          return;
        }
        audio.pause();
        finish();
      }, limit);
    }).catch(finish);
  });
}

function syncPlaying() {
  const id = audio.dataset.id || "";
  const clip = audio.dataset.clip || "0";
  const playing = Boolean(id) && !audio.paused;
  const owl = voiceById(id);
  const dock = document.querySelector(".dock");
  const showDock = playing && owl && routeId() !== id;
  if (showDock) {
    dock.hidden = false;
    const button = dock.querySelector("[data-play]");
    button.dataset.play = id;
    button.dataset.clip = clip;
    dock.querySelector(".dock-name").textContent = owl.name;
    dock.querySelector(".dock-sub").textContent = callAt(owl, Number(clip)).title;
  } else {
    dock.hidden = true;
  }
  document.querySelectorAll("[data-play]").forEach((button) => {
    const on = playing && button.dataset.play === id && String(clipIndex(button)) === clip;
    button.classList.toggle("is-on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
    if (button.closest(".dock")) button.setAttribute("aria-label", on ? "Пауза" : "Продолжить");
  });
  document.querySelectorAll(".card, .mimic").forEach((card) => {
    card.classList.toggle("is-playing", playing && card.dataset.id === id);
  });
}

function clipDuration() {
  if (Number.isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  const owl = voiceById(audio.dataset.id);
  const call = owl && callAt(owl, clipIndex(audio));
  const cached = call && waveCache.get(call.src);
  return cached?.duration || 0;
}

function syncProgress() {
  const owl = voiceById(routeId());
  if (!owl) return;
  const playingHere = audio.dataset.id === owl.id;
  const active = playingHere ? clipIndex(audio) : -1;
  document.querySelectorAll(".voice-call").forEach((row, index) => {
    const call = owl.calls[index];
    const cached = waveCache.get(call.src);
    const activeRow = playingHere && index === active;
    const duration = activeRow ? clipDuration() : (cached?.duration || 0);
    const ratio = activeRow && duration ? audio.currentTime / duration : 0;
    const shade = row.querySelector(".shade");
    const wave = row.querySelector(".wave");
    if (shade) shade.style.width = `${(1 - ratio) * 100}%`;
    if (wave) wave.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    const now = row.querySelector(".now");
    const dur = row.querySelector(".dur");
    if (now) now.textContent = fmt(activeRow ? audio.currentTime : 0);
    if (dur) dur.textContent = fmt(duration);
  });
}

function seek(event) {
  const wave = event.target.closest(".wave");
  const owl = voiceById(routeId());
  const duration = clipDuration();
  if (!wave || !owl || !duration || audio.dataset.id !== owl.id || clipIndex(audio) !== clipIndex(wave)) return;
  const rect = wave.getBoundingClientRect();
  const clientX = event.clientX ?? rect.left + rect.width / 2;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  audio.currentTime = ratio * duration;
}

document.body.addEventListener("click", (event) => {
  const play = event.target.closest("[data-play]");
  if (play) {
    event.preventDefault();
    toggle(play.dataset.play, clipIndex(play));
    return;
  }
  if (event.target.closest("[data-stop]")) {
    stopAll();
    return;
  }
  const tour = event.target.closest("[data-tour]");
  if (tour) {
    if (touring) stopTour(true);
    else startTour();
    return;
  }
  const filter = event.target.closest("[data-group]");
  if (filter) {
    group = filter.dataset.group;
    document.querySelectorAll("[data-group]").forEach((button) => {
      const on = button.dataset.group === group;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    applyFilter();
    return;
  }
  const thumb = event.target.closest("[data-photo]");
  if (thumb) {
    showPhoto(Number(thumb.dataset.photo));
    return;
  }
  if (event.target.closest("[data-lightbox]")) {
    const frame = lightbox.querySelector("img");
    const hero = document.querySelector(".hero-photo img");
    frame.src = hero.src;
    frame.alt = hero.alt;
    lightbox.showModal();
    return;
  }
  const wave = event.target.closest(".wave");
  if (wave) {
    const owl = voiceById(routeId());
    if (!owl) return;
    const index = clipIndex(wave);
    if (audio.dataset.id !== owl.id || clipIndex(audio) !== index) {
      toggle(owl.id, index);
      audio.addEventListener("loadedmetadata", () => seek(event), { once: true });
      return;
    }
    seek(event);
  }
});

document.body.addEventListener("input", (event) => {
  if (event.target.id !== "q") return;
  query = event.target.value;
  applyFilter();
});

document.body.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  if (event.target.closest("input")) return;
  const waveKey = event.target.closest(".wave");
  if (waveKey && audio.dataset.id === routeId() && clipIndex(audio) === clipIndex(waveKey) && clipDuration()) {
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 5 : -5;
    audio.currentTime = Math.min(clipDuration(), Math.max(0, audio.currentTime + delta));
    return;
  }
  if (owlById(routeId())) showPhoto(photoIndex + (event.key === "ArrowRight" ? 1 : -1));
});

lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox || event.target.closest("[data-close]")) lightbox.close();
});

audio.addEventListener("play", syncPlaying);
audio.addEventListener("pause", syncPlaying);
audio.addEventListener("ended", () => {
  syncPlaying();
  syncProgress();
});
audio.addEventListener("timeupdate", syncProgress);
audio.addEventListener("loadedmetadata", syncProgress);
window.addEventListener("hashchange", () => {
  if (touring) stopTour(false);
  render();
  window.scrollTo(0, 0);
});

render();
