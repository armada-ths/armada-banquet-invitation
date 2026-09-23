// Endless snowfall across the whole page, drawn on a fixed <canvas>.
// Near flakes are six-armed crystals that turn as they fall; far ones are soft specks.
(function () {
  const TAU = Math.PI * 2;
  const SPRITE = 96;

  // One pre-rendered crystal. Each arm is identical, so the flake is symmetric.
  function makeCrystal(kind) {
    const c = document.createElement("canvas");
    c.width = c.height = SPRITE;
    const g = c.getContext("2d");
    const R = SPRITE * 0.42;
    g.translate(SPRITE / 2, SPRITE / 2);
    g.strokeStyle = "#ffffff";
    g.fillStyle = "rgba(255, 255, 255, 0.35)";
    g.lineCap = "round";
    g.lineJoin = "round";
    g.shadowColor = "rgba(190, 220, 255, 0.95)";
    g.shadowBlur = 5;

    const branches = [];
    const count = kind === "plate" ? 1 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const t = 0.3 + (i / count) * 0.5 + Math.random() * 0.08;
      branches.push({ t, len: (1 - t) * R * (0.4 + Math.random() * 0.35) });
    }
    const sin60 = Math.sin(Math.PI / 3);
    const cos60 = Math.cos(Math.PI / 3);

    for (let k = 0; k < 6; k++) {
      g.save();
      g.rotate((k * Math.PI) / 3);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, kind === "plate" ? -R * 0.9 : -R);
      g.stroke();

      g.lineWidth = 2;
      for (const b of branches) {
        const y = -b.t * R;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(-b.len * sin60, y - b.len * cos60);
        g.moveTo(0, y);
        g.lineTo(b.len * sin60, y - b.len * cos60);
        g.stroke();
      }
      if (kind === "stellar") {
        // small diamond tip
        g.beginPath();
        g.moveTo(0, -R);
        g.lineTo(-R * 0.06, -R * 0.9);
        g.lineTo(0, -R * 0.8);
        g.lineTo(R * 0.06, -R * 0.9);
        g.closePath();
        g.fill();
        g.stroke();
      }
      g.restore();
    }

    // Hexagonal centre
    const hex = (r) => {
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3 + Math.PI / 6;
        g[k ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
    };
    g.lineWidth = 1.5;
    hex(R * (kind === "plate" ? 0.55 : 0.14));
    g.fill();
    g.stroke();
    if (kind === "plate") {
      hex(R * 0.3);
      g.stroke();
    }
    return c;
  }

  function createAmbientSnow(canvas, { reducedMotion = false } = {}) {
    const ctx = canvas.getContext("2d");
    const kinds = ["dendrite", "dendrite", "stellar", "stellar", "plate", "dendrite"];
    const sprites = kinds.map(makeCrystal);
    let w = 0;
    let h = 0;
    let t = 0;
    let dpr = 1;
    const flakes = [];

    function makeFlake(anywhere) {
      const depth = Math.random(); // 0 = far, 1 = near
      const crystal = depth > 0.55;
      const size = crystal ? 7 + (depth - 0.55) * 30 : 0.6 + depth * 2.4;
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -size * 2,
        size,
        sprite: crystal ? sprites[Math.floor(Math.random() * sprites.length)] : null,
        speed: 10 + depth * 45 + Math.random() * 8,
        drift: 6 + Math.random() * 16,
        freq: 0.3 + Math.random() * 0.7,
        phase: Math.random() * TAU,
        rot: Math.random() * TAU,
        spin: (Math.random() - 0.5) * 1.2,
        alpha: crystal ? 0.55 + Math.random() * 0.4 : 0.3 + depth * 0.5,
      };
    }

    function draw(dt) {
      t += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";

      for (const f of flakes) {
        if (dt) {
          f.y += f.speed * dt;
          f.x += Math.sin(t * f.freq + f.phase) * f.drift * dt;
          f.rot += f.spin * dt;
          if (f.y > h + f.size) Object.assign(f, makeFlake(false));
          if (f.x < -20) f.x = w + 20;
          else if (f.x > w + 20) f.x = -20;
        }
        ctx.globalAlpha = f.alpha;
        if (f.sprite) {
          const c = Math.cos(f.rot) * dpr;
          const s = Math.sin(f.rot) * dpr;
          ctx.setTransform(c, s, -s, c, f.x * dpr, f.y * dpr);
          ctx.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size);
        } else {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.size, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const target = Math.min(220, Math.round((w * h) / 8000));
      while (flakes.length < target) flakes.push(makeFlake(true));
      flakes.length = target;
      draw(0);
    }

    new ResizeObserver(resize).observe(canvas);
    if (!reducedMotion) {
      let last = performance.now();
      const frame = (now) => {
        draw(Math.min((now - last) / 1000, 0.05));
        last = now;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }

  window.Snow = { createAmbientSnow };
})();
