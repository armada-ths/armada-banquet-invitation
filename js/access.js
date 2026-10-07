(function () {
  "use strict";

  const COOKIE_NAME = "armada_banquet_access";
  const NAME_STORAGE_KEY = "armada_banquet_invitee_name";
  const AUDIENCE_STORAGE_KEY = "armada_banquet_audience";
  const CONFIG_PLACEHOLDER = "__BANQUET_ACCESS_TOKEN_SHA256__";
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const NAME_SUBSTITUTION_PATTERN = /\$(?:RECEIVER_FIRST_NAME|RECEIVER_LAST_NAME|RECEIVER_NAME|RECEIVER_EMAIL|COMPANY)/gu;
  const config = window.BANQUET_ACCESS_CONFIG || {};

  function finishDenied() {
    try { localStorage.removeItem(NAME_STORAGE_KEY); } catch { /* storage may be disabled */ }
    try { localStorage.removeItem(AUDIENCE_STORAGE_KEY); } catch { /* storage may be disabled */ }
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.documentElement.classList.remove("access-pending");
    document.documentElement.classList.add("access-denied");
    const message = document.getElementById("access-message");
    if (message) message.hidden = false;
    return { granted: false, name: "" };
  }

  function finishGranted(name, audience) {
    document.documentElement.classList.remove("access-pending", "access-denied");
    return { granted: true, name, audience };
  }

  function clearFragment() {
    if (!window.location.hash) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  function readCookie(name) {
    const prefix = `${name}=`;
    const part = document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
    if (!part) return "";
    try {
      return decodeURIComponent(part.slice(prefix.length));
    } catch {
      return "";
    }
  }

  function writeAccessCookie(token, expiresAt) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; SameSite=Lax${secure}`;
  }

  function normalizeName(value) {
    if (typeof value !== "string" || /\p{Cc}/u.test(value)) return null;
    const normalized = value
      .replace(NAME_SUBSTITUTION_PATTERN, " ")
      .normalize("NFC")
      .replace(/\s+/gu, " ")
      .trim();
    if ([...normalized].length > 100) return null;
    if (normalized && !/[\p{L}\p{N}]/u.test(normalized)) return "";
    return normalized;
  }

  function readInvitationFragment() {
    if (!window.location.hash) return { present: false };
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessValues = params.getAll("access");
    const nameValues = params.getAll("name");
    const audienceValues = params.getAll("audience");
    const containsInvitationField = accessValues.length > 0 || nameValues.length > 0 || audienceValues.length > 0;

    if (!containsInvitationField) return { present: false };
    if (accessValues.length !== 1 || nameValues.length > 1 || audienceValues.length > 1) return { present: true, valid: false };

    const name = normalizeName(nameValues[0] ?? "");
    const audience = audienceValues[0] || "guest";
    return {
      present: true,
      valid: accessValues[0].length > 0 && name !== null && (audience === "guest" || audience === "company"),
      token: accessValues[0],
      name,
      audience,
    };
  }

  async function sha256(value) {
    if (!window.crypto || !window.crypto.subtle) return "";
    const bytes = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function tokenIsValid(token) {
    if (!token) return false;
    if (LOCAL_HOSTS.has(window.location.hostname) && config.tokenHash === CONFIG_PLACEHOLDER) {
      return token === "dev";
    }
    if (!/^[a-f0-9]{64}$/i.test(config.tokenHash || "")) return false;
    return (await sha256(token)) === config.tokenHash.toLowerCase();
  }

  async function validateAccess() {
    try {
      const expiresAt = Date.parse(config.expiresAt || "");
      if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
        clearFragment();
        return finishDenied();
      }

      const invitation = readInvitationFragment();
      clearFragment();
      if (invitation.present) {
        if (!invitation.valid || !(await tokenIsValid(invitation.token))) return finishDenied();

        writeAccessCookie(invitation.token, config.expiresAt);
        localStorage.setItem(NAME_STORAGE_KEY, invitation.name);
        localStorage.setItem(AUDIENCE_STORAGE_KEY, invitation.audience);
        return finishGranted(invitation.name, invitation.audience);
      }

      const token = readCookie(COOKIE_NAME);
      const name = normalizeName(localStorage.getItem(NAME_STORAGE_KEY));
      if (name === null || !(await tokenIsValid(token))) return finishDenied();
      const audience = localStorage.getItem(AUDIENCE_STORAGE_KEY) === "company" ? "company" : "guest";
      return finishGranted(name, audience);
    } catch (error) {
      console.error("Invitation access check failed:", error);
      clearFragment();
      return finishDenied();
    }
  }

  window.BANQUET_ACCESS = Object.freeze({ ready: validateAccess() });
})();
