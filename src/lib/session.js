// An in-progress exam is mirrored to localStorage so a page refresh doesn't lose it.
// The timer keeps running against the absolute end time, like a real sitting.
const KEY = 'aws-exam-sim:session';

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && Array.isArray(s.questions) && s.endsAt ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage full or blocked: the exam still works, it just can't resume */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
