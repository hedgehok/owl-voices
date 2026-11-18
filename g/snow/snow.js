(() => {
  const ROUND = 60;
  const SPEED = 118;
  const TAU = Math.PI * 2;

  const canvas = document.querySelector("#field");
  const ctx = canvas.getContext("2d");
  const veil = document.querySelector("[data-veil]");
  const veilText = document.querySelector("[data-veil-text]");
  const startBtn = document.querySelector("[data-start]");
  const scoreEl = document.querySelector("[data-score]");
  const clockEl = document.querySelector("[data-clock]");
  const dawnEl = document.querySelector("[data-dawn]");

  let view = { w: 1, h: 1 };
  let phase = "intro";
  let score = 0;
  let world = 0;
  let fence = SPEED * ROUND;
  let light = 0;
  let x = 0.5;
  let vx = 0;
  let rows = [];
  let cursor = 0;
  let fox = 0;
  let last = 0;
  let drag = null;
  let heldX = 0;

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

  function hud() {
    const nest = phase === "intro" ? "Унесено —" : `Унесено ${score}`;
    const time = phase === "done" ? "забор" : "до забора";
    if (scoreEl.textContent !== nest) scoreEl.textContent = nest;
    if (clockEl.textContent !== time) clockEl.textContent = time;
    const bar = phase === "done" ? 0 : Math.max(0, 1 - world / fence);
    dawnEl.style.transform = `scaleX(${bar})`;
  }

  function showVeil(text, label) {
    veilText.textContent = text;
    startBtn.textContent = label;
    veil.hidden = false;
  }

  function addRow() {
    const h = 100 + Math.random() * 46;
    const snowW = 0.32 + Math.random() * 0.28;
    const snowL = Math.random() * (1 - snowW);
    const mice = [];
    if (Math.random() < 0.7) mice.push(snowL + snowW * (0.28 + Math.random() * 0.44));
    rows.push({
      y: cursor,
      h,
      snowL,
      snowR: snowL + snowW,
      mice,
      gone: mice.map(() => false),
      drift: 0.28 + Math.random() * 0.44,
      shrub: Math.random(),
      stone: Math.random(),
    });
    cursor += h;
  }

  function ensure() {
    while (cursor < world + view.h + 280) addRow(false);
  }

  function begin() {
    score = 0;
    world = 0;
    fence = SPEED * ROUND;
    light = 0;
    x = 0.5;
    vx = 0;
    fox = 0;
    rows = [];
    cursor = 0;
    ensure();
    const under = rowAt(view.h * 0.7);
    if (under) {
      under.snowL = 0.16;
      under.snowR = 0.84;
      under.mice = [];
      under.gone = [];
    }
    phase = "play";
    veil.hidden = true;
    hud();
    canvas.focus({ preventScroll: true });
  }

  function finish() {
    phase = "done";
    const line = score <= 0 ? "Забор. Когти пустые." : `Забор. Унесено ${score}.`;
    showVeil(line, "Ещё полёт");
    hud();
  }

  function owlWorld() {
    return world + view.h * 0.7;
  }

  function rowAt(y) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      if (y >= row.y && y < row.y + row.h) return row;
    }
    return null;
  }

  function onSnow(row) {
    return !!row && x >= row.snowL && x <= row.snowR;
  }

  function step(dt) {
    if (phase === "intro") return;
    if (phase !== "play") return;

    if (drag) vx += (drag.x - x) * 1.35 * dt;
    else if (heldX !== 0) vx += heldX * 0.55 * dt;
    vx *= Math.exp(-0.48 * dt);
    x = Math.max(0.08, Math.min(0.92, x + vx * dt));

    world += SPEED * dt;
    light = Math.min(1, world / fence);
    ensure();

    const row = rowAt(owlWorld());
    const snow = onSnow(row);
    fox = snow ? Math.max(0, fox - dt * 1.4) : Math.min(1, fox + dt * 3.4);
    if (row) {
      row.mice.forEach((mx, i) => {
        if (row.gone[i]) return;
        if (Math.abs(mx - x) > 0.075) return;
        const ahead = row.y + row.h * 0.45;
        if (Math.abs(ahead - owlWorld()) > 46) return;
        row.gone[i] = true;
        if (snow) score += 1;
      });
    }
    hud();
    if (world >= fence) finish();
  }

  function drawReed(x, y, len, lean) {
    ctx.strokeStyle = "rgba(78, 88, 66, 0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean, y - len * 0.55, x + lean * 0.45, y - len);
    ctx.stroke();
  }

  function drawShrub(x, y, s) {
    ctx.fillStyle = "#24362c";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.2, s * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#314438";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.28, y - s * 0.18, s * 0.58, s * 0.34, 0, 0, TAU);
    ctx.fill();
  }

  function drawField() {
    const { w, h } = view;
    const sky = 18 + light * 150;
    ctx.fillStyle = `rgb(${sky}, ${sky - 4}, ${sky - 10})`;
    ctx.fillRect(0, 0, w, h);
    const margin = w * 0.08;
    const fieldW = w - margin * 2;
    ctx.fillStyle = "#14110e";
    ctx.fillRect(margin, 0, fieldW, h);
    const span = 36;
    for (let y = Math.floor(world / span) * span; y < world + h + span; y += span) {
      const screen = y - world;
      const lean = ((y / span) | 0) % 2 === 0 ? 5 : -4;
      drawReed(margin - 7, screen, 18, lean);
      drawReed(margin + fieldW + 7, screen + 14, 15, -lean);
    }
    for (const row of rows) {
      const top = row.y - world;
      if (top > h || top + row.h < 0) continue;
      const snowX = margin + row.snowL * fieldW;
      const snowW = (row.snowR - row.snowL) * fieldW;
      const snow = light > 0.65 ? "#e4dcc8" : "#cfc6b4";
      const pad = Math.min(10, row.h * 0.12);
      ctx.fillStyle = snow;
      ctx.beginPath();
      ctx.roundRect(snowX, top + pad, snowW, Math.max(8, row.h - pad * 2), Math.min(18, snowW * 0.18));
      ctx.fill();
      ctx.fillStyle = "rgba(255, 250, 242, 0.16)";
      ctx.beginPath();
      ctx.ellipse(snowX + snowW * (row.drift || 0.5), top + row.h * 0.42, Math.max(12, snowW * 0.2), row.h * 0.14, 0, 0, TAU);
      ctx.fill();
      if (snowW > 28) {
        drawReed(snowX + 10, top + row.h * 0.7, 15, -3);
        drawReed(snowX + snowW - 10, top + row.h * 0.55, 14, 3);
      }
      const leftW = snowX - margin;
      const rightX = snowX + snowW;
      const rightW = margin + fieldW - rightX;
      if (leftW > 28 && row.shrub > 0.2) drawShrub(margin + leftW * 0.45, top + row.h * 0.62, Math.min(18, leftW * 0.28));
      if (rightW > 28 && row.shrub < 0.8) drawShrub(rightX + rightW * 0.55, top + row.h * 0.48, Math.min(18, rightW * 0.28));
      if (leftW > 22 && row.stone > 0.55) {
        ctx.fillStyle = "#2a261f";
        ctx.beginPath();
        ctx.ellipse(margin + leftW * 0.7, top + row.h * 0.35, 7, 3.5, 0.4, 0, TAU);
        ctx.fill();
      }
      row.mice.forEach((mx, i) => {
        if (row.gone[i]) return;
        const my = top + row.h * 0.45;
        const mxp = margin + mx * fieldW;
        ctx.fillStyle = "#5c5144";
        ctx.beginPath();
        ctx.ellipse(mxp, my, Math.max(5, w * 0.014), Math.max(3.5, w * 0.009), 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#5c5144";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mxp - Math.max(4, w * 0.01), my);
        ctx.quadraticCurveTo(mxp - Math.max(8, w * 0.02), my - 3, mxp - Math.max(7, w * 0.018), my - 6);
        ctx.stroke();
      });
    }
    const fenceY = fence - world;
    if (fenceY < h + 30) {
      ctx.strokeStyle = "rgba(226, 177, 90, 0.45)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(margin, fenceY - 6);
      ctx.lineTo(margin + fieldW, fenceY - 6);
      ctx.moveTo(margin, fenceY - 15);
      ctx.lineTo(margin + fieldW, fenceY - 15);
      ctx.stroke();
      ctx.fillStyle = "#5c4936";
      for (let i = 0; i <= 6; i++) {
        const px = margin + (fieldW * i) / 6;
        ctx.fillRect(px - 2.5, fenceY - 24, 5, 28);
      }
    }
    return { margin, fieldW };
  }

  function drawOwl(margin, fieldW) {
    const { w, h } = view;
    const px = margin + x * fieldW;
    const py = h * 0.7;
    const u = Math.max(11, w * 0.034);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(vx * 0.5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(u * 0.4, u * 1.5, u * 0.8, u * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.ellipse(-u * 0.85, u * 0.1, u * 0.72, u * 0.28, -0.7, 0, TAU);
    ctx.ellipse(u * 0.85, u * 0.1, u * 0.72, u * 0.28, 0.7, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 0.72, u * 1.05, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#e2b15a";
    ctx.beginPath();
    ctx.arc(-u * 0.28, -u * 0.15, u * 0.16, 0, TAU);
    ctx.arc(u * 0.28, -u * 0.15, u * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1a140c";
    ctx.beginPath();
    ctx.arc(-u * 0.28, -u * 0.15, u * 0.07, 0, TAU);
    ctx.arc(u * 0.28, -u * 0.15, u * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (fox > 0.04) {
      const side = x < 0.5 ? -1 : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(1, fox * 1.3);
      ctx.translate(px + side * u * 2.6, py + u * 1.35);
      ctx.fillStyle = "#e07a42";
      ctx.beginPath();
      ctx.ellipse(0, 0, u * 0.95, u * 0.62, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-u * 0.4, -u * 0.25);
      ctx.lineTo(-u * 0.7, -u * 1.15);
      ctx.lineTo(-u * 0.05, -u * 0.4);
      ctx.moveTo(u * 0.4, -u * 0.25);
      ctx.lineTo(u * 0.7, -u * 1.15);
      ctx.lineTo(u * 0.05, -u * 0.4);
      ctx.fill();
      ctx.fillStyle = "#1a140c";
      ctx.beginPath();
      ctx.arc(-u * 0.28, -u * 0.05, u * 0.1, 0, TAU);
      ctx.arc(u * 0.28, -u * 0.05, u * 0.1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw() {
    resize();
    if (rows.length === 0) {
      cursor = 0;
      ensure();
    }
    const field = drawField();
    drawOwl(field.margin, field.fieldW);
  }

  function frame(ts) {
    if (document.hidden) last = 0;
    else {
      const dt = Math.min(0.034, last ? (ts - last) / 1000 : 0.016);
      last = ts;
      step(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    const margin = view.w * 0.08;
    const fieldW = view.w - margin * 2;
    drag = {
      id: e.pointerId,
      x: Math.max(0.08, Math.min(0.92, (e.clientX - r.left - margin) / fieldW)),
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (phase !== "play" || e.button !== 0) return;
    e.preventDefault();
    setPointer(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  }, { passive: false });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    setPointer(e);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });

  window.addEventListener("keydown", (e) => {
    if (phase !== "play") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") heldX = -1;
    if (e.code === "ArrowRight" || e.code === "KeyD") heldX = 1;
    if (e.code === "ArrowLeft" || e.code === "ArrowRight") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA" || e.code === "ArrowRight" || e.code === "KeyD") heldX = 0;
  });
  window.addEventListener("blur", () => { heldX = 0; drag = null; });

  startBtn.addEventListener("click", () => {
    if (phase === "play") return;
    begin();
  });

  hud();
  requestAnimationFrame(frame);
})();
