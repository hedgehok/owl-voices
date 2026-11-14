const RANKS = [
  {
    min: 0,
    title: "Случайный прохожий",
    line: "Вы шли мимо дупла и приняли уханье за ветер. Совы ответили молчанием и сделали вид, что это просто ветка."
  },
  {
    min: 20,
    title: "Гость опушки",
    line: "Ухо уже ловит «уу», но Strix и Asio пока сливаются в одну тёмную фразу и не представляются."
  },
  {
    min: 40,
    title: "Ночной слушатель",
    line: "Половину голосов вы узнаёте с первого слога. Вторая половина делает паузу и начинает сначала."
  },
  {
    min: 60,
    title: "Свой в дупле",
    line: "Латынь больше не шипит. Совы начинают отвечать вам на «ты» и не сбиваются с такта."
  },
  {
    min: 80,
    title: "Хранитель ночи",
    line: "Атлас можно закрывать: голоса сидят у вас на плече. Филин уже подвинулся и не собирается просить место обратно."
  }
];

const THEMES = [
  {
    id: "owls",
    kicker: "Тема",
    title: "Совы",
    text: "Голоса сов из атласа. Звучит запись, в ответах — четыре имени.",
    birds: () => (window.OWLS || []).flatMap((bird) => {
      const calls = (bird.calls || []).filter((call) => call.src);
      return calls.length && bird.latin ? [{ ...bird, calls }] : [];
    })
  }
];

const app = document.querySelector("#app");
const audio = document.querySelector("#clip");
let theme = null;
let round = [];
let step = 0;
let score = 0;
let misses = [];
let locked = false;
let scrubbing = false;

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const hold = copy[i];
    copy[i] = copy[j];
    copy[j] = hold;
  }
  return copy;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function lengthsFor(total) {
  const presets = [5, 10, 15, total];
  return presets.filter((count, index) => count >= 4 && count <= total && presets.indexOf(count) === index);
}

function rankFor(percent) {
  let current = RANKS[0];
  RANKS.forEach((rank) => {
    if (percent >= rank.min) current = rank;
  });
  return current;
}

function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function credit(call) {
  const name = esc(call.author || "автор неизвестен");
  const who = call.href
    ? `<a href="${esc(call.href)}" target="_blank" rel="noopener">${name}</a>`
    : name;
  return `Запись: ${who}, ${esc(call.license || "")}`.replace(/, $/, "");
}

function stopClip() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

function paint() {
  const now = app.querySelector("[data-now]");
  const end = app.querySelector("[data-end]");
  const range = app.querySelector("[data-seek]");
  if (!now || !end || !range) return;
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const at = scrubbing ? (Number(range.value) / 1000) * duration : audio.currentTime;
  end.textContent = clock(duration);
  now.textContent = clock(at);
  if (!scrubbing) range.value = duration ? String(Math.round((at / duration) * 1000)) : "0";
  const pct = duration ? (at / duration) * 100 : 0;
  range.style.background = `linear-gradient(90deg, #e2b15a ${pct}%, rgba(243, 232, 210, 0.16) ${pct}%)`;
}

function syncToggle() {
  const button = app.querySelector("[data-toggle]");
  const dial = app.querySelector(".dial");
  const playing = !audio.paused && !audio.ended;
  if (button) {
    button.classList.toggle("is-on", playing);
    button.setAttribute("aria-label", playing ? "Пауза" : "Слушать запись");
  }
  if (dial) dial.classList.toggle("is-live", playing);
}

audio.addEventListener("timeupdate", paint);
audio.addEventListener("loadedmetadata", paint);
audio.addEventListener("durationchange", paint);
audio.addEventListener("play", syncToggle);
audio.addEventListener("pause", syncToggle);
audio.addEventListener("ended", syncToggle);

function showHome() {
  stopClip();
  theme = null;
  const tiles = THEMES.map((item) => {
    const count = item.birds().length;
    return `<button class="tile" type="button" data-theme="${esc(item.id)}" ${count < 4 ? "disabled" : ""}>
      <span class="eyebrow">${esc(item.kicker)}</span>
      <strong>${esc(item.title)}</strong>
      <span>${esc(item.text)} В теме ${count} ${count === 1 ? "вид" : "видов"}.</span>
    </button>`;
  }).join("");
  app.innerHTML = `
    <p class="eyebrow">Викторина</p>
    <h1>Узнайте сову по голосу</h1>
    <p class="lede">На каждом вопросе — запись и четыре латинских названия. Сначала тема, потом длина викторины.</p>
    <div class="themes">${tiles}</div>`;
  app.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      theme = THEMES.find((item) => item.id === button.dataset.theme);
      showLength();
    });
  });
}

function showLength() {
  stopClip();
  const birds = theme.birds();
  const buttons = lengthsFor(birds.length).map((count) => `
    <button class="tile count-tile" type="button" data-count="${count}">
      <strong>${count === birds.length ? birds.length : count}</strong>
      <span>${count === birds.length ? "все виды" : "вопросов"}</span>
    </button>`).join("");
  app.innerHTML = `
    <button class="back" type="button" data-home>← К темам</button>
    <p class="eyebrow">${esc(theme.title)}</p>
    <h1>Сколько вопросов?</h1>
    <p class="lede">Виды не повторяются. В ответах всегда четыре латинских имени из этой темы.</p>
    <div class="counts">${buttons}</div>`;
  app.querySelector("[data-home]").addEventListener("click", showHome);
  app.querySelectorAll("[data-count]").forEach((button) => {
    button.addEventListener("click", () => start(birds, Number(button.dataset.count)));
  });
}

function start(birds, count) {
  const picked = shuffle(birds).slice(0, count);
  round = picked.map((bird) => {
    const decoys = shuffle(birds.filter((item) => item.id !== bird.id)).slice(0, 3);
    return {
      bird,
      call: bird.calls[Math.floor(Math.random() * bird.calls.length)],
      options: shuffle([bird, ...decoys])
    };
  });
  step = 0;
  score = 0;
  misses = [];
  locked = false;
  showQuestion();
}

function showQuestion() {
  locked = false;
  const card = round[step];
  const progress = (step / round.length) * 100;
  const choices = card.options.map((option) => `
    <button class="choice" type="button" data-id="${esc(option.id)}">${esc(option.latin)}</button>`).join("");
  stopClip();
  app.innerHTML = `
    <section class="round">
      <figure class="stage">
        <div class="listen">
          <p class="clip-title">${esc(card.call.title)}</p>
          <div class="dial">
            <button class="toggle" type="button" data-toggle aria-label="Слушать запись">
              <svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>
              <svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.2v14H7zm6.8 0H17v14h-3.2z"/></svg>
            </button>
          </div>
          <div class="track">
            <input class="seek" data-seek type="range" min="0" max="1000" value="0" aria-label="Позиция записи">
            <div class="times"><span data-now>0:00</span><span data-end>0:00</span></div>
          </div>
        </div>
        <figcaption>${credit(card.call)}</figcaption>
      </figure>
      <div>
        <div class="meter"><span>Вопрос ${step + 1} из ${round.length}</span><span>Верно ${score}</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${progress}%"></i></div>
        <p class="ask">Латинское название</p>
        <div class="choices">${choices}</div>
        <div class="reveal" hidden>
          <p></p>
          <button class="next" type="button" data-next>${step + 1 === round.length ? "К результату" : "Дальше"}</button>
        </div>
      </div>
    </section>`;
  audio.src = `../${card.call.src}`;
  const reveal = app.querySelector(".reveal");
  const range = app.querySelector("[data-seek]");
  app.querySelector("[data-toggle]").addEventListener("click", () => {
    if (audio.paused) audio.play();
    else audio.pause();
  });
  range.addEventListener("pointerdown", () => { scrubbing = true; });
  range.addEventListener("pointerup", () => { scrubbing = false; });
  range.addEventListener("change", () => { scrubbing = false; paint(); });
  range.addEventListener("input", () => {
    if (!Number.isFinite(audio.duration)) return;
    audio.currentTime = (Number(range.value) / 1000) * audio.duration;
    paint();
  });
  app.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => answer(button, card, reveal));
  });
  app.querySelector("[data-next]").addEventListener("click", () => {
    step += 1;
    if (step >= round.length) showResult();
    else showQuestion();
  });
  paint();
}

function answer(button, card, reveal) {
  if (locked) return;
  locked = true;
  const correct = button.dataset.id === card.bird.id;
  if (correct) score += 1;
  else misses.push(card.bird);
  app.querySelectorAll(".choice").forEach((choice) => {
    choice.disabled = true;
    if (choice.dataset.id === card.bird.id) choice.classList.add("is-right");
    else if (choice === button) choice.classList.add("is-wrong");
  });
  const heard = card.call.hint ? ` ${esc(card.call.hint)}` : "";
  reveal.hidden = false;
  reveal.querySelector("p").innerHTML = correct
    ? `Да, это <em>${esc(card.bird.name)}</em>.${heard}`
    : `Это <em>${esc(card.bird.latin)}</em> — ${esc(card.bird.name)}.${heard}`;
  const meter = app.querySelector(".meter span:last-child");
  if (meter) meter.textContent = `Верно ${score}`;
}

function showResult() {
  stopClip();
  const percent = round.length ? Math.round((score / round.length) * 100) : 0;
  const yours = rankFor(percent);
  const ranks = RANKS.map((rank, index) => {
    const next = RANKS[index + 1];
    const band = next ? `${rank.min}–${next.min - 1}%` : `${rank.min}–100%`;
    const mark = rank === yours ? `<span class="yours">Ваш ранг</span>` : "";
    return `<li class="${rank === yours ? "is-yours" : ""}">
      <span class="band">${band}</span>
      <div>
        ${mark}
        <strong>${esc(rank.title)}</strong>
        <p>${esc(rank.line)}</p>
      </div>
    </li>`;
  }).join("");
  const wrong = misses.length
    ? `<div class="misses"><h2>Осталось запомнить</h2><ul>${misses.map((bird) => `<li>${esc(bird.name)} — <em>${esc(bird.latin)}</em>${bird.mnemonic ? `, «${esc(bird.mnemonic)}»` : ""}</li>`).join("")}</ul></div>`
    : "";
  app.innerHTML = `
    <p class="eyebrow">${esc(theme.title)}</p>
    <h1>Готово</h1>
    <p class="score">${score} из ${round.length} · ${percent}%</p>
    <p class="rank-name">${esc(yours.title)}</p>
    <p class="rank-line">${esc(yours.line)}</p>
    <ol class="ranks">${ranks}</ol>
    ${wrong}
    <div class="actions">
      <button class="next" type="button" data-again>Ещё раз</button>
      <button class="ghost" type="button" data-home>К темам</button>
    </div>`;
  app.querySelector("[data-again]").addEventListener("click", () => start(theme.birds(), round.length));
  app.querySelector("[data-home]").addEventListener("click", showHome);
  window.scrollTo(0, 0);
}

showHome();
