// Full-screen effects layer: frost dust, snow bursts and flying ice shards.
// Only animates while something is on screen.
(function () {
  const TAU = Math.PI * 2;
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  const particles = [];
  const shards = [];
  let running = false;
  let last = 0;

  function resize() {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * d);
    canvas.height = Math.round(window.innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function ensureRunning() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    if (particles.length || shards.length) requestAnimationFrame(frame);
    else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) {
        particles.splice(i, 1);
        continue;
      }
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.life += dt;
      if (s.life >= s.max) {
        shards.splice(i, 1);
        continue;
      }
      s.vy += 1500 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
      s.tumble += s.tumbleSpeed * dt;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const s of shards) {
      const fade = s.life < 0.45 ? 1 : Math.max(0, 1 - (s.life - 0.45) / (s.max - 0.45));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(1, Math.cos(s.tumble));
      ctx.translate(-s.cx, -s.cy);

      ctx.beginPath();
      s.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();

      ctx.save();
      ctx.clip();
      ctx.fillStyle = "rgba(185, 215, 250, 0.32)";
      ctx.fill();
      if (s.img && s.img.complete) {
        ctx.globalAlpha = fade * 0.7;
        ctx.drawImage(s.img, s.rect.left, s.rect.top, s.rect.width, s.rect.height);
      }
      ctx.restore();

      ctx.globalAlpha = fade * 0.85;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#ffffff";
    for (const p of particles) {
      ctx.globalAlpha = p.alpha * (1 - p.life / p.max);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Small flakes of frost that break loose and drift down.
  function dust(x, y, count, spread = 20) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread * 0.4,
        vx: (Math.random() - 0.5) * 50,
        vy: -Math.random() * 50,
        g: 220 + Math.random() * 120,
        drag: 1.2,
        r: 0.6 + Math.random() * 1.6,
        alpha: 0.6 + Math.random() * 0.4,
        life: 0,
        max: 1 + Math.random() * 1.2,
      });
    }
    ensureRunning();
  }

  // Snow exploding outwards from a point.
  function burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const speed = 150 + Math.random() * 650;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 120,
        g: 420,
        drag: 2.2,
        r: 0.8 + Math.random() * 2.4,
        alpha: 0.7 + Math.random() * 0.3,
        life: 0,
        max: 1 + Math.random() * 1.1,
      });
    }
    ensureRunning();
  }

  // Sutherland–Hodgman clip of a convex polygon to an axis-aligned rect.
  function clipToRect(poly, r) {
    const edges = [
      (p) => p[0] >= r.left, (p) => p[0] <= r.right,
      (p) => p[1] >= r.top, (p) => p[1] <= r.bottom,
    ];
    const cut = [
      (a, b) => lerpAt(a, b, (r.left - a[0]) / (b[0] - a[0])),
      (a, b) => lerpAt(a, b, (r.right - a[0]) / (b[0] - a[0])),
      (a, b) => lerpAt(a, b, (r.top - a[1]) / (b[1] - a[1])),
      (a, b) => lerpAt(a, b, (r.bottom - a[1]) / (b[1] - a[1])),
    ];
    let out = poly;
    for (let e = 0; e < 4 && out.length; e++) {
      const input = out;
      out = [];
      for (let i = 0; i < input.length; i++) {
        const cur = input[i];
        const prev = input[(i + input.length - 1) % input.length];
        const curIn = edges[e](cur);
        const prevIn = edges[e](prev);
        if (curIn) {
          if (!prevIn) out.push(cut[e](prev, cur));
          out.push(cur);
        } else if (prevIn) {
          out.push(cut[e](prev, cur));
        }
      }
    }
    return out;
  }

  function lerpAt(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  // Break `rect` (page coords) into radial shards around `origin` and fling them.
  function shatter(rect, origin, img) {
    const diag = Math.hypot(rect.width, rect.height);
    const rays = 10 + Math.floor(Math.random() * 4);
    const angles = [];
    for (let i = 0; i < rays; i++) angles.push((i / rays) * TAU + (Math.random() - 0.5) * (TAU / rays) * 0.7);
    angles.sort((a, b) => a - b);
    const rings = [0, diag * 0.13, diag * 0.32, diag * 2];
    const grid = rings.map((r) =>
      angles.map((a) => {
        const rr = r * (r ? 0.8 + Math.random() * 0.4 : 0);
        return [origin.x + Math.cos(a) * rr, origin.y + Math.sin(a) * rr];
      })
    );

    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < rays; i++) {
        const k = (i + 1) % rays;
        const poly = clipToRect([grid[j][i], grid[j][k], grid[j + 1][k], grid[j + 1][i]], rect);
        if (poly.length < 3) continue;
        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        const dx = cx - origin.x;
        const dy = cy - origin.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = 220 + Math.random() * 380 + (1 - Math.min(d / diag, 1)) * 250;
        shards.push({
          poly, cx, cy, x: cx, y: cy, rect, img,
          vx: (dx / d) * speed + (Math.random() - 0.5) * 80,
          vy: (dy / d) * speed - 260 - Math.random() * 200,
          rot: 0,
          spin: (Math.random() - 0.5) * 7,
          tumble: 0,
          tumbleSpeed: (Math.random() - 0.5) * 9,
          life: 0,
          max: 1 + Math.random() * 0.5,
        });
      }
    }
    ensureRunning();
  }

  window.FX = { dust, burst, shatter };
})();
