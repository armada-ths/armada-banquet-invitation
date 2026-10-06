// All invitation text lives here. Anything still starting with "[NEEDS INPUT"
// is shown with a red dashed outline on the page and listed in the console,
// so a half-filled invitation can't go out unnoticed.
window.INVITATION = {
  // The handwritten card title ("Armada Grand Banquet") is pre-rendered as SVG by
  // tools/make_title_svg.py; change the text there and re-run it.
  tagline: "An Evening Carved in Ice",
  intro: "We would be delighted to have you join us for an unforgettable winter evening.",

  date: "Tuesday 17 November 2026",
  time: "Dinner 18:00–22:00",
  afterParty: "After party until 01:00",

  venueName: "Clarion Hotel Sign",
  venueAddress: "Östra Järnvägsgatan 37, Stockholm",

  dressCode: "Dark Suit",

  // Leave specialGuest empty ("") to hide the section.
  specialGuestLabel: "Special Guest",
  specialGuest: "Edward Blom",

  // Must be a full https:// link to the Universe registration page.
  ticketUrl: "https://www.universe.com/events/the-grand-armada-banquet-2026-tickets-8LN5P3?unii-trigger-open=8LN5P3",
  ticketLabel: "Reserve Your Seat",
  dietaryNote: "Dietary requirements and guest details are collected when you register.",

  contactEmail: "maria.alnajem@armada.nu",
};
