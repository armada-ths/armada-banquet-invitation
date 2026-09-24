(function () {
  "use strict";

  const COOKIE_NAME = "armada_banquet_access";
  const NAME_STORAGE_KEY = "armada_banquet_invitee_name";
  const CONFIG_PLACEHOLDER = "__BANQUET_ACCESS_TOKEN_SHA256__";
  const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const config = window.BANQUET_ACCESS_CONFIG || {};

  function finishDenied() {
    try { localStorage.removeItem(NAME_STORAGE_KEY); } catch { /* storage may be disabled */ }
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.documentElement.classList.remove("access-pending");
    document.documentElement.classList.add("access-denied");
    const message = document.getElementById("access-message");
    if (message) message.hidden = false;
    return { granted: false, name: "" };
  }

  function finishGranted(name) {
    document.documentElement.classList.remove("access-pending", "access-denied");
    return { granted: true, name };
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
    if (typeof value !== "string" || /\p{Cc}/u.test(value)) return "";
    const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
    if (!normalized || [...normalized].length > 100) return "";
    return normalized;
  }

  function readInvitationFragment() {
    if (!window.location.hash) return { present: false };
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessValues = params.getAll("access");
    const nameValues = params.getAll("name");
    const containsInvitationField = accessValues.length > 0 || nameValues.length > 0;

    if (!containsInvitationField) return { present: false };
    if (accessValues.length !== 1 || nameValues.length !== 1) return { present: true, valid: false };

    const name = normalizeName(nameValues[0]);
    return {
      present: true,
      valid: accessValues[0].length > 0 && name.length > 0,
      token: accessValues[0],
      name,
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
        return finishGranted(invitation.name);
      }

      const token = readCookie(COOKIE_NAME);
      const name = normalizeName(localStorage.getItem(NAME_STORAGE_KEY));
      if (!name || !(await tokenIsValid(token))) return finishDenied();
      return finishGranted(name);
    } catch (error) {
      console.error("Invitation access check failed:", error);
      clearFragment();
      return finishDenied();
    }
  }

  window.BANQUET_ACCESS = Object.freeze({ ready: validateAccess() });
})();
