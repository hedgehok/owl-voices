(() => {
  const ROUND = 60;
  const WEDGE = 0.52;
  const TAU = Math.PI * 2;
  const NIGHT = [12, 16, 14];
  const DAWN = [214, 196, 160];
  const GROUND = [17, 24, 20];
  const GROUND_DAY = [132, 122, 96];
  const RINGS = { mouse: 0.96, moth: 0.78, fox: 1.1 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.querySelector("#field");
  const ctx = canvas.getContext("2d");
  const veil = document.querySelector("[data-veil]");
  const veilText = document.querySelector("[data-veil-text]");
  const startBtn = document.querySelector("[data-start]");
  const scoreEl = document.querySelector("[data-score]");
  const clockEl = document.querySelector("[data-clock]");
  const dawnEl = document.querySelector("[data-dawn]");

  const stars = Array.from({ length: 20 }, (_, i) => ({
    x: ((i * 53) % 97) / 97,
    y: ((i * 31) % 97) / 97,
    r: 0.6 + (i % 3) * 0.45,
  }));

  let view = { w: 1, h: 1, cx: 0, cy: 0, R: 1, dead: 1 };
  let phase = "intro";
  let head = -Math.PI / 2;
  let aim = head;
  let score = 0;
  let left = ROUND;
  let clock = 0;
  let creatures = [];
  let gaze = 0;
  let watched = null;
  let flash = null;
  let cool = 0;
  let stiff = 0;
  let shake = 0;
  let lunging = 0;
  let spawnIn = 0;
  let foxIn = 0;
  let creakCool = 0;
  let skyT = 0;
  let last = 0;
  let lastSense = 0;
  let lastAngle = 0;
  let drag = null;
  const held = new Set();

  function short(d) {
    return Math.atan2(Math.sin(d), Math.cos(d));
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function rgb(c, a = 1) {
    const n = c.map((v) => Math.round(v));
    return a === 1 ? `rgb(${n[0]}, ${n[1]}, ${n[2]})` : `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
  }

  function dawnOf(elapsed) {
    const x = Math.max(0, (elapsed - 0.35) / 0.65);
    return x * x;
  }

  function preyWord(n) {
    const a = n % 10;
    const b = n % 100;
    if (a === 1 && b !== 11) return "добыча";
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return "добычи";
    return "добыч";
  }

  function layout() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const R = Math.min(w, h) * 0.33;
    view = { w, h, cx: w / 2, cy: h / 2, R, dead: R * 0.42 };
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

  function hud() {
    const nest = phase === "intro" ? "В гнезде —" : `В гнезде ${score}`;
    const time = phase === "done" ? "рассвело" : "до рассвета";
    if (scoreEl.textContent !== nest) scoreEl.textContent = nest;
    if (clockEl.textContent !== time) clockEl.textContent = time;
    const bar = phase === "done" ? 0 : left / ROUND;
    dawnEl.style.transform = `scaleX(${bar})`;
  }

  function showVeil(text, label) {
    veilText.textContent = text;
    startBtn.textContent = label;
    veil.hidden = false;
  }

  function spawn(kind, angle) {
    const at = angle == null ? freeAngle() : angle;
    creatures.push({
      kind,
      angle: at,
      dir: Math.random() < 0.5 ? -1 : 1,
      place: 1,
      speed: kind === "fox" ? 0.26 : kind === "moth" ? 0.72 + Math.random() * 0.28 : 0.32 + Math.random() * 0.2,
      mode: "walk",
      age: 0,
      alpha: 1,
      wobble: Math.random() * TAU,
      spooked: false,
    });
  }

  function freeAngle() {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU;
      const busy = creatures.some((c) => c.mode === "walk" && Math.abs(short(c.angle - a)) < 0.6);
      if (!busy) return a;
    }
    return Math.random() * TAU;
  }

  function begin() {
    score = 0;
    left = ROUND;
    skyT = 0;
    creatures = [];
    gaze = 0;
    watched = null;
    flash = null;
    cool = 0;
    stiff = 0;
    shake = 0;
    lunging = 0;
    creakCool = 0;
    head = -Math.PI / 2;
    aim = head;
    lastSense = 0;
    phase = "play";
    spawnIn = 2.4;
    foxIn = 12;
    spawn("mouse", head + 0.2);
    spawn("moth", head - 0.9);
    spawn("mouse", head + 2.5);
    veil.hidden = true;
    hud();
    canvas.focus({ preventScroll: true });
  }

  function finish() {
    phase = "done";
    const line = score <= 0
      ? "Рассвело. Гнездо пустое."
      : `Рассвело. В гнезде ${score} ${preyWord(score)}.`;
    showVeil(line, "Ещё ночь");
    hud();
  }

  function creak() {
    if (creakCool > 0 || phase !== "play") return;
    creakCool = 0.75;
    stiff = 0.32;
    shake = 1;
    gaze = 0;
    flash = { text: "скрип", life: 0.85 };
    for (const c of creatures) {
      if (c.kind === "mouse" && c.mode === "walk" && Math.abs(short(c.angle - head)) < 1.2) c.mode = "flee";
    }
  }

  function whiff() {
    gaze = 0;
    flash = { text: "мимо", life: 0.85 };
    for (const c of creatures) {
      if (c.kind === "mouse" && c.mode === "walk" && Math.abs(short(c.angle - head)) < 1.15) c.mode = "flee";
    }
  }

  function pick() {
    let best = null;
    let bestD = WEDGE;
    for (const c of creatures) {
      if (c.mode !== "walk") continue;
      const d = Math.abs(short(c.angle - head));
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  function strike() {
    if (phase !== "play" || cool > 0) return;
    cool = 0.42;
    lunging = 0.18;
    const hit = pick();
    if (!hit) return;
    if (hit.kind === "fox") {
      whiff();
      return;
    }
    hit.mode = "caught";
    score += 1;
    hud();
  }

  function spookFarthest() {
    let best = null;
    let bestD = -1;
    for (const c of creatures) {
      if (c.kind === "fox" || c.mode !== "walk") continue;
      const d = Math.abs(short(c.angle - head));
      if (d > bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best && bestD > WEDGE) best.mode = "flee";
  }

  function sense(angle) {
    const now = performance.now();
    if (lastSense) {
      const dt = (now - lastSense) / 1000;
      const jumped = Math.abs(short(angle - lastAngle));
      if (dt > 0.008 && dt < 0.1 && jumped < 2 && jumped / dt > 9) creak();
    }
    lastSense = now;
    lastAngle = angle;
  }

  function look(p, track) {
    layout();
    const dx = p.x - view.cx;
    const dy = p.y - view.cy;
    if (dx * dx + dy * dy < view.dead * view.dead) return false;
    const angle = Math.atan2(dy, dx);
    if (track && phase === "play") sense(angle);
    if (phase === "play") aim = angle;
    return true;
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function armed(p) {
    layout();
    const dx = p.x - view.cx;
    const dy = p.y - view.cy;
    if (dx * dx + dy * dy < view.dead * view.dead) return true;
    return Math.abs(short(Math.atan2(dy, dx) - head)) <= WEDGE + 0.06;
  }

  function step(dt) {
    clock += dt;
    shake = Math.max(0, shake - dt * 3.2);
    if (flash) {
      flash.life -= dt;
      if (flash.life <= 0) flash = null;
    }
    if (phase === "intro") {
      if (!reduced) head = -Math.PI / 2 + Math.sin(clock * 0.45) * 0.55;
      return;
    }
    if (phase !== "play") return;

    left -= dt;
    skyT = dawnOf(1 - left / ROUND);
    cool = Math.max(0, cool - dt);
    creakCool = Math.max(0, creakCool - dt);
    if (stiff > 0) stiff -= dt;
    if (lunging > 0) lunging = Math.max(0, lunging - dt);

    let turn = 0;
    if (held.has("ArrowLeft") || held.has("KeyA")) turn -= 1;
    if (held.has("ArrowRight") || held.has("KeyD")) turn += 1;
    if (turn) aim = head + turn * 0.85;

    const rate = stiff > 0 ? 1.15 : 5.2;
    const delta = short(aim - head);
    head += Math.max(-rate * dt, Math.min(rate * dt, delta));

    watched = null;
    let watchedD = WEDGE;
    for (const c of creatures) {
      if (c.mode === "walk") {
        c.angle += c.dir * c.speed * dt;
        c.age += dt;
        if (c.kind === "fox" && !c.spooked && c.age > 12) {
          c.spooked = true;
          spookFarthest();
        }
        if (c.kind === "fox") {
          const d = Math.abs(short(c.angle - head));
          if (d <= watchedD) {
            watched = c;
            watchedD = d;
          }
        }
      } else if (c.mode === "caught") {
        c.place = Math.max(0.04, c.place - dt * 1.7);
        c.alpha -= dt * 0.55;
        if (c.place <= 0.08) c.alpha = 0;
      } else {
        c.place += dt * 0.9;
        c.angle += c.dir * c.speed * 1.5 * dt;
        c.alpha -= dt * 1.2;
      }
    }
    if (watched) {
      gaze = Math.min(1, gaze + dt / 0.62);
      if (gaze >= 1) {
        watched.mode = "leave";
        watched = null;
        gaze = 0;
      }
    } else {
      gaze = Math.max(0, gaze - dt / 0.85);
    }
    creatures = creatures.filter((c) => c.alpha > 0.02 && c.place < 2.15);

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = 1.45 + Math.random() * 1.35;
      const prey = creatures.filter((c) => c.kind !== "fox" && c.mode === "walk").length;
      if (prey < 4) spawn(Math.random() < 0.32 ? "moth" : "mouse");
    }
    foxIn -= dt;
    if (foxIn <= 0) {
      foxIn = 18;
      if (!creatures.some((c) => c.kind === "fox" && c.alpha > 0.2)) spawn("fox", head + Math.PI);
    }

    if (left <= 0) {
      left = 0;
      skyT = 1;
      hud();
      finish();
      return;
    }
    hud();
  }

  function visibility(c) {
    if (c.mode === "caught") return c.alpha;
    const inside = Math.abs(short(c.angle - head)) <= WEDGE;
    if (inside) return c.alpha;
    if (skyT > 0.62) return c.alpha * ((skyT - 0.62) / 0.38);
    return 0;
  }

  function spot(c) {
    const bob = c.kind === "moth"
      ? Math.sin(clock * 6 + c.wobble) * 0.045
      : Math.sin(clock * 1.7 + c.wobble) * 0.018;
    const rad = view.R * (RINGS[c.kind] + bob) * c.place;
    return {
      x: view.cx + Math.cos(c.angle) * rad,
      y: view.cy + Math.sin(c.angle) * rad,
    };
  }

  function drawHint(c) {
    if (c.mode !== "walk" || skyT > 0.5) return;
    const diff = short(c.angle - head);
    const ad = Math.abs(diff);
    if (ad <= WEDGE || ad > WEDGE + 0.58) return;
    const strength = 1 - (ad - WEDGE) / 0.58;
    const edge = head + Math.sign(diff) * (WEDGE + 0.04);
    const rad = view.R * (c.kind === "fox" ? 1.12 : 1.0);
    const x = view.cx + Math.cos(edge) * rad;
    const y = view.cy + Math.sin(edge) * rad;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(3.2, view.R * 0.02) + strength * 2.2, 0, TAU);
    ctx.fillStyle = c.kind === "fox" ? `rgba(196, 107, 58, ${0.35 + strength * 0.65})` : `rgba(226, 177, 90, ${0.3 + strength * 0.7})`;
    ctx.fill();
  }

  function drawMouse(x, y, angle, dir, u, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (Math.PI / 2) * dir);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#d9cbb6";
    ctx.beginPath();
    ctx.ellipse(u * 0.15, 0, u * 1.05, u * 0.62, 0, 0, TAU);
    ctx.arc(u * 0.72, -u * 0.38, u * 0.26, 0, TAU);
    ctx.arc(u * 0.72, u * 0.38, u * 0.26, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-u * 0.7, 0);
    ctx.quadraticCurveTo(-u * 1.35, -u * 0.7, -u * 1.55, -u * 0.05);
    ctx.strokeStyle = "#d9cbb6";
    ctx.lineWidth = Math.max(1.25, u * 0.22);
    ctx.stroke();
    ctx.restore();
  }

  function drawMoth(x, y, angle, u, alpha, wobble) {
    const flap = 0.55 + Math.sin(clock * 14 + wobble) * 0.45;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(240, 215, 162, 0.92)";
    ctx.beginPath();
    ctx.ellipse(0, -u * 0.55, u * 0.85, u * 0.42 * flap, -0.5, 0, TAU);
    ctx.ellipse(0, u * 0.55, u * 0.85, u * 0.42 * flap, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f7f1e4";
    ctx.beginPath();
    ctx.ellipse(u * 0.1, 0, u * 0.42, u * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawFox(x, y, angle, dir, u, alpha, showGaze) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + (Math.PI / 2) * dir);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#e07a42";
    ctx.beginPath();
    ctx.ellipse(-u * 0.15, 0, u * 1.55, u * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(u * 1.25, 0, u * 0.72, u * 0.48, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(u * 1.15, -u * 0.28);
    ctx.lineTo(u * 0.85, -u * 0.95);
    ctx.lineTo(u * 1.55, -u * 0.42);
    ctx.moveTo(u * 1.15, u * 0.28);
    ctx.lineTo(u * 0.85, u * 0.95);
    ctx.lineTo(u * 1.55, u * 0.42);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-u * 1.45, 0);
    ctx.quadraticCurveTo(-u * 2.35, -u * 1.05, -u * 2.55, -u * 0.15);
    ctx.strokeStyle = "#e07a42";
    ctx.lineWidth = Math.max(1.5, u * 0.34);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    if (!showGaze) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, u * 2.5, -Math.PI / 2, -Math.PI / 2 + gaze * TAU);
    ctx.strokeStyle = "rgba(240, 215, 162, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  function drawCreature(c) {
    const alpha = visibility(c);
    if (alpha <= 0.02) return;
    const p = spot(c);
    const u = Math.max(8, view.R * 0.074);
    if (c.kind === "mouse") drawMouse(p.x, p.y, c.angle, c.dir, u, alpha);
    else if (c.kind === "moth") drawMoth(p.x, p.y, c.angle, u * 0.9, alpha, c.wobble);
    else drawFox(p.x, p.y, c.angle, c.dir, u * 1.22, alpha, c === watched && gaze > 0.02);
  }

  function drawOwl() {
    const { cx, cy, R } = view;
    const lunge = lunging > 0 ? Math.sin(((0.18 - lunging) / 0.18) * Math.PI) * R * 0.07 : 0;
    const bodyY = cy + R * 0.04;

    ctx.beginPath();
    ctx.moveTo(cx - R * 0.62, bodyY + R * 0.34);
    ctx.lineTo(cx + R * 0.62, bodyY + R * 0.34);
    ctx.strokeStyle = "rgba(226, 177, 90, 0.42)";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(cx, bodyY + R * 0.1, R * 0.2, R * 0.25, 0, 0, TAU);
    ctx.fillStyle = "#16130f";
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 215, 162, 0.78)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const n = Math.min(score, 8);
    const gap = Math.max(7, R * 0.065);
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (n - 1) / 2) * gap, bodyY + R * 0.48, Math.max(2.4, R * 0.026), 0, TAU);
      ctx.fillStyle = "#e2b15a";
      ctx.fill();
    }

    ctx.save();
    ctx.translate(cx + Math.cos(head) * lunge, cy + Math.sin(head) * lunge);
    ctx.rotate(head);
    const hr = R * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, TAU);
    ctx.fillStyle = "#1c1814";
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 215, 162, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "rgba(240, 215, 162, 0.92)";
    ctx.beginPath();
    ctx.moveTo(hr * 0.05, -hr * 0.62);
    ctx.lineTo(hr * 0.62, -hr * 1.18);
    ctx.lineTo(hr * 0.38, -hr * 0.28);
    ctx.closePath();
    ctx.moveTo(hr * 0.05, hr * 0.62);
    ctx.lineTo(hr * 0.62, hr * 1.18);
    ctx.lineTo(hr * 0.38, hr * 0.28);
    ctx.fill();

    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.arc(hr * 0.12, -hr * 0.34, hr * 0.24, 0, TAU);
    ctx.arc(hr * 0.12, hr * 0.34, hr * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.arc(hr * 0.2, -hr * 0.34, hr * 0.11, 0, TAU);
    ctx.arc(hr * 0.2, hr * 0.34, hr * 0.11, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(hr * 0.42, -hr * 0.1);
    ctx.lineTo(hr * 0.78, 0);
    ctx.lineTo(hr * 0.42, hr * 0.1);
    ctx.fillStyle = "#f0d7a2";
    ctx.fill();
    ctx.restore();
  }

  function drawFlash() {
    if (!flash) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, flash.life));
    ctx.fillStyle = "#f0d7a2";
    ctx.font = `600 ${Math.max(16, view.R * 0.11)}px Spectral, Palatino, Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(flash.text, view.cx, view.cy - view.R * 0.5);
    ctx.restore();
  }

  function drawDeco() {
    const u = Math.max(8, view.R * 0.074);
    const mouseAt = head + 0.16;
    drawMouse(
      view.cx + Math.cos(mouseAt) * view.R * 0.96,
      view.cy + Math.sin(mouseAt) * view.R * 0.96,
      mouseAt,
      1,
      u,
      1,
    );
    drawHint({ kind: "moth", mode: "walk", angle: head - 0.95 });
  }

  function draw() {
    resize();
    const { w, h, cx, cy, R } = view;
    const sky = mix(NIGHT, DAWN, skyT);
    const ground = mix(GROUND, GROUND_DAY, skyT);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = rgb(sky);
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    if (shake > 0 && !reduced) {
      const m = shake * 5;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    ctx.fillStyle = rgb(NIGHT, 1 - skyT);
    for (const star of stars) {
      ctx.globalAlpha = 0.35 + (star.r % 1) * 0.4;
      ctx.beginPath();
      ctx.arc(star.x * w, star.y * h, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.36, 0, TAU);
    ctx.fillStyle = rgb(ground);
    ctx.fill();

    const glow = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.36);
    glow.addColorStop(0, "rgba(0, 0, 0, 0)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = "rgba(243, 232, 210, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R * 1.24, head - WEDGE, head + WEDGE);
    ctx.closePath();
    const gx = cx + Math.cos(head) * R * 0.7;
    const gy = cy + Math.sin(head) * R * 0.7;
    const beam = ctx.createRadialGradient(cx, cy, 8, gx, gy, R * 1.2);
    const beamA = 0.22 * (1 - skyT * 0.7);
    beam.addColorStop(0, `rgba(240, 215, 162, ${beamA})`);
    beam.addColorStop(1, "rgba(226, 177, 90, 0)");
    ctx.fillStyle = beam;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(head - WEDGE) * R * 1.24, cy + Math.sin(head - WEDGE) * R * 1.24);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(head + WEDGE) * R * 1.24, cy + Math.sin(head + WEDGE) * R * 1.24);
    ctx.strokeStyle = `rgba(240, 215, 162, ${0.28 * (1 - skyT * 0.5)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (phase === "intro") drawDeco();
    for (const c of creatures) drawHint(c);
    for (const c of creatures) drawCreature(c);
    drawOwl();
    drawFlash();
    ctx.restore();
  }

  function frame(ts) {
    if (document.hidden) {
      last = 0;
    } else {
      const dt = Math.min(0.034, last ? (ts - last) / 1000 : 0.016);
      last = ts;
      step(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "play" || e.button !== 0) return;
    e.preventDefault();
    const p = point(e);
    drag = { id: e.pointerId, x: p.x, y: p.y, arm: armed(p) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    look(p, false);
  }, { passive: false });

  canvas.addEventListener("pointermove", (e) => {
    const p = point(e);
    const mine = drag && drag.id === e.pointerId;
    if (!mine && e.pointerType === "touch") return;
    if (mine && Math.hypot(p.x - drag.x, p.y - drag.y) > 22) drag.arm = false;
    look(p, true);
  });

  function release(e) {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.arm) strike();
    drag = null;
    lastSense = 0;
  }

  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
    lastSense = 0;
  });
  canvas.addEventListener("pointerleave", () => {
    if (!drag) lastSense = 0;
  });

  window.addEventListener("keydown", (e) => {
    if (phase !== "play") return;
    if (e.code === "Space" || e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
    if (e.code === "Space" && !e.repeat) strike();
    held.add(e.code);
  });
  window.addEventListener("keyup", (e) => held.delete(e.code));
  window.addEventListener("blur", () => held.clear());

  startBtn.addEventListener("click", () => {
    if (phase === "play") return;
    begin();
  });

  hud();
  requestAnimationFrame(frame);
})();
