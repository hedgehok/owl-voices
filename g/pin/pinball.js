(() => {
  const W = 100;
  const H = 180;
  const GRAV = 62;
  const BALL_R = 2.5;
  const LANE_L = 88;
  const LANE_R = 95;
  const LANE_X = 91.5;
  const TAU = Math.PI * 2;

  const canvas = document.querySelector("#field");
  const ctx = canvas.getContext("2d");
  const veil = document.querySelector("[data-veil]");
  const veilText = document.querySelector("[data-veil-text]");
  const startBtn = document.querySelector("[data-start]");
  const scoreEl = document.querySelector("[data-score]");
  const clockEl = document.querySelector("[data-clock]");
  const dawnEl = document.querySelector("[data-dawn]");

  const walls = [
    [[12, 26], [12, 146]],
    [[12, 146], [18, 168]],
    [[LANE_L, 146], [82, 168]],
    [[LANE_L, 78], [LANE_L, 164]],
    [[LANE_L, 164], [LANE_R, 164]],
    [[LANE_R, 164], [LANE_R, 72]],
    [[LANE_R, 72], [84, 46]],
    [[84, 46], [72, 12]],
    [[72, 12], [28, 12]],
    [[28, 12], [12, 26]],
  ];

  const felt = [
    [28, 14], [12, 28], [12, 146], [20, 166], [32, 156],
    [50, 174], [68, 156], [80, 166], [LANE_L, 146],
    [LANE_L, 164], [LANE_R, 164], [LANE_R, 72], [84, 46], [72, 14],
  ];

  let view = { w: 1, h: 1 };
  let phase = "intro";
  let score = 0;
  let balls = 3;
  let wait = 0;
  let lane = true;
  let charge = 0;
  let plungerWas = false;
  let captured = 0;
  let nestScore = false;
  let toast = "";
  let toastT = 0;
  let stillT = 0;
  let stillX = LANE_X;
  let stillY = 146;
  let last = 0;
  const ball = { x: LANE_X, y: 146, vx: 0, vy: 0, r: BALL_R };
  const key = { l: false, r: false, p: false };
  const ptr = new Map();
  const held = { l: false, r: false, p: false };

  const flippers = [
    { side: -1, pivot: { x: 32, y: 154 }, len: 16, rest: 0.52, up: -0.4, angle: 0.52, omega: 0 },
    { side: 1, pivot: { x: 68, y: 154 }, len: 16, rest: Math.PI - 0.52, up: Math.PI + 0.4, angle: Math.PI - 0.52, omega: 0 },
  ];
  const bumpers = [
    { x: 34, y: 54, r: 6.2, cool: 0, flash: 0 },
    { x: 50, y: 42, r: 6.2, cool: 0, flash: 0 },
    { x: 66, y: 54, r: 6.2, cool: 0, flash: 0 },
  ];
  const mice = [
    { x: 30, y: 86, r: 2.5, gone: false, cool: 0 },
    { x: 43, y: 78, r: 2.5, gone: false, cool: 0 },
    { x: 57, y: 78, r: 2.5, gone: false, cool: 0 },
    { x: 70, y: 86, r: 2.5, gone: false, cool: 0 },
  ];
  const posts = [
    { x: 24, y: 142, r: 2.1 },
    { x: 76, y: 142, r: 2.1 },
  ];
  const slings = [
    { a: { x: 16, y: 112 }, b: { x: 28, y: 136 }, nx: 0.34, ny: -0.94, out: 13, cool: 0, flash: 0 },
    { a: { x: 84, y: 112 }, b: { x: 72, y: 136 }, nx: -0.34, ny: -0.94, out: 87, cool: 0, flash: 0 },
  ];
  const trees = [
    { x: 34, y: 116, r: 3.1, cool: 0, flash: 0 },
    { x: 50, y: 108, r: 3.1, cool: 0, flash: 0 },
    { x: 72, y: 124, r: 3.1, cool: 0, flash: 0 },
  ];
  const shrubs = [
    { x: 22, y: 70, s: 1 },
    { x: 78, y: 70, s: 1 },
    { x: 17, y: 100, s: 0.72 },
    { x: 83, y: 100, s: 0.72 },
  ];
  const nest = { x: 50, y: 24, r: 5.4, flash: 0 };
  const branch = [[51, 126], [55, 144]];
  let spare = true;
  let nestSide = 1;

  function layout() {
    view = { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 };
  }

  function resize() {
    layout();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(view.w * dpr);
    const bh = Math.round(view.h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(x, y) {
    const t = Math.max(0, Math.min(1, y / H));
    const s = 0.62 + 0.38 * t;
    const top = view.h * 0.035;
    const bot = view.h * 0.975;
    return {
      x: view.w * 0.5 + ((x - W / 2) / (W / 2)) * view.w * 0.46 * s,
      y: top + t * (bot - top),
      s: (view.w * 0.46 * s) / (W / 2),
    };
  }

  function hud() {
    const nestLine = phase === "intro" ? "Счёт —" : `Счёт ${score}`;
    const lives = phase === "intro" ? "моли —" : `моли ${balls}`;
    if (scoreEl.textContent !== nestLine) scoreEl.textContent = nestLine;
    if (clockEl.textContent !== lives) clockEl.textContent = lives;
    const lit = mice.filter((m) => m.gone).length / mice.length;
    dawnEl.style.transform = `scaleX(${phase === "intro" ? 0 : lit})`;
  }

  function say(line) {
    toast = line;
    toastT = 1.3;
  }

  function add(n) {
    score += n;
    hud();
  }

  function woodScore() {
    const lit = mice.filter((mouse) => mouse.gone).length;
    return 100 * (1 + lit);
  }

  function resetMice() {
    mice.forEach((m) => {
      m.gone = false;
      m.cool = 0.4;
    });
  }

  function serve() {
    lane = true;
    charge = 0;
    captured = 0;
    nestScore = false;
    stillT = 0;
    spare = true;
    ball.x = LANE_X;
    ball.y = 146;
    ball.vx = 0;
    ball.vy = 0;
    flippers.forEach((f) => {
      f.angle = f.rest;
      f.omega = 0;
    });
    phase = "play";
    hud();
  }

  function begin() {
    score = 0;
    balls = 3;
    wait = 0;
    resetMice();
    bumpers.forEach((b) => { b.cool = 0; b.flash = 0; });
    slings.forEach((s) => { s.cool = 0; s.flash = 0; });
    toast = "";
    toastT = 0;
    veil.hidden = true;
    serve();
    canvas.focus({ preventScroll: true });
  }

  function finish() {
    phase = "done";
    lane = false;
    const line = score <= 0 ? "Стол пуст." : `Счёт ${score}.`;
    veilText.textContent = line;
    startBtn.textContent = "Ещё партия";
    veil.hidden = false;
    hud();
  }

  function drain() {
    balls -= 1;
    ball.vx = 0;
    ball.vy = 0;
    if (balls <= 0) finish();
    else {
      phase = "wait";
      wait = 0.75;
      hud();
    }
  }

  function launch() {
    if (!lane || phase !== "play") return;
    const power = Math.max(0.4, Math.min(1, charge));
    ball.x = LANE_X;
    ball.y = 146 + charge * 8;
    ball.vx = 0;
    ball.vy = -(78 + power * 70);
    lane = false;
    charge = 0;
  }

  function tipOf(f) {
    return {
      x: f.pivot.x + Math.cos(f.angle) * f.len,
      y: f.pivot.y + Math.sin(f.angle) * f.len,
    };
  }

  function resolveSegment(a, b, rest) {
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    if (len2 < 1e-6) return null;
    let t = ((ball.x - a[0]) * abx + (ball.y - a[1]) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + abx * t;
    const cy = a[1] + aby * t;
    let dx = ball.x - cx;
    let dy = ball.y - cy;
    let dist = Math.hypot(dx, dy);
    if (dist >= ball.r) return null;
    if (dist < 1e-5) {
      dx = -aby;
      dy = abx;
      dist = Math.hypot(dx, dy) || 1;
    }
    dx /= dist;
    dy /= dist;
    const pen = ball.r - dist;
    ball.x += dx * pen;
    ball.y += dy * pen;
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) {
      ball.vx -= (1 + rest) * vn * dx;
      ball.vy -= (1 + rest) * vn * dy;
    }
    return { x: dx, y: dy };
  }

  function collideCircle(c, rest, kick) {
    let dx = ball.x - c.x;
    let dy = ball.y - c.y;
    let dist = Math.hypot(dx, dy);
    const min = ball.r + c.r;
    if (dist >= min) return false;
    if (dist < 1e-5) {
      dx = 0;
      dy = -1;
      dist = 1;
    } else {
      dx /= dist;
      dy /= dist;
    }
    ball.x = c.x + dx * min;
    ball.y = c.y + dy * min;
    const vn = ball.vx * dx + ball.vy * dy;
    if (vn < 0) {
      ball.vx -= (1 + rest) * vn * dx;
      ball.vy -= (1 + rest) * vn * dy;
    }
    if (kick && (!c.cool || c.cool <= 0)) {
      ball.vx += dx * kick;
      ball.vy += dy * kick;
      c.cool = 0.16;
      c.flash = 1;
      return "kick";
    }
    return true;
  }

  function updateFlippers(dt) {
    for (const f of flippers) {
      const want = (f.side < 0 ? held.l : held.r) ? f.up : f.rest;
      const prev = f.angle;
      const step = 13 * dt;
      const gap = want - f.angle;
      f.angle += Math.max(-step, Math.min(step, gap));
      f.omega = dt > 0 ? (f.angle - prev) / dt : 0;
    }
  }

  function collideFlipper(f, dt) {
    const tip = tipOf(f);
    const hit = resolveSegment([f.pivot.x, f.pivot.y], [tip.x, tip.y], 0.35);
    const dx = ball.x - f.pivot.x;
    const dy = ball.y - f.pivot.y;
    const dist = Math.hypot(dx, dy);
    const prev = f.angle - f.omega * dt;
    const ballAng = Math.atan2(dy, dx);
    const pad = Math.atan2(ball.r, Math.max(dist, 1));
    const lo = Math.min(prev, f.angle) - pad;
    const hi = Math.max(prev, f.angle) + pad;
    const swept = dist < f.len + ball.r && dist > 5 && ballAng >= lo && ballAng <= hi && Math.abs(f.omega) > 2;
    if (!hit && !swept) return;
    let nx = -Math.sin(f.angle);
    let ny = Math.cos(f.angle);
    if (ny > 0) { nx = -nx; ny = -ny; }
    if (hit && ny > -0.15) {
      nx = hit.x;
      ny = hit.y;
    }
    const along = Math.abs(f.omega) * Math.min(dist, f.len) * 0.92;
    const vn = ball.vx * nx + ball.vy * ny;
    if (Math.abs(f.omega) > 2 && vn < along) {
      const add = along - vn;
      ball.vx += nx * add;
      ball.vy += ny * add;
    }
    if (swept && !hit) {
      const push = ball.r * 0.65;
      ball.x += nx * push;
      ball.y += ny * push;
    }
  }

  function physics(dt) {
    if (captured > 0) {
      captured -= dt;
      ball.x += (nest.x - ball.x) * 0.18;
      ball.y += (nest.y - ball.y) * 0.18;
      ball.vx = 0;
      ball.vy = 0;
      nest.flash = 1;
      if (captured <= 0) {
        nestSide = -nestSide;
        ball.x = nest.x + nestSide * 8;
        ball.y = nest.y + nest.r + ball.r + 0.6;
        ball.vx = nestSide * 10;
        ball.vy = 76;
      }
      return;
    }

    if (lane) {
      ball.x = LANE_X;
      ball.y = 146 + charge * 8;
      ball.vx = 0;
      ball.vy = 0;
      return;
    }

    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    for (let pass = 0; pass < 2; pass++) {
      for (const wall of walls) resolveSegment(wall[0], wall[1], 0.42);
      if (ball.x < LANE_L - 1 && ball.vx > -8) resolveSegment([LANE_L, 78], [LANE_L, 60], 0.3);
      resolveSegment(branch[0], branch[1], 0.35);
      for (const f of flippers) collideFlipper(f, dt);
    }

    for (const post of posts) collideCircle(post, 0.55, 0);
    for (const bumper of bumpers) {
      if (collideCircle(bumper, 0.2, 46) === "kick") add(woodScore());
    }
    for (const tree of trees) {
      if (tree.cool > 0) {
        collideCircle(tree, 0.4, 0);
        continue;
      }
      const dx = ball.x - tree.x;
      const dy = ball.y - tree.y;
      const approaching = dx * ball.vx + dy * ball.vy < -8;
      if (collideCircle(tree, 0.4, 0) && approaching) {
        ball.vy = Math.min(ball.vy, -32);
        ball.vx += Math.max(-16, Math.min(16, dx * 5));
        tree.cool = 0.28;
        tree.flash = 1;
        add(woodScore());
      }
    }
    let slung = false;
    for (const sling of slings) {
      const hit = resolveSegment([sling.a.x, sling.a.y], [sling.b.x, sling.b.y], 0.15);
      if (!hit || sling.cool > 0 || slung) continue;
      const side = hit.x * sling.nx + hit.y * sling.ny;
      if (side < 0.15) continue;
      ball.vx = sling.nx * 36;
      ball.vy = sling.ny * 62;
      ball.x += sling.nx * 0.6;
      ball.y += sling.ny * 0.6;
      sling.cool = 0.22;
      sling.flash = 1;
      slung = true;
      add(20);
    }
    for (const mouse of mice) {
      if (mouse.gone) continue;
      if (mouse.cool > 0) {
        collideCircle(mouse, 0.4, 0);
        continue;
      }
      if (collideCircle(mouse, 0.35, 8) === "kick") {
        mouse.gone = true;
        mouse.flash = 1;
        add(500);
        if (mice.every((m) => m.gone)) {
          add(2000);
          say("мыши");
          resetMice();
        }
      }
    }

    const ndx = ball.x - nest.x;
    const ndy = ball.y - nest.y;
    if (!nestScore && ndx * ndx + ndy * ndy < (nest.r - 0.4) * (nest.r - 0.4) && ball.vy < 0) {
      captured = 0.55;
      nestScore = true;
      add(1500);
      say("гнездо");
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 168) {
      ball.vx *= 168 / speed;
      ball.vy *= 168 / speed;
    }

    if (spare && ball.vy > 8 && ball.y > 158 && (ball.x < 30 || (ball.x > 74 && ball.x < LANE_L - 1))) {
      spare = false;
      lane = true;
      charge = 0;
      ball.vx = 0;
      ball.vy = 0;
      say("жёлоб");
      return;
    }
    if (ball.y > 172 || ball.x < 2 || ball.x > 98) drain();
    else if (ball.x > LANE_L + 1 && ball.y > 96 && ball.vy > 12) {
      lane = true;
      charge = 0;
    }
  }

  function step(dt) {
    toastT = Math.max(0, toastT - dt);
    nest.flash = Math.max(0, nest.flash - dt * 1.6);
    for (const bumper of bumpers) {
      bumper.cool = Math.max(0, bumper.cool - dt);
      bumper.flash = Math.max(0, bumper.flash - dt * 2.4);
    }
    for (const sling of slings) {
      sling.cool = Math.max(0, sling.cool - dt);
      sling.flash = Math.max(0, sling.flash - dt * 2.4);
    }
    for (const tree of trees) {
      tree.cool = Math.max(0, tree.cool - dt);
      tree.flash = Math.max(0, tree.flash - dt * 2.4);
    }
    for (const mouse of mice) mouse.cool = Math.max(0, mouse.cool - dt);

    if (phase === "wait") {
      wait -= dt;
      if (wait <= 0) serve();
      return;
    }
    if (phase !== "play") return;

    if (held.p && lane) charge = Math.min(1, charge + dt * 0.85);
    if (plungerWas && !held.p) launch();
    plungerWas = held.p;

    if (phase === "play" && !lane && captured <= 0) {
      const moved = (ball.x - stillX) ** 2 + (ball.y - stillY) ** 2;
      if (moved < 81 && ball.y < 148) stillT += dt;
      else {
        stillT = 0;
        stillX = ball.x;
        stillY = ball.y;
      }
      if (stillT > 0.6) {
        ball.vy = Math.abs(ball.vy) + 34;
        ball.vx += (48 - ball.x) * 0.35;
        stillT = 0;
        stillX = ball.x;
        stillY = ball.y;
      }
    } else {
      stillT = 0;
    }

    let left = dt;
    const slice = 1 / 180;
    while (left > 0 && phase === "play") {
      const h = Math.min(slice, left);
      updateFlippers(h);
      physics(h);
      left -= h;
    }
  }

  function pathOf(points) {
    const first = project(points[0][0], points[0][1]);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const p = project(points[i][0], points[i][1]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }

  function drawSegment(a, b, width, color) {
    const p = project(a[0], a[1]);
    const q = project(b[0], b[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }

  function drawFlipper(f) {
    const piv = project(f.pivot.x, f.pivot.y);
    const tip = tipOf(f);
    const end = project(tip.x, tip.y);
    const ang = Math.atan2(end.y - piv.y, end.x - piv.x);
    const len = Math.hypot(end.x - piv.x, end.y - piv.y);
    const thick = Math.max(7, piv.s * 1.45);
    ctx.save();
    ctx.translate(piv.x, piv.y);
    ctx.rotate(ang);
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.moveTo(0, -thick * 0.62);
    ctx.quadraticCurveTo(len * 0.45, -thick * 0.7, len * 0.78, -thick * 0.22);
    ctx.quadraticCurveTo(len * 0.92, -thick * 0.08, len, -thick * 0.05);
    ctx.lineTo(len, thick * 0.05);
    ctx.quadraticCurveTo(len * 0.55, thick * 0.22, 0, thick * 0.36);
    ctx.fill();
    ctx.fillStyle = "#e4d3b4";
    ctx.beginPath();
    ctx.moveTo(thick * 0.2, -thick * 0.28);
    ctx.quadraticCurveTo(len * 0.5, -thick * 0.34, len * 0.72, -thick * 0.08);
    ctx.quadraticCurveTo(len * 0.4, -thick * 0.02, thick * 0.15, thick * 0.08);
    ctx.fill();
    ctx.strokeStyle = "rgba(92, 73, 54, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(len * 0.22, -thick * 0.42);
    ctx.lineTo(len * 0.62, -thick * 0.12);
    ctx.moveTo(len * 0.34, -thick * 0.22);
    ctx.lineTo(len * 0.7, thick * 0.02);
    ctx.stroke();
    ctx.strokeStyle = "rgba(26, 20, 12, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, thick * 0.36);
    ctx.quadraticCurveTo(len * 0.55, thick * 0.22, len, thick * 0.05);
    ctx.stroke();
    ctx.fillStyle = "#c4a36a";
    ctx.beginPath();
    ctx.arc(0, 0, thick * 0.34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.arc(-thick * 0.08, -thick * 0.08, thick * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBall() {
    const p = project(ball.x, ball.y);
    const rx = Math.max(5.5, ball.r * p.s);
    const ry = rx * 0.78;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(p.x + rx * 0.28, p.y + ry * 1.2, rx * 0.9, ry * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f7f3ea";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 250, 242, 0.85)";
    ctx.beginPath();
    ctx.ellipse(p.x - rx * 0.28, p.y - ry * 0.32, rx * 0.28, ry * 0.18, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f0d7a2";
    ctx.beginPath();
    ctx.ellipse(p.x - rx * 0.72, p.y + ry * 0.05, rx * 0.58, ry * 0.26, -0.6, 0, TAU);
    ctx.ellipse(p.x + rx * 0.72, p.y + ry * 0.05, rx * 0.58, ry * 0.26, 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.arc(p.x, p.y - ry * 0.02, Math.max(1.2, rx * 0.15), 0, TAU);
    ctx.fill();
  }

  function drawNest() {
    const p = project(nest.x, nest.y);
    const s = Math.max(p.s, 1.2);
    const lit = nest.flash > 0.2;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = lit ? "#314438" : "#24362c";
    ctx.beginPath();
    ctx.ellipse(0, s * 0.6, s * 7.4, s * 5.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a2420";
    ctx.beginPath();
    ctx.moveTo(-s * 3.6, -s * 1.1);
    ctx.lineTo(-s * 6.2, -s * 6.4);
    ctx.lineTo(-s * 0.8, -s * 2.2);
    ctx.closePath();
    ctx.moveTo(s * 3.6, -s * 1.1);
    ctx.lineTo(s * 6.2, -s * 6.4);
    ctx.lineTo(s * 0.8, -s * 2.2);
    ctx.fill();
    ctx.fillStyle = lit ? "#f0d7a2" : "#c4a36a";
    ctx.beginPath();
    ctx.arc(-s * 2.15, s * 0.55, s * 1.15, 0, TAU);
    ctx.arc(s * 2.15, s * 0.55, s * 1.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.arc(-s * 2.05, s * 0.6, s * 0.42, 0, TAU);
    ctx.arc(s * 2.25, s * 0.6, s * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? "#f0d7a2" : "#c4a36a";
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, s * 1.7);
    ctx.lineTo(s * 0.55, s * 1.7);
    ctx.lineTo(0, s * 2.7);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = lit ? "#f0d7a2" : "rgba(226, 177, 90, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, nest.r * p.s, nest.r * p.s * 0.72, 0, 0, TAU);
    ctx.stroke();
  }

  function drawBumper(bumper) {
    const p = project(bumper.x, bumper.y);
    const rx = bumper.r * p.s;
    const ry = rx * 0.74;
    const lit = bumper.flash > 0.12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + ry * 0.95, rx * 0.92, ry * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a2420";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + ry * 0.16, rx * 1.05, ry * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? "#314438" : "#24362c";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.86, ry * 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = lit ? "#f0d7a2" : "#8f7348";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.72, ry * 0.72, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#141c18";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.42, ry * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? "#f0d7a2" : "#e2b15a";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 0.22, ry * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.arc(p.x + rx * 0.04, p.y + ry * 0.02, Math.max(1.1, rx * 0.08), 0, TAU);
    ctx.fill();
  }

  function drawMouse(mouse) {
    const p = project(mouse.x, mouse.y);
    const rx = mouse.r * p.s;
    if (mouse.gone) {
      ctx.strokeStyle = "rgba(226, 177, 90, 0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * 0.62, 0, 0, TAU);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x + rx * 0.2, p.y + rx * 0.55, rx * 0.7, rx * 0.22, 0, 0, TAU);
    ctx.fill();
    const body = rx * 1.35;
    ctx.fillStyle = "#4a4036";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, body, body * 0.58, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6a5c4e";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + body * 0.12, body * 0.62, body * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#3a322c";
    ctx.beginPath();
    ctx.ellipse(p.x - body * 0.42, p.y - body * 0.42, body * 0.26, body * 0.2, -0.5, 0, TAU);
    ctx.ellipse(p.x + body * 0.22, p.y - body * 0.5, body * 0.22, body * 0.16, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.arc(p.x + body * 0.28, p.y - body * 0.02, Math.max(0.9, body * 0.1), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#4a4036";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(p.x - body * 0.85, p.y + body * 0.05);
    ctx.quadraticCurveTo(p.x - body * 1.35, p.y - body * 0.55, p.x - body * 0.4, p.y - body * 0.15);
    ctx.stroke();
  }

  function drawSling(sling) {
    const p = project(sling.a.x, sling.a.y);
    const q = project(sling.b.x, sling.b.y);
    const out = project(sling.out, (sling.a.y + sling.b.y) * 0.5);
    const lit = sling.flash > 0.1;
    ctx.fillStyle = "#2a241c";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.lineTo(out.x, out.y);
    ctx.fill();
    ctx.strokeStyle = "rgba(226, 177, 90, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = lit ? "#c4a36a" : "#4a3828";
    ctx.lineWidth = Math.max(4.5, p.s * 0.95);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
    ctx.strokeStyle = lit ? "rgba(240, 215, 162, 0.7)" : "rgba(226, 177, 90, 0.28)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    for (const pt of [p, q]) {
      const rad = Math.max(3, pt.s * 0.95);
      ctx.fillStyle = "#3a2e24";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y + 0.8, rad, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e2b15a";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rad * 0.72, 0, TAU);
      ctx.fill();
    }
  }

  function drawShrub(shrub) {
    const p = project(shrub.x, shrub.y);
    const rx = Math.max(7, p.s * 3.2 * shrub.s);
    const ry = rx * 0.62;
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.beginPath();
    ctx.ellipse(p.x + rx * 0.15, p.y + ry * 0.55, rx * 0.7, ry * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#223228";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2a3b30";
    ctx.beginPath();
    ctx.ellipse(p.x - rx * 0.28, p.y - ry * 0.15, rx * 0.48, ry * 0.42, -0.4, 0, TAU);
    ctx.ellipse(p.x + rx * 0.32, p.y + ry * 0.05, rx * 0.4, ry * 0.36, 0.3, 0, TAU);
    ctx.fill();
  }

  function drawTree(tree) {
    const p = project(tree.x, tree.y);
    const s = Math.max(p.s, 1);
    const w = tree.r * s * 1.15;
    const top = p.y - tree.r * s * 1.45;
    const foot = p.y + tree.r * s * 0.55;
    const lit = tree.flash > 0.12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.beginPath();
    ctx.ellipse(p.x + w * 0.12, foot + s * 0.4, w * 0.7, s * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#4a3828";
    ctx.fillRect(p.x - s * 0.45, p.y, s * 0.9, tree.r * s * 0.7);
    ctx.fillStyle = lit ? "#3d5244" : "#24362c";
    ctx.beginPath();
    ctx.moveTo(p.x, top);
    ctx.lineTo(p.x + w, foot);
    ctx.lineTo(p.x - w, foot);
    ctx.fill();
    ctx.fillStyle = lit ? "#314438" : "#1c2a22";
    ctx.beginPath();
    ctx.moveTo(p.x, top + tree.r * s * 0.55);
    ctx.lineTo(p.x + w * 0.58, p.y + s * 0.2);
    ctx.lineTo(p.x - w * 0.58, p.y + s * 0.2);
    ctx.fill();
  }

  function draw() {
    resize();
    const { w, h } = view;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#10140f";
    ctx.fillRect(0, 0, w, h);

    pathOf(felt);
    ctx.save();
    ctx.clip();
    const sky = project(50, 8);
    const ground = project(50, H);
    const wash = ctx.createLinearGradient(0, sky.y, 0, ground.y);
    wash.addColorStop(0, "#121816");
    wash.addColorStop(0.45, "#1a2420");
    wash.addColorStop(1, "#243028");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    pathOf([[LANE_L + 0.7, 76], [LANE_R - 0.5, 70], [LANE_R - 0.5, 163], [LANE_L + 0.7, 163]]);
    ctx.fillStyle = "rgba(8, 10, 9, 0.28)";
    ctx.fill();
    for (const shrub of shrubs) drawShrub(shrub);
    const hole = project(50, 169);
    ctx.fillStyle = "#0c100e";
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y, Math.max(16, hole.s * 8), Math.max(7, hole.s * 2.8), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(240, 215, 162, 0.16)";
    for (let i = 0; i < 8; i++) {
      const p = project(24 + (i * 23) % 48, 18 + (i * 11) % 22);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.9, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    pathOf(felt);
    ctx.strokeStyle = "#4a3828";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(226, 177, 90, 0.42)";
    ctx.lineWidth = 1.25;
    ctx.stroke();

    drawSegment([LANE_L, 80], [LANE_L, 146], 3.5, "#3a2e24");
    drawSegment([LANE_L, 80], [LANE_L, 146], 1, "rgba(226, 177, 90, 0.32)");
    drawSegment(branch[0], branch[1], 3.2, "#5c4936");
    drawSegment([51, 126], [56, 121], 2, "#4a3828");
    if (spare && phase === "play") {
      drawSegment([16, 160], [28, 156], 1.4, "rgba(226, 177, 90, 0.7)");
      drawSegment([74, 156], [84, 162], 1.4, "rgba(226, 177, 90, 0.7)");
    }

    for (const tree of trees) drawTree(tree);
    drawNest();
    for (const bumper of bumpers) drawBumper(bumper);
    for (const mouse of mice) drawMouse(mouse);
    for (const sling of slings) drawSling(sling);

    for (const post of posts) {
      const p = project(post.x, post.y);
      ctx.fillStyle = "#c4a36a";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2.8, post.r * p.s * 0.72), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e2b15a";
      ctx.beginPath();
      ctx.arc(p.x - 0.6, p.y - 0.6, Math.max(1.1, post.r * p.s * 0.28), 0, TAU);
      ctx.fill();
    }

    const foot = project(LANE_X, 162);
    const head = project(LANE_X, (lane ? ball.y : 150) + BALL_R);
    ctx.strokeStyle = "#5c4936";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(foot.x, foot.y);
    ctx.lineTo(head.x, Math.min(foot.y - 3, head.y));
    ctx.stroke();
    ctx.fillStyle = "#3a2e24";
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y, 4.2, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.ellipse(foot.x, foot.y - 0.4, 2.4, 1.3, 0, 0, TAU);
    ctx.fill();

    for (const f of flippers) drawFlipper(f);
    if (phase !== "wait") drawBall();

    if (toastT > 0) {
      ctx.globalAlpha = Math.min(1, toastT * 1.4);
      ctx.fillStyle = "#f0d7a2";
      ctx.font = "600 22px Spectral, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(toast, w / 2, h * 0.2);
      ctx.globalAlpha = 1;
    }
  }

  function syncHeld() {
    held.l = key.l;
    held.r = key.r;
    held.p = key.p;
    for (const zone of ptr.values()) {
      if (zone === "l") held.l = true;
      if (zone === "r") held.r = true;
      if (zone === "p") held.p = true;
    }
  }

  function zoneOf(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (lane && x > 0.8) return "p";
    return x < 0.5 ? "l" : "r";
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "play" || e.button !== 0) return;
    e.preventDefault();
    ptr.set(e.pointerId, zoneOf(e));
    syncHeld();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  }, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    if (!ptr.has(e.pointerId)) return;
    ptr.set(e.pointerId, zoneOf(e));
    syncHeld();
  });
  function endPointer(e) {
    ptr.delete(e.pointerId);
    syncHeld();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  function keyZone(code, down) {
    if (code === "ArrowLeft" || code === "KeyA" || code === "KeyZ") key.l = down;
    else if (code === "ArrowRight" || code === "KeyD" || code === "Slash") key.r = down;
    else if (code === "Space") key.p = down;
    else return false;
    return true;
  }

  window.addEventListener("keydown", (e) => {
    if (phase !== "play" || e.repeat) return;
    if (!keyZone(e.code, true)) return;
    syncHeld();
    if (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (!keyZone(e.code, false)) return;
    syncHeld();
  });
  window.addEventListener("blur", () => {
    key.l = key.r = key.p = false;
    ptr.clear();
    syncHeld();
  });

  startBtn.addEventListener("click", () => {
    if (phase === "play" || phase === "wait") return;
    begin();
  });

  hud();
  requestAnimationFrame(function frame(ts) {
    if (document.hidden) last = 0;
    else {
      const dt = Math.min(0.034, last ? (ts - last) / 1000 : 0.016);
      last = ts;
      step(dt);
    }
    draw();
    requestAnimationFrame(frame);
  });
})();
