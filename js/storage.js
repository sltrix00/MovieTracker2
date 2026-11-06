const USERS_KEY = 'cl_users';
const SESSION_KEY = 'cl_sess';

function readJSON(storage, key, fallback) {
  const value = storage.getItem(key);
  return value === null ? fallback : JSON.parse(value);
}

export function getUsers() {
  return readJSON(localStorage, USERS_KEY, []);
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getMovies(userId) {
  return readJSON(localStorage, `cl_mv_${userId}`, []);
}

export function saveMovies(userId, movies) {
  localStorage.setItem(`cl_mv_${userId}`, JSON.stringify(movies));
}

export function getSession() {
  return readJSON(sessionStorage, SESSION_KEY, null);
}

export function saveSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function hashPassword(password) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return [...new Uint8Array(buffer)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
