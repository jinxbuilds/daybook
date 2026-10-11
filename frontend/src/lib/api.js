// Thin fetch wrapper. The session lives in an httpOnly cookie that
// JavaScript cannot read; we only hold the CSRF token in memory.

const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const credentials = BASE ? "include" : "same-origin";
let csrfToken = null;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function getCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  const res = await fetch(`${BASE}/api/auth/csrf`, { credentials });
  if (!res.ok) throw new ApiError(res.status, "Couldn't reach the server.");
  csrfToken = (await res.json()).csrfToken;
  return csrfToken;
}

export async function api(path, { method = "GET", body } = {}, retry = true) {
  const headers = {};
  if (method !== "GET") headers["x-csrf-token"] = await getCsrf();
  if (body !== undefined) headers["content-type"] = "application/json";

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers,
      credentials,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "You're offline or the server isn't responding.");
  }

  // CSRF token may have rotated (e.g. server restart): refresh once.
  if (res.status === 403 && method !== "GET" && retry) {
    await getCsrf(true);
    return api(path, { method, body }, false);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`);
  return data;
}
