const player = document.querySelector("[data-player]");
const stage = document.querySelector("[data-stage]");
const tabs = [...document.querySelectorAll("[data-cam]")];

// EGE меняет адрес ролика при перезапуске эфира.
// Текущий id: https://egeeulen.de/youtube/api.php?get=C3 и C4.
// Снято 17 ноября 2026.
const cams = {
  barn: {
    src: "https://peaky-weather.web.app/Barn_Owl_Live_Widget02.html",
    title: "Прямой эфир сипухи, Barn Owl Live",
    allow: "autoplay; encrypted-media; fullscreen",
    tall: true
  },
  ruin3: {
    src: "https://www.youtube-nocookie.com/embed/3sjWPFWfl-k?rel=0&modestbranding=1&playsinline=1",
    title: "Прямой эфир филина, камера 3, EGE",
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    tall: false
  },
  ruin4: {
    src: "https://www.youtube-nocookie.com/embed/fMHC46EXp90?rel=0&modestbranding=1&playsinline=1",
    title: "Прямой эфир филина, камера 4, EGE",
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    tall: false
  }
};

function show(id) {
  const cam = cams[id];
  if (!cam) return;
  stage.classList.toggle("is-tall", cam.tall);
  player.title = cam.title;
  player.setAttribute("allow", cam.allow);
  if (player.src !== cam.src) player.src = cam.src;
  for (const tab of tabs) {
    const on = tab.dataset.cam === id;
    tab.setAttribute("aria-selected", on ? "true" : "false");
  }
  for (const story of document.querySelectorAll("[data-about]")) {
    story.hidden = story.dataset.about !== id;
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => show(tab.dataset.cam));
}
