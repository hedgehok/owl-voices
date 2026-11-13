const RANKS = [
  {
    min: 0,
    title: "Случайный прохожий",
    line: "Вы шли мимо дупла и заглянули из вежливости. Совы ответили молчанием и сделали вид, что это просто ветка."
  },
  {
    min: 20,
    title: "Гость опушки",
    line: "Ушки уже навострились, но Strix и Asio пока путаются в темноте и притворяются одним и тем же словом."
  },
  {
    min: 40,
    title: "Ночной слушатель",
    line: "Половину имён вы уже держите за хвост. Вторая половина делает вид, что это не она, и тихо пересаживается."
  },
  {
    min: 60,
    title: "Свой в дупле",
    line: "Латынь больше не шипит. Совы начинают отвечать вам на «ты» и подвигаются на ветке."
  },
  {
    min: 80,
    title: "Хранитель ночи",
    line: "Атлас можно закрывать: имена сидят у вас на плече. Филин уже подвинулся и не собирается просить место обратно."
  }
];

const THEMES = [
  {
    id: "owls",
    kicker: "Тема",
    title: "Совы",
    text: "Латинские имена сов из атласа. На фото — птица, в ответах — четыре имени.",
    birds: () => (window.OWLS || []).filter((bird) => bird.latin && bird.photos && bird.photos.length)
  }
];

const app = document.querySelector("#app");
let theme = null;
let round = [];
let step = 0;
let score = 0;
let misses = [];
let locked = false;

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

function photoSrc(bird, index) {
  return `../media/photos/${bird.id}-${index + 1}.jpg`;
}

function credit(photo) {
  const name = esc(photo.author || "автор неизвестен");
  const who = photo.href
    ? `<a href="${esc(photo.href)}" target="_blank" rel="noopener">${name}</a>`
    : name;
  return `Фото: ${who}, ${esc(photo.license || "")}`.replace(/, $/, "");
}

function showHome() {
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
    <h1>Узнайте птицу по-латыни</h1>
    <p class="lede">На каждом вопросе — фото и четыре латинских названия. Сначала тема, потом длина викторины.</p>
    <div class="themes">${tiles}</div>`;
  app.querySelectorAll("[data-theme]").forEach((button) => {
    button.addEventListener("click", () => {
      theme = THEMES.find((item) => item.id === button.dataset.theme);
      showLength();
    });
  });
}

function showLength() {
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
      photoIndex: Math.floor(Math.random() * bird.photos.length),
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
  const photo = card.bird.photos[card.photoIndex];
  const progress = ((step) / round.length) * 100;
  const choices = card.options.map((option) => `
    <button class="choice" type="button" data-id="${esc(option.id)}">${esc(option.latin)}</button>`).join("");
  app.innerHTML = `
    <section class="play">
      <figure class="stage">
        <img src="${photoSrc(card.bird, card.photoIndex)}" alt="Птица из атласа">
        <figcaption>${credit(photo)}</figcaption>
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
  const reveal = app.querySelector(".reveal");
  app.querySelectorAll(".choice").forEach((button) => {
    button.addEventListener("click", () => answer(button, card, reveal));
  });
  app.querySelector("[data-next]").addEventListener("click", () => {
    step += 1;
    if (step >= round.length) showResult();
    else showQuestion();
  });
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
  reveal.hidden = false;
  reveal.querySelector("p").innerHTML = correct
    ? `Да, это <em>${esc(card.bird.name)}</em>.`
    : `Это <em>${esc(card.bird.latin)}</em> — ${esc(card.bird.name)}.`;
  const meter = app.querySelector(".meter span:last-child");
  if (meter) meter.textContent = `Верно ${score}`;
}

function showResult() {
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
    ? `<div class="misses"><h2>Осталось запомнить</h2><ul>${misses.map((bird) => `<li>${esc(bird.name)} — <em>${esc(bird.latin)}</em></li>`).join("")}</ul></div>`
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
