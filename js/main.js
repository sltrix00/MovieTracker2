import { appState, resetSessionState, setCurrentUser, setMovies } from './state.js';
import {
  clearSession,
  createId,
  getMovies,
  getSession,
  getUsers,
  hashPassword,
  saveMovies,
  saveSession,
  saveUsers
} from './storage.js';
import {
  destroyCharts,
  getElement,
  getValue,
  renderTable,
  renderTopPicks,
  showAuthMessage,
  showImportMessage,
  showImportPreview,
  showView
} from './ui.js';

function today() {
  return new Date().toISOString().split('T')[0];
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  getElement('login-form').classList.toggle('hidden', tab !== 'login');
  getElement('register-form').classList.toggle('hidden', tab !== 'register');
  getElement('auth-msg').innerHTML = '';
}

async function doLogin() {
  const email = getValue('li-email').trim().toLowerCase();
  const password = getValue('li-pass');
  if (!email || !password) {
    showAuthMessage('Please fill in all fields.', 'error');
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = getUsers().find(candidate =>
    candidate.email === email && candidate.ph === passwordHash
  );
  if (!user) {
    showAuthMessage('Invalid email or password.', 'error');
    return;
  }

  saveSession(user);
  bootApp(user);
}

async function doRegister() {
  const email = getValue('rg-email').trim().toLowerCase();
  const password = getValue('rg-pass');
  const confirmPassword = getValue('rg-pass2');
  if (!email || !password) {
    showAuthMessage('Please fill in all fields.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthMessage('Password must be at least 6 characters.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showAuthMessage('Passwords do not match.', 'error');
    return;
  }

  const users = getUsers();
  if (users.some(user => user.email === email)) {
    showAuthMessage('Email already registered.', 'error');
    return;
  }

  const user = {
    id: createId(),
    email,
    ph: await hashPassword(password),
    createdAt: Date.now()
  };
  saveUsers([...users, user]);
  saveSession(user);
  bootApp(user);
}

function doLogout() {
  clearSession();
  resetSessionState();
  destroyCharts();
  getElement('auth-screen').style.display = 'flex';
  getElement('app-screen').style.display = 'none';
  getElement('li-email').value = '';
  getElement('li-pass').value = '';
}

function bootApp(user) {
  setCurrentUser(user);
  setMovies(getMovies(user.id));
  getElement('auth-screen').style.display = 'none';
  getElement('app-screen').style.display = 'block';
  getElement('sb-email').textContent = user.email;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  getElement('dash-sub').textContent = `${greeting} — your film journal`;
  getElement('a-date').value = today();
  showView('dashboard');
}

function doAddMovie() {
  const title = getValue('a-title').trim();
  const movieYear = Number.parseInt(getValue('a-myear'), 10);
  const date = getValue('a-date');
  const ratingText = getValue('a-rating');
  const notes = getValue('a-notes').trim();
  const messageElement = getElement('add-msg');

  if (!title || !movieYear) {
    messageElement.innerHTML = '<div class="msg msg-error">Title and year are required.</div>';
    return;
  }

  const movie = {
    id: createId(),
    title,
    movieYear,
    watchedAt: date ? new Date(date).getTime() : null,
    rating: ratingText !== '' ? Number.parseFloat(ratingText) : null,
    rewatched: getElement('a-rw').checked,
    notes
  };
  appState.movies.push(movie);
  saveMovies(appState.currentUser.id, appState.movies);

  ['a-title', 'a-myear', 'a-rating', 'a-notes'].forEach(id => {
    getElement(id).value = '';
  });
  getElement('a-rw').checked = false;
  getElement('a-date').value = today();
  messageElement.innerHTML = '<div class="msg msg-success">✓ Added to your journal!</div>';
  setTimeout(() => {
    messageElement.innerHTML = '';
  }, 3000);
}

function deleteMovie(id) {
  if (!window.confirm('Remove this film from your journal?')) return;
  setMovies(appState.movies.filter(movie => movie.id !== id));
  saveMovies(appState.currentUser.id, appState.movies);
  renderTable();
}

const months = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3, 'мая': 4, 'июня': 5,
  'июля': 6, 'августа': 7, 'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};

function parseTxt(content) {
  const lines = content.split('\n');
  let year = new Date().getFullYear();
  const movies = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const yearHeader = line.match(/просмотренные фильмы\s+(\d{4})/i);
    if (yearHeader) {
      year = Number.parseInt(yearHeader[1], 10);
      continue;
    }

    if (!/^\d/.test(line)) continue;
    const stripped = line.replace(/^\d+[\.\s\t]+/, '').trim();
    if (!stripped) continue;

    const separatorIndex = findSeparator(stripped);
    if (separatorIndex < 0) continue;
    const titlePart = stripped.substring(0, separatorIndex).trim();
    const infoPart = stripped.substring(separatorIndex).replace(/^\s*[-–]\s*/, '').trim();
    const titleMatch = titlePart.match(/^(.+?)\s*\((\d{4})\)\s*$/);
    if (!titleMatch) continue;

    movies.push({
      id: createId(),
      title: titleMatch[1].trim(),
      movieYear: Number.parseInt(titleMatch[2], 10),
      watchedAt: parseDate(infoPart, year),
      rating: parseRating(infoPart),
      rewatched: /🔁|Пересмотрел/i.test(rawLine),
      notes: cleanNotes(infoPart).substring(0, 120)
    });
  }
  return movies;
}

function findSeparator(text) {
  const pattern = /\(\d{4}\)\s*[-–]/g;
  let match;
  let lastMatch = null;
  while ((match = pattern.exec(text)) !== null) lastMatch = match;
  if (lastMatch) return lastMatch.index + lastMatch[0].indexOf(')') + 1;
  return text.indexOf(' - ');
}

function parseRating(text) {
  const match = text.match(/\(([~\d\.]+(?:[-–][\d\.]+)?)\s*\/\s*10\)/);
  if (!match) return null;
  const raw = match[1].replace('~', '');
  if (raw === '-' || !raw) return null;
  if (raw.search(/[-–]/) > 0) {
    const parts = raw.split(/[-–]/).map(Number.parseFloat);
    return Math.round((parts[0] + parts[1]) / 2 * 10) / 10;
  }
  return Number.parseFloat(raw);
}

function parseDate(text, year) {
  for (const [monthName, monthIndex] of Object.entries(months)) {
    const match = text.match(new RegExp(`(\\d{1,2})(?:[-–]\\d{1,2})?\\s+${monthName}`, 'i'));
    if (match) {
      const day = Number.parseInt(match[1], 10);
      if (day >= 1 && day <= 31) return new Date(year, monthIndex, day).getTime();
    }
  }
  return null;
}

function cleanNotes(text) {
  return text
    .replace(/\([~\-\d\.]+\/10\)/g, '')
    .replace(/\d{1,2}(?:[-–]\d{1,2})?\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/gi, '')
    .replace(/\d{1,2}[:\s]\d{2}/g, '')
    .replace(/🔁\s*Пересмотрел\.?/gi, '')
    .replace(/🔃\s*нужно пересмотреть/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(header => header.trim().toLowerCase().replace(/"/g, ''));

  return lines.slice(1).map(line => {
    const columns = line.split(',').map(column => column.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = columns[index] || '';
    });

    const title = row.title || row.name || row.movie || '';
    if (!title) return null;
    return {
      id: createId(),
      title,
      movieYear: Number.parseInt(row.year || row.movieyear, 10) || null,
      watchedAt: (row.date || row.watched) ? new Date(row.date || row.watched).getTime() : null,
      rating: Number.parseFloat(row.rating) || null,
      rewatched: row.rewatched === 'true' || row.rewatched === '1',
      notes: row.notes || ''
    };
  }).filter(Boolean);
}

function normalizeImported(movie) {
  return {
    id: movie.id || createId(),
    title: movie.title || movie.name || '',
    movieYear: movie.movieYear || movie.year || null,
    watchedAt: movie.watchedAt || null,
    rating: movie.rating || null,
    rewatched: movie.rewatched || false,
    notes: movie.notes || ''
  };
}

async function processFile(file) {
  let content;
  try {
    content = await file.text();
  } catch (error) {
    console.error(`Could not read import file "${file.name}".`, error);
    showImportMessage(`Could not read "${file.name}".`, 'error');
    return;
  }

  let movies = [];
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension === 'txt') {
    movies = parseTxt(content);
  } else if (extension === 'json') {
    try {
      const data = JSON.parse(content);
      movies = (Array.isArray(data) ? data : data.movies || []).map(normalizeImported);
    } catch {
      showImportMessage('Invalid JSON.', 'error');
      return;
    }
  } else if (extension === 'csv') {
    movies = parseCSV(content);
  }

  if (!movies.length) {
    showImportMessage('No movies found in this file.', 'error');
    return;
  }
  appState.pendingImport = movies;
  showImportPreview(movies, file.name);
}

async function handleFiles(files) {
  for (const file of files) await processFile(file);
}

function confirmImport() {
  if (!appState.pendingImport) return;

  const existing = new Set(appState.movies.map(movie => `${movie.title}||${movie.movieYear}`));
  const moviesToAdd = appState.pendingImport.filter(movie =>
    !existing.has(`${movie.title}||${movie.movieYear}`)
  );
  const duplicates = appState.pendingImport.length - moviesToAdd.length;
  setMovies([...appState.movies, ...moviesToAdd]);
  saveMovies(appState.currentUser.id, appState.movies);
  getElement('import-preview').innerHTML = '';
  appState.pendingImport = null;

  let message = `✓ Imported ${moviesToAdd.length} movies.`;
  if (duplicates) message += ` (${duplicates} duplicates skipped)`;
  showImportMessage(message, 'success');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(appState.movies, null, 2)], {
    type: 'application/json'
  });
  const link = document.createElement('a');
  const objectURL = URL.createObjectURL(blob);
  link.href = objectURL;
  link.download = `cinelog-${appState.currentUser.email.split('@')[0]}-${today()}.json`;
  link.click();
  URL.revokeObjectURL(objectURL);
}

function handleClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const tabButton = target.closest('.auth-tab');
  if (tabButton) {
    switchTab(tabButton.dataset.tab);
    return;
  }

  const viewLink = target.closest('[data-view]');
  if (viewLink) {
    showView(viewLink.dataset.view);
    return;
  }

  const actionElement = target.closest('[data-action]');
  if (actionElement) {
    const { action } = actionElement.dataset;
    if (action === 'login') void doLogin();
    if (action === 'register') void doRegister();
    if (action === 'logout') doLogout();
    if (action === 'add-movie') doAddMovie();
    if (action === 'export-json') exportJSON();
    if (action === 'confirm-import') confirmImport();
    if (action === 'delete-movie') deleteMovie(actionElement.dataset.movieId);
    return;
  }

  const dropZone = target.closest('#drop-zone');
  if (dropZone && target.id !== 'file-inp') getElement('file-inp').click();
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.id === 'mv-search') {
    appState.filters.search = target.value;
    renderTable();
  } else if (target.id === 'top-thresh') {
    appState.topPicks.minimumRating = Number.parseFloat(target.value);
    renderTopPicks();
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

  if (target.id === 'mv-year') {
    appState.filters.watchedYear = target.value;
    renderTable();
  } else if (target.id === 'mv-sort') {
    appState.filters.sortBy = target.value;
    renderTable();
  } else if (target.id === 'mv-rw') {
    appState.filters.rewatchesOnly = target.checked;
    renderTable();
  } else if (target.id === 'top-sort') {
    appState.topPicks.sortBy = target.value;
    renderTopPicks();
  } else if (target.id === 'file-inp') {
    void handleFiles(Array.from(target.files));
    target.value = '';
  }
}

function setupDragAndDrop() {
  const dropZone = getElement('drop-zone');
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    void handleFiles(Array.from(event.dataTransfer.files));
  });
}

function setupKeyboardShortcuts() {
  ['li-email', 'li-pass'].forEach(id => {
    getElement(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') void doLogin();
    });
  });
  ['rg-email', 'rg-pass', 'rg-pass2'].forEach(id => {
    getElement(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') void doRegister();
    });
  });
}

function initializeApp() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  setupDragAndDrop();
  setupKeyboardShortcuts();

  const session = getSession();
  if (session) {
    const user = getUsers().find(candidate => candidate.id === session.id);
    if (user) {
      bootApp(user);
      return;
    }
  }
  getElement('auth-screen').style.display = 'flex';
}

initializeApp();
