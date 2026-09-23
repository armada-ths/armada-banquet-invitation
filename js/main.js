(function () {
  const cfg = window.INVITATION || {};
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gsap = !reducedMotion && window.gsap ? window.gsap : null;
  const isPlaceholder = (v) => typeof v !== "string" || v.trim() === "" || v.startsWith("[NEEDS INPUT");
  const missing = new Set();

  function markMissing(el, key) {
    el.classList.add("needs-input");
    missing.add(key);
  }

  // Fill text fields from config.
  document.querySelectorAll("[data-field]").forEach((el) => {
    const key = el.dataset.field;
    const value = cfg[key];
    el.textContent = value ?? `[NEEDS INPUT: ${key}]`;
    if (isPlaceholder(value)) markMissing(el, key);
  });

  const ticket = document.getElementById("ticket-link");
  if (isPlaceholder(cfg.ticketUrl) || !/^https:\/\//i.test(cfg.ticketUrl)) {
    ticket.removeAttribute("href");
    ticket.setAttribute("aria-disabled", "true");
    markMissing(ticket, "ticketUrl");
  } else {
    ticket.href = cfg.ticketUrl;
  }

  const map = document.getElementById("venue-map");
  if (!isPlaceholder(cfg.venueAddress)) {
    const query = [cfg.venueName, cfg.venueAddress].filter((v) => !isPlaceholder(v)).join(", ");
    map.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query);
  }

  const contact = document.getElementById("contact-link");
  if (!isPlaceholder(cfg.contactEmail)) contact.href = "mailto:" + cfg.contactEmail;

  if (missing.size) {
    const banner = document.getElementById("draft-banner");
    banner.textContent = `Draft: ${missing.size} field${missing.size === 1 ? "" : "s"} still need input in js/config.js`;
    banner.hidden = false;
    console.warn("Invitation fields still needing input:", [...missing]);
  }

  Snow.createAmbientSnow(document.getElementById("ambient-snow"), { reducedMotion });

  // Envelope -> invitation card
  const btn = document.getElementById("envelope");
  const hint = document.getElementById("hint");
  const dialog = document.getElementById("invitation");

  // Hand-trace the title: each letter's outline is drawn like a pen stroke, then its ink
  // fills in. Letters go one after another, "Armada" first, then "Grand Banquet".
  function traceTitle(tl, at) {
    const lines = [...dialog.querySelectorAll(".title-art .title-line")];
    let t = at;
    lines.forEach((line, i) => {
      if (i > 0) t += 0.15; // brief lift of the pen between lines
      for (const path of line.querySelectorAll("path")) {
        const len = path.getTotalLength();
        const draw = Math.min(Math.max(len / 1300, 0.1), 0.35);
        tl.fromTo(path,
          { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 },
          { strokeDashoffset: 0, duration: draw, ease: "power1.inOut" }, t)
          .to(path, { fillOpacity: 1, duration: 0.28, ease: "power1.out" }, t + draw * 0.7);
        t += draw * 0.65; // overlap letters slightly so the writing flows
      }
    });
    tl.set({}, {}, t + 0.3); // let the last letter finish filling before moving on
  }

  function openCard() {
    dialog.showModal();
    document.body.classList.add("revealed");
    if (gsap) {
      // Order: card rises, "Armada" is written, then "Grand Banquet", then the details,
      // and finally the stamp is pressed onto the paper.
      const kicker = dialog.querySelector(".kicker");
      const details = [...dialog.querySelectorAll(".reveal")].filter((el) => el !== kicker);

      const tl = gsap.timeline();
      tl.fromTo(dialog, { opacity: 0, y: 90, scale: 0.88 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out" }, 0)
        .from(kicker, { opacity: 0, y: 10, duration: 0.7, ease: "power3.out" }, 0.25)
        .set(details, { opacity: 0, y: 16 }, 0)
        .set(".card-stamp", { opacity: 0 }, 0);
      traceTitle(tl, 0.5);
      tl.to(details, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" }, ">-0.15")
        .fromTo(".card-stamp", { scale: 1.7, opacity: 0, rotation: -12 }, { scale: 1, opacity: 0.85, rotation: -12, duration: 0.32, ease: "power4.in" }, ">-0.3");
    }
  }

  createEnvelope(btn, {
    reducedMotion,
    onOpen: openCard,
    onHint: (text) => (hint.textContent = text),
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("revealed");
    hint.textContent = "Tap to view your invitation";
    btn.focus();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close(); // click on the backdrop
  });
  dialog.querySelector(".close").addEventListener("click", () => dialog.close());

  // Load-in choreography.
  if (gsap) {
    // Keep animations on the clock even when frames drop, so the envelope is
    // never stuck invisible on a slow phone.
    gsap.ticker.lagSmoothing(0);
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.from(".eyebrow", { opacity: 0, y: 12, letterSpacing: "0.8em", duration: 1.4 });
    if (window.SplitText) {
      gsap.registerPlugin(SplitText);
      const split = SplitText.create(".title", { type: "chars" });
      tl.from(split.chars, { opacity: 0, y: 34, rotateX: -70, filter: "blur(8px)", duration: 1.2, stagger: 0.045 }, "-=1.1");
    } else {
      tl.from(".title", { opacity: 0, y: 24, duration: 1.2 }, "-=1.1");
    }
    tl.from(".envelope-btn", { opacity: 0, y: 50, scale: 0.94, duration: 1.4 }, "-=0.9")
      .from(".hint", { opacity: 0, duration: 0.8 }, "-=0.6");
  }
})();
