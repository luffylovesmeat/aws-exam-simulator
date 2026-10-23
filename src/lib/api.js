// Thin client for the local JSON database server (server/index.js).
const UNREACHABLE = 'Could not reach the local database server. Start the app with "npm run dev" or "npm start".';

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  let body;
  try {
    body = await res.json();
  } catch {
    // e.g. a static host answered with index.html instead of the API
    throw new Error(UNREACHABLE);
  }
  if (!res.ok) throw new Error(body?.error || res.statusText);
  return body;
}

export const listAttempts = () => request('/api/attempts').then((b) => b.attempts);

export const saveAttempt = (attempt) =>
  request('/api/attempts', { method: 'POST', body: JSON.stringify(attempt) }).then((b) => b.attempt);

export const deleteAttempt = (id) => request(`/api/attempts/${encodeURIComponent(id)}`, { method: 'DELETE' });
