const HOLD = 5000;
const FADE = 3400;
const LOAD_LIMIT = 8000;
const frames = window.FRAMES || [];
const slots = [document.getElementById("a"), document.getElementById("b"), document.getElementById("c")];
const credit = document.getElementById("credit");
const music = document.getElementById("music");
const listen = document.getElementById("listen");

let index = 0;
let front = 0;
let due = 0;
let beat = 0;
let soundOn = false;
let musicOpen = null;
const tokens = new WeakMap();

function wait(ms) {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    const end = performance.now() + ms;
    const tick = () => {
      const left = end - performance.now();
      if (left <= 0) resolve();
      else window.setTimeout(tick, Math.min(left, 250));
    };
    tick();
  });
}

function isVideo(frame) {
  return !!frame && typeof frame === "object";
}

function parts(slot) {
  return {
    img: slot.querySelector("img"),
    video: slot.querySelector("video")
  };
}

function claim(slot) {
  const token = (tokens.get(slot) || 0) + 1;
  tokens.set(slot, token);
  return token;
}

function owns(slot, token) {
  return tokens.get(slot) === token;
}

function whenReady(target, eventName, ready) {
  return new Promise((resolve) => {
    if (ready()) {
      resolve();
      return;
    }
    const finish = () => {
      target.removeEventListener(eventName, finish);
      target.removeEventListener("error", finish);
      resolve();
    };
    target.addEventListener(eventName, finish);
    target.addEventListener("error", finish);
    window.setTimeout(finish, LOAD_LIMIT);
  });
}

function stopVideo(video) {
  video.pause();
  delete video.dataset.clip;
  video.removeAttribute("src");
  video.load();
}

async function fill(slot, frame) {
  const token = claim(slot);
  const bit = parts(slot);
  if (!isVideo(frame)) {
    stopVideo(bit.video);
    bit.video.hidden = true;
    bit.img.hidden = false;
    if (bit.img.dataset.clip !== frame) {
      bit.img.dataset.clip = frame;
      bit.img.src = frame;
    }
    await whenReady(bit.img, "load", () => bit.img.complete && bit.img.naturalWidth);
    if (!owns(slot, token)) return;
    if (bit.img.decode) {
      try {
        await bit.img.decode();
      } catch (error) {
        /* A broken frame must not stop the loop. */
      }
    }
    return;
  }
  bit.img.hidden = true;
  bit.img.removeAttribute("src");
  delete bit.img.dataset.clip;
  bit.video.hidden = false;
  if (bit.video.dataset.clip !== frame.src) {
    bit.video.dataset.clip = frame.src;
    bit.video.src = frame.src;
  }
  await whenReady(bit.video, "loadeddata", () => bit.video.readyState >= 2);
  if (!owns(slot, token)) return;
  if (bit.video.currentTime > 0.04) {
    await new Promise((resolve) => {
      const finish = () => {
        bit.video.removeEventListener("seeked", finish);
        resolve();
      };
      bit.video.addEventListener("seeked", finish);
      try {
        bit.video.currentTime = 0;
      } catch (error) {
        finish();
      }
      window.setTimeout(finish, 2000);
    });
  }
  if (!owns(slot, token)) return;
  bit.video.pause();
}

function playVideo(slot, frame) {
  if (!isVideo(frame)) return;
  const video = slot.querySelector("video");
  const pending = video.play();
  if (pending) pending.catch(() => {});
}

function park(slot) {
  const video = slot.querySelector("video");
  if (!video.paused) video.pause();
}

async function retire(slot, shown) {
  const started = performance.now();
  while (parseFloat(getComputedStyle(shown).opacity) < 0.98 && performance.now() - started < 700) {
    await wait(32);
  }
  slot.style.transition = "none";
  slot.style.opacity = "0";
  slot.style.zIndex = "1";
  park(slot);
}

function showPrompt() {
  listen.hidden = false;
  document.documentElement.classList.add("needs-sound");
}

function hidePrompt() {
  listen.hidden = true;
  document.documentElement.classList.remove("needs-sound");
}

function untilNext(slot, frame) {
  const beat = HOLD + FADE;
  if (!isVideo(frame)) return beat;
  const duration = slot.querySelector("video").duration;
  const ms = Number.isFinite(duration) ? duration * 1000 : beat;
  return Math.max(beat, ms - FADE);
}

function place(incoming, outgoing) {
  const node = slots[incoming];
  slots[outgoing].style.zIndex = "2";
  node.style.zIndex = "1";
  node.style.transition = "none";
  node.style.opacity = "0";
  void node.offsetWidth;
  node.style.zIndex = "3";
  return node;
}

function schedule(stay) {
  const now = performance.now();
  if (due === 0 || now > due + 80) due = now;
  const hideAt = now + Math.min(FADE, stay);
  due += stay;
  beat = now;
  return hideAt;
}

function warm() {
  const urls = [];
  for (const frame of frames) {
    if (isVideo(frame) && !urls.includes(frame.src)) urls.push(frame.src);
  }
  for (const url of urls) fetch(url, { priority: "low" }).catch(() => {});
}

async function showNext() {
  const incoming = (front + 1) % 3;
  const outgoing = front;
  const spare = (front + 2) % 3;
  const nextIndex = (index + 1) % frames.length;
  const frame = frames[nextIndex];
  const following = frames[(nextIndex + 1) % frames.length];

  await fill(slots[incoming], frame);
  const node = place(incoming, outgoing);
  playVideo(node, frame);
  node.style.transition = "opacity " + FADE + "ms linear";
  node.style.opacity = "1";

  const stay = untilNext(node, frame);
  const hideAt = schedule(stay);
  index = nextIndex;
  front = incoming;
  credit.classList.toggle("on", index === 0);
  const preparing = fill(slots[spare], following);

  await wait(hideAt - performance.now());
  await retire(slots[outgoing], node);
  await wait(due - performance.now());
  await preparing;
}

async function presentFirst() {
  index = 0;
  front = 0;
  due = 0;
  beat = performance.now();
  await fill(slots[0], frames[0]);
  slots[0].style.zIndex = "2";
  slots[0].style.opacity = "1";
  playVideo(slots[0], frames[0]);
  credit.style.transition = "none";
  credit.classList.add("on");
  void credit.offsetWidth;
  credit.style.transition = "";
  const stay = isVideo(frames[0]) ? untilNext(slots[0], frames[0]) : HOLD;
  schedule(stay);
  const preparing = frames.length > 1
    ? fill(slots[1], frames[1])
    : Promise.resolve();
  warm();
  await wait(due - performance.now());
  await preparing;
}

async function openMusic() {
  if (soundOn && !music.paused) {
    hidePrompt();
    return;
  }
  music.volume = 0.8;
  music.loop = true;
  try {
    await music.play();
    soundOn = true;
    hidePrompt();
  } catch (error) {
    soundOn = false;
    showPrompt();
  }
}

function startMusic() {
  if (musicOpen) return musicOpen;
  musicOpen = openMusic().finally(() => {
    musicOpen = null;
  });
  return musicOpen;
}

async function keepAwake() {
  if (!navigator.wakeLock || document.visibilityState !== "visible") return;
  try {
    await navigator.wakeLock.request("screen");
  } catch (error) {
    /* The display may still sleep if the browser refuses the lock. */
  }
}

function watch() {
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const video = slots[front].querySelector("video");
    if (video && !video.hidden && video.paused && !video.ended && video.readyState >= 2) {
      video.play().catch(() => {});
    }
    if (soundOn && music.paused) music.play().catch(() => showPrompt());
    if (beat && performance.now() - beat > 180000) location.reload();
  }, 4000);
}

async function run() {
  if (!frames.length) return;
  startMusic();
  keepAwake();
  watch();
  await presentFirst();
  while (frames.length > 1) {
    try {
      await showNext();
    } catch (error) {
      try { sessionStorage.setItem("film-fail", String(error && error.stack || error)); } catch (storageError) { /* Keep the reload path. */ }
      let retries = 0;
      try { retries = Number(sessionStorage.getItem("film-reloads") || "0"); } catch (storageError) { retries = 3; }
      if (retries >= 3) return;
      try { sessionStorage.setItem("film-reloads", String(retries + 1)); } catch (storageError) { return; }
      location.reload();
      return;
    }
  }
}

listen.addEventListener("click", (event) => {
  event.stopPropagation();
  startMusic();
});
document.addEventListener("pointerdown", () => {
  keepAwake();
  startMusic();
});
document.addEventListener("keydown", startMusic);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  due = 0;
  keepAwake();
  startMusic();
});
music.addEventListener("ended", () => {
  if (!soundOn) return;
  music.currentTime = 0;
  music.play().catch(() => showPrompt());
});

run();
