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

  // Optional special guest: drop the section entirely when no name is set.
  if (!cfg.specialGuest || !cfg.specialGuest.trim()) document.getElementById("guest").remove();

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
    const one = missing.size === 1;
    banner.textContent = `Draft: ${missing.size} field${one ? "" : "s"} still need${one ? "s" : ""} input in js/config.js`;
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
        let len = 0;
        try { len = path.getTotalLength(); } catch { /* some engines refuse; fall back to a fade */ }
        const draw = Math.min(Math.max(len / 1300, 0.1), 0.35);
        if (len > 0) {
          tl.fromTo(path,
            { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 },
            { strokeDashoffset: 0, duration: draw, ease: "power1.inOut" }, t);
        } else {
          tl.set(path, { fillOpacity: 0 }, 0);
        }
        tl.to(path, { fillOpacity: 1, duration: 0.28, ease: "power1.out" }, t + draw * 0.7);
        t += draw * 0.65; // overlap letters slightly so the writing flows
      }
    });
    tl.set({}, {}, t + 0.3); // let the last letter finish filling before moving on
  }

  // The full reveal plays the first time the card opens on each page load. Reopening it
  // after closing just fades the card up with everything already written.
  let fullReveal = null;

  // Put every animated element in its final, fully visible state.
  function showEverything() {
    gsap.set(dialog, { clearProps: "opacity,transform" });
    gsap.set(dialog.querySelectorAll(".reveal, .kicker"), { clearProps: "opacity,transform" });
    gsap.set(dialog.querySelectorAll(".title-art path"), { clearProps: "strokeDasharray,strokeDashoffset,fillOpacity" });
    gsap.set(".card-stamp .scribble", { strokeDashoffset: 0 });
  }

  function openCard() {
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", ""); // very old browsers without <dialog> support
    document.body.classList.add("revealed");
    if (!gsap) return;

    if (fullReveal) {
      fullReveal.progress(1); // finish the first reveal if it's still running
      gsap.fromTo(dialog, { opacity: 0, y: 28, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "power3.out" });
      return;
    }

    // Order: card rises, "Armada" is written, then "Grand Banquet", then the details,
    // and finally the stamp is scribbled in.
    const kicker = dialog.querySelector(".kicker");
    const details = [...dialog.querySelectorAll(".reveal")].filter((el) => el !== kicker);
    const tl = (fullReveal = gsap.timeline());
    try {
      tl.fromTo(dialog, { opacity: 0, y: 90, scale: 0.88 }, { opacity: 1, y: 0, scale: 1, duration: 1.1, ease: "expo.out" }, 0)
        .from(kicker, { opacity: 0, y: 10, duration: 0.7, ease: "power3.out" }, 0.25)
        .set(details, { opacity: 0, y: 16 }, 0)
        .set(".card-stamp .scribble", { strokeDashoffset: 100 }, 0);
      traceTitle(tl, 0.5);
      tl.to(details, { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" }, ">-0.15")
        .to(".card-stamp .scribble", { strokeDashoffset: 0, duration: 1, ease: "power1.inOut" }, ">-0.3");
    } catch (err) {
      // Never leave the card half-hidden because an animation couldn't be built.
      console.error("Card reveal failed, showing it without animation:", err);
      tl.kill();
      showEverything();
      return;
    }
    // Safety net: if frames stall (low-power mode, busy phone), finish the reveal anyway.
    setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, (tl.duration() + 1.5) * 1000);
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
      // (no per-letter blur: animating filters is expensive on slow phones)
      tl.from(split.chars, { opacity: 0, y: 34, rotateX: -70, duration: 1.2, stagger: 0.045 }, "-=1.1");
    } else {
      tl.from(".title", { opacity: 0, y: 24, duration: 1.2 }, "-=1.1");
    }
    tl.from(".envelope-btn", { opacity: 0, y: 50, scale: 0.94, duration: 1.4 }, "-=0.9")
      .from(".hint", { opacity: 0, duration: 0.8 }, "-=0.6");
    // The envelope must never stay invisible, even if animation frames stall.
    setTimeout(() => { if (tl.progress() < 1) tl.progress(1); }, (tl.duration() + 1.5) * 1000);
  }
})();
