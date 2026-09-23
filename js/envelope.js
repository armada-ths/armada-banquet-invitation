// The frozen envelope: three taps with growing shakes and cracks, then the ice
// shatters, the flap opens and the letter slides out.
(function () {
  const TAU = Math.PI * 2;
  const HINTS = ["Tap the ice to break it", "It's cracking… tap again", "One more!", ""];
  const SHAKE_DEGREES = [2.2, 4.5, 8];

  // Damped springs drive the shake, so a new tap adds to whatever motion is
  // already happening instead of restarting an animation.
  function createShaker(el) {
    const springs = {
      rot: { x: 0, v: 0, f: 5.2, z: 0.16 },
      tx: { x: 0, v: 0, f: 4.4, z: 0.18 },
      ty: { x: 0, v: 0, f: 7.5, z: 0.28 },
    };
    let running = false;
    let last = 0;
    let dir = Math.random() < 0.5 ? -1 : 1;

    function frame(now) {
      let dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      let moving = false;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 120);
        dt -= h;
        for (const s of Object.values(springs)) {
          const w = TAU * s.f;
          s.v += (-w * w * s.x - 2 * s.z * w * s.v) * h;
          s.x += s.v * h;
        }
      }
      for (const s of Object.values(springs)) {
        if (Math.abs(s.x) > 0.01 || Math.abs(s.v) > 0.05) moving = true;
      }
      const { rot, tx, ty } = springs;
      el.style.transform = moving ? `translate(${tx.x.toFixed(2)}px, ${ty.x.toFixed(2)}px) rotate(${rot.x.toFixed(3)}deg)` : "";
      if (moving) requestAnimationFrame(frame);
      else running = false;
    }

    return {
      kick(degrees) {
        dir = -dir;
        const { rot, tx, ty } = springs;
        rot.v += dir * degrees * TAU * rot.f;
        tx.v += -dir * degrees * 1.8 * TAU * tx.f;
        ty.v += -degrees * 0.5 * TAU * ty.f;
        if (!running) {
          running = true;
          last = performance.now();
          requestAnimationFrame(frame);
        }
      },
      settle() {
        for (const s of Object.values(springs)) s.z = 0.45;
      },
    };
  }

  const SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  const toD = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L");

  // Ice fractures run mostly straight, with the occasional sharp kink.
  function crackLine(x, y, angle, length) {
    const pts = [[x, y]];
    let a = angle;
    let travelled = 0;
    while (travelled < length) {
      const seg = Math.min(length - travelled, 8 + Math.random() * 16);
      a += Math.random() < 0.18 ? (Math.random() - 0.5) * 0.9 : (Math.random() - 0.5) * 0.16;
      x += Math.cos(a) * seg;
      y += Math.sin(a) * seg;
      travelled += seg;
      pts.push([x, y]);
    }
    return pts;
  }

  // Filled outline of a crack that is widest at the impact and tapers to a hairline.
  function taperedD(pts, width) {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const total = lens[lens.length - 1] || 1;
    const left = [];
    const right = [];
    pts.forEach(([x, y], i) => {
      const [ax, ay] = pts[Math.max(i - 1, 0)];
      const [bx, by] = pts[Math.min(i + 1, pts.length - 1)];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const w = (width * Math.pow(1 - lens[i] / total, 0.8) + 0.2) / 2;
      left.push([x + nx * w, y + ny * w]);
      right.push([x - nx * w, y - ny * w]);
    });
    return toD(left.concat(right.reverse())) + "Z";
  }

  // Point roughly `r` along a crack from its start.
  function pointAt(pts, r) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d >= r) return pts[i];
    }
    return null;
  }

  function createEnvelope(btn, { reducedMotion = false, onOpen, onHint }) {
    const envelope = btn.querySelector(".envelope");
    const ice = btn.querySelector(".ice");
    const cracksSvg = btn.querySelector(".cracks");
    const shaker = createShaker(btn.querySelector(".shaker"));
    const frost = new Image();
    frost.src = "assets/frost.webp";

    let taps = 0;
    let locked = false;
    let opened = false;
    let lastImpact = null;

    function impactPoint(e) {
      const rect = ice.getBoundingClientRect();
      const keyboard = e.detail === 0 || (e.clientX === 0 && e.clientY === 0);
      const px = keyboard ? rect.left + rect.width * (0.35 + Math.random() * 0.3) : e.clientX;
      const py = keyboard ? rect.top + rect.height * (0.35 + Math.random() * 0.3) : e.clientY;
      const x = Math.min(Math.max(px, rect.left + 8), rect.right - 8);
      const y = Math.min(Math.max(py, rect.top + 8), rect.bottom - 8);
      return {
        page: { x, y },
        local: { x: ((x - rect.left) / rect.width) * ice.offsetWidth, y: ((y - rect.top) / rect.height) * ice.offsetHeight },
      };
    }

    function drawCracks(p, level) {
      const w = ice.offsetWidth;
      const h = ice.offsetHeight;
      const diag = Math.hypot(w, h);
      cracksSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      const defs = cracksSvg.querySelector("defs") || svgEl("defs", {}, cracksSvg);

      // The crack front spreads outward from the impact: reveal through a growing circle.
      const maskId = `crack-mask-${level}`;
      const mask = svgEl("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: -50, y: -50, width: w + 100, height: h + 100 }, defs);
      const front = svgEl("circle", { cx: p.x, cy: p.y, r: 0, fill: "#fff" }, mask);
      const g = svgEl("g", { mask: `url(#${maskId})` }, cracksSvg);

      const rays = [5, 7, 11][level - 1];
      const reach = [0.13, 0.28, 0.65][level - 1] * diag;
      const width = [1.6, 2.1, 2.6][level - 1];
      const offset = Math.random() * TAU;
      const radials = [];
      for (let i = 0; i < rays; i++) {
        const a = offset + (i / rays) * TAU + (Math.random() - 0.5) * 0.45;
        const pts = crackLine(p.x, p.y, a, reach * (0.55 + Math.random() * 0.6));
        radials.push(pts);
        if (level >= 2 && Math.random() < 0.35) {
          const from = pts[Math.floor(pts.length * (0.4 + Math.random() * 0.35))];
          const dir = a + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.3);
          radials.push(crackLine(from[0], from[1], dir, reach * 0.3));
        }
      }

      function drawCrack(pts, tapered) {
        const d = toD(pts);
        const side = Math.random() < 0.5 ? -1 : 1;
        const [x0, y0] = pts[0];
        const [x1, y1] = pts[pts.length - 1];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = (-(y1 - y0) / len) * side;
        const ny = ((x1 - x0) / len) * side;
        // Fracture plane catching the light, a shadowed edge, then the bright crack itself.
        svgEl("path", { d, class: "crack-plane", filter: "url(#crackBlur)", transform: `translate(${(nx * 2.5).toFixed(1)} ${(ny * 2.5).toFixed(1)})` }, g);
        svgEl("path", { d, class: "crack-shadow", transform: `translate(${(-nx * 0.8).toFixed(1)} ${(-ny * 0.8).toFixed(1)})` }, g);
        if (tapered) svgEl("path", { d: taperedD(pts, width), class: "crack-core" }, g);
        else svgEl("path", { d, class: "crack-chord" }, g);
      }

      radials.forEach((pts) => drawCrack(pts, true));

      // Concentric chords between neighbouring radials: the spider-web pattern.
      const rings = level === 1 ? [] : level === 2 ? [0.35] : [0.22, 0.48];
      for (const frac of rings) {
        for (let i = 0; i < rays; i++) {
          if (Math.random() < 0.3) continue;
          const r = reach * frac * (0.85 + Math.random() * 0.3);
          const a = pointAt(radials[i], r);
          const b = pointAt(radials[(i + 1) % rays], r);
          if (!a || !b) continue;
          const mid = [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * 6, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * 6];
          drawCrack([a, mid, b], false);
        }
      }

      // Crushed, frosty spot where it was hit, with tiny micro-cracks.
      svgEl("circle", { cx: p.x, cy: p.y, r: [6, 9, 13][level - 1], fill: "url(#bruiseGrad)" }, g);
      for (let i = 0; i < 8 * level; i++) {
        const a = Math.random() * TAU;
        const r0 = Math.random() * 3;
        const r1 = r0 + 2 + Math.random() * (4 + level * 2);
        svgEl("path", {
          d: `M${(p.x + Math.cos(a) * r0).toFixed(1)} ${(p.y + Math.sin(a) * r0).toFixed(1)}L${(p.x + Math.cos(a) * r1).toFixed(1)} ${(p.y + Math.sin(a) * r1).toFixed(1)}`,
          class: "crack-micro",
        }, g);
      }

      const maxR = reach * 1.3;
      const duration = 240 + level * 70;
      const start = performance.now();
      (function grow(now) {
        // rAF timestamps can be slightly earlier than `start`, so clamp at 0 too
        const t = Math.min(Math.max((now - start) / duration, 0), 1);
        front.setAttribute("r", (maxR * (1 - Math.pow(1 - t, 3))).toFixed(1));
        if (t < 1) requestAnimationFrame(grow);
      })(start);
    }

    function openFully() {
      opened = true;
      onOpen();
    }

    function shatter() {
      const rect = ice.getBoundingClientRect();
      shaker.settle();
      FX.shatter(rect, lastImpact, frost);
      FX.burst(lastImpact.x, lastImpact.y, 160);
      ice.classList.add("gone");
      // Beats: rest on the freed wax seal, open the flap, slide the letter out,
      // rest on the letter and its stamp, then show the invitation.
      const SEAL_PAUSE = 950;
      const FLAP_TIME = 1000;
      const LETTER_TIME = 1300;
      const LETTER_PAUSE = 400;
      setTimeout(() => {
        envelope.classList.add("flap-open");
        document.body.classList.add("envelope-open");
      }, SEAL_PAUSE);
      setTimeout(() => envelope.classList.add("letter-out"), SEAL_PAUSE + FLAP_TIME * 0.7);
      setTimeout(openFully, SEAL_PAUSE + FLAP_TIME * 0.7 + LETTER_TIME + LETTER_PAUSE);
    }

    btn.addEventListener("click", (e) => {
      if (opened) return onOpen();
      if (locked) return;

      if (reducedMotion) {
        locked = true;
        ice.classList.add("gone");
        envelope.classList.add("flap-open", "letter-out");
        document.body.classList.add("envelope-open");
        onHint("");
        return openFully();
      }

      taps += 1;
      const p = impactPoint(e);
      lastImpact = p.page;
      shaker.kick(SHAKE_DEGREES[taps - 1]);
      drawCracks(p.local, taps);
      ice.animate([{ filter: "brightness(1.35)" }, { filter: "brightness(1)" }], { duration: 350, easing: "ease-out" });
      FX.dust(p.page.x, p.page.y, 10 * taps, 30 * taps);
      onHint(HINTS[taps]);

      if (taps === 3) {
        locked = true;
        setTimeout(shatter, 450);
      }
    });

    onHint(HINTS[0]);
  }

  window.createEnvelope = createEnvelope;
})();
