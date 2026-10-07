const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = (file) => fs.readFileSync(path.join(__dirname, "..", "js", file), "utf8");
const classes = () => ({ add() {}, remove() {} });

async function checkAccess(hash, storage = new Map(), cookie = "") {
  const window = {
    BANQUET_ACCESS_CONFIG: {
      tokenHash: "__BANQUET_ACCESS_TOKEN_SHA256__",
      expiresAt: "2099-01-01T00:00:00Z",
    },
    location: { hostname: "localhost", protocol: "http:", pathname: "/", search: "", hash },
    history: { replaceState() { window.location.hash = ""; } },
  };
  const document = {
    cookie,
    documentElement: { classList: classes() },
    getElementById: () => ({ hidden: true }),
  };
  vm.runInNewContext(source("access.js"), {
    window, document, URLSearchParams, TextEncoder,
    console: { error() {} },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  });
  return { access: await window.BANQUET_ACCESS.ready, storage, cookie: document.cookie, hash: window.location.hash };
}

for (const [suffix, audience] of [["", "guest"], ["&audience=", "guest"], ["&audience=guest", "guest"], ["&audience=company", "company"]]) {
  test(`audience selection: ${suffix || "missing"}`, async () => {
    const result = await checkAccess(`#access=dev&name=Anna${suffix}`);
    assert.equal(result.access.granted, true);
    assert.equal(result.access.audience, audience);
    assert.equal(result.hash, "");
  });
}

for (const hash of ["#access=dev&audience=other", "#access=dev&audience=guest&audience=company", "#audience=company", "#access=wrong&audience=company"]) {
  test(`invalid invitation: ${hash}`, async () => {
    const storage = new Map([["armada_banquet_audience", "company"]]);
    const result = await checkAccess(hash, storage);
    assert.equal(result.access.granted, false);
    assert.equal(storage.has("armada_banquet_audience"), false);
  });
}

test("reload preserves company; a new default invitation resets it", async () => {
  const first = await checkAccess("#access=dev&audience=company");
  const reload = await checkAccess("", first.storage, first.cookie);
  assert.equal(reload.access.audience, "company");
  const fresh = await checkAccess("#access=dev", first.storage, first.cookie);
  assert.equal(fresh.access.audience, "guest");
});

test("existing saved invitations without an audience default to guest", async () => {
  const result = await checkAccess("", new Map([["armada_banquet_invitee_name", "Anna"]]), "armada_banquet_access=dev");
  assert.equal(result.access.granted, true);
  assert.equal(result.access.audience, "guest");
});

async function render(audience, companyTicketUrl) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, classList: classes(), remove() {}, addEventListener() {},
      removeAttribute(key) { delete this[key]; },
      setAttribute(key, value) { this[key] = value; },
      querySelector() { return element("close"); },
    });
    return elements.get(id);
  }
  await vm.runInNewContext(source("main.js"), {
    window: {
      BANQUET_ACCESS: { ready: Promise.resolve({ granted: true, name: "", audience }) },
      INVITATION: { ticketUrl: "https://example.com/guests", companyTicketUrl },
      matchMedia: () => ({ matches: true }),
    },
    document: {
      getElementById: element, querySelector: () => element("recipient"),
      querySelectorAll: () => [], body: { classList: classes() },
    },
    Snow: { createAmbientSnow() {} }, createEnvelope() {}, console: { warn() {} },
  });
  return elements;
}

test("guest rendering uses the existing link", async () => {
  const elements = await render("guest", "");
  assert.equal(elements.get("ticket-link").href, "https://example.com/guests");
  assert.equal(elements.has("draft-banner"), false);
});

test("company rendering uses its separate link", async () => {
  const elements = await render("company", "https://example.com/company");
  assert.equal(elements.get("ticket-link").href, "https://example.com/company");
});

for (const url of ["", undefined, "http://example.com/company"]) {
  test(`unconfigured or invalid company link is disabled: ${url}`, async () => {
    const elements = await render("company", url);
    assert.equal(elements.get("ticket-link").href, undefined);
    assert.equal(elements.get("ticket-link")["aria-disabled"], "true");
    assert.equal(elements.get("draft-banner").hidden, false);
  });
}
