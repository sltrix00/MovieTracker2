import { appState } from './state.js';

const chartInstances = {};
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const yearColors = ['#c8a84a', '#4ecdc4', '#ff6b8a', '#a78bfa', '#fb923c', '#34d399', '#60a5fa'];

export function getElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required element #${id} was not found.`);
  return element;
}

export function getValue(id) {
  return getElement(id).value;
}

export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function ratingClass(rating) {
  if (rating >= 8) return 'badge-high';
  if (rating >= 6) return 'badge-mid';
  return 'badge-low';
}

export function showAuthMessage(text, type) {
  getElement('auth-msg').innerHTML = `<div class="msg msg-${type}">${escapeHTML(text)}</div>`;
}

export function showImportMessage(text, type) {
  getElement('import-msg').innerHTML = `<div class="msg msg-${type}">${escapeHTML(text)}</div>`;
  if (type === 'success') {
    setTimeout(() => {
      getElement('import-msg').innerHTML = '';
    }, 6000);
  }
}

export function showImportPreview(movies, fileName) {
  getElement('import-preview').innerHTML = `
    <div class="import-preview">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
        <strong>Found <span class="text-gold">${movies.length}</span> movies in "${escapeHTML(fileName)}"</strong>
        <button class="btn btn-primary btn-sm" data-action="confirm-import">Import All</button>
      </div>
      <div class="preview-list">
        ${movies.slice(0, 25).map(movie => `
          <div class="preview-item">
            <span>${escapeHTML(movie.title)} (${movie.movieYear || '?'})</span>
            <span>${movie.rating != null ? `${movie.rating}/10` : '—'} · ${movie.watchedAt
              ? new Date(movie.watchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'no date'}</span>
          </div>`).join('')}
        ${movies.length > 25
          ? `<div style="padding:6px 0;color:var(--dim);font-size:.78rem;">…and ${movies.length - 25} more</div>`
          : ''}
      </div>
    </div>`;
}

export function showView(name) {
  appState.activeView = name;
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

  const viewElement = document.getElementById(`view-${name}`);
  const navElement = document.querySelector(`.nav-item[data-view="${name}"]`);
  if (viewElement) viewElement.classList.add('active');
  if (navElement) navElement.classList.add('active');

  if (name === 'dashboard') renderDashboard();
  if (name === 'movies') {
    fillYearFilter();
    renderTable();
  }
  if (name === 'stats') renderStats();
  if (name === 'top') renderTopPicks();
}

export function renderDashboard() {
  const movies = appState.movies;
  const ratedMovies = movies.filter(movie => movie.rating != null);
  const averageRating = ratedMovies.length
    ? (ratedMovies.reduce((total, movie) => total + movie.rating, 0) / ratedMovies.length).toFixed(1)
    : '—';
  const currentYear = new Date().getFullYear();
  const watchedThisYear = movies.filter(movie =>
    movie.watchedAt && new Date(movie.watchedAt).getFullYear() === currentYear
  ).length;

  getElement('dash-stats').innerHTML = [
    ['Total Films', movies.length, 'in your journal'],
    ['This Year', watchedThisYear, String(currentYear)],
    ['Avg. Rating', averageRating, 'out of 10'],
    ['Rewatches', movies.filter(movie => movie.rewatched).length, 'repeat watches'],
    ['Favourites', movies.filter(movie => movie.rating != null && movie.rating >= 8).length, 'rated 8 or above']
  ].map(([label, value, subtitle]) => `
    <div class="stat-card">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-sub">${subtitle}</div>
    </div>`).join('');

  const recentMovies = [...movies]
    .filter(movie => movie.watchedAt)
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, 8);

  if (!recentMovies.length) {
    getElement('dash-recent').innerHTML =
      '<div class="empty-state">No movies yet. <span data-view="add">Add your first →</span></div>';
    return;
  }

  getElement('dash-recent').innerHTML = `
    <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);margin-bottom:14px">Recently Watched</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
      ${recentMovies.map(movie => `
        <div class="movie-card">
          <div class="movie-card-title">${escapeHTML(movie.title)}</div>
          <div class="movie-card-date">${movie.movieYear || ''} · ${formatDate(movie.watchedAt)}</div>
          <div class="movie-card-meta">
            ${movie.rating != null ? `<span class="badge ${ratingClass(movie.rating)}">${movie.rating}/10</span>` : ''}
            ${movie.rewatched ? '<span class="badge badge-rw">↺ rewatch</span>' : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

function fillYearFilter() {
  const years = [...new Set(appState.movies
    .filter(movie => movie.watchedAt)
    .map(movie => new Date(movie.watchedAt).getFullYear()))]
    .sort((a, b) => b - a);
  const select = getElement('mv-year');
  const selectedYear = appState.filters.watchedYear;

  select.innerHTML = '<option value="">All Years</option>' +
    years.map(year =>
      `<option value="${year}"${String(selectedYear) === String(year) ? ' selected' : ''}>${year}</option>`
    ).join('');

  if (selectedYear && !years.includes(Number(selectedYear))) {
    appState.filters.watchedYear = '';
  }
}

export function renderTable() {
  const { search, watchedYear, sortBy, rewatchesOnly } = appState.filters;
  let movies = [...appState.movies];

  if (search) {
    movies = movies.filter(movie => movie.title.toLowerCase().includes(search.toLowerCase()));
  }
  if (watchedYear) {
    movies = movies.filter(movie =>
      movie.watchedAt && new Date(movie.watchedAt).getFullYear() === Number(watchedYear)
    );
  }
  if (rewatchesOnly) movies = movies.filter(movie => movie.rewatched);

  if (sortBy === 'date-d') movies.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
  if (sortBy === 'date-a') movies.sort((a, b) => (a.watchedAt || 0) - (b.watchedAt || 0));
  if (sortBy === 'rate-d') movies.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (sortBy === 'rate-a') movies.sort((a, b) => (a.rating || 0) - (b.rating || 0));
  if (sortBy === 'az') movies.sort((a, b) => a.title.localeCompare(b.title));

  getElement('mv-sub').textContent = `${movies.length} of ${appState.movies.length} films`;
  const tableBody = getElement('mv-tbody');
  if (!movies.length) {
    tableBody.innerHTML = '<tr><td colspan="7" class="empty-state">No movies found.</td></tr>';
    return;
  }

  tableBody.innerHTML = movies.map((movie, index) => `
    <tr>
      <td class="text-dim" style="font-family:'DM Mono',monospace;font-size:.72rem">${index + 1}</td>
      <td><span style="font-weight:500">${escapeHTML(movie.title)}</span>${movie.rewatched ? ' <span class="badge badge-rw">↺</span>' : ''}</td>
      <td class="text-dim">${movie.movieYear || '—'}</td>
      <td class="text-dim" style="font-size:.82rem;white-space:nowrap">${formatDate(movie.watchedAt)}</td>
      <td>${movie.rating != null
        ? `<span class="badge ${ratingClass(movie.rating)}">${movie.rating}/10</span>`
        : '<span class="text-dim">—</span>'}</td>
      <td style="font-size:.78rem;color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(movie.notes || '')}</td>
      <td><button class="btn-icon" data-action="delete-movie" data-movie-id="${escapeHTML(movie.id)}" aria-label="Remove ${escapeHTML(movie.title)}">✕</button></td>
    </tr>`).join('');
}

export function destroyCharts() {
  Object.values(chartInstances).forEach(chart => chart.destroy());
  for (const key of Object.keys(chartInstances)) delete chartInstances[key];
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 864e5);
}

export function renderStats() {
  destroyCharts();
  const datedMovies = appState.movies.filter(movie => movie.watchedAt);
  if (!datedMovies.length) {
    getElement('stats-content').innerHTML =
      '<div class="empty-state">No dated movies yet. Add or import some first.</div>';
    return;
  }

  const years = [...new Set(datedMovies.map(movie =>
    new Date(movie.watchedAt).getFullYear()
  ))].sort();

  getElement('stats-content').innerHTML = `
    <div class="chart-grid">
      <div class="chart-card chart-full">
        <div class="chart-title">Films Watched per Month — by Year</div>
        <div class="chart-wrap"><canvas id="c-monthly"></canvas></div>
      </div>
      <div class="chart-card chart-full">
        <div class="chart-title">Cumulative Films — All Years Compared (day of year)</div>
        <div class="chart-wrap-tall"><canvas id="c-cumul"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Day of Week</div>
        <div class="chart-wrap"><canvas id="c-week"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Rating Distribution</div>
        <div class="chart-wrap"><canvas id="c-rate"></canvas></div>
      </div>
    </div>`;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: '#8880a0', font: { family: 'Outfit', size: 11 }, padding: 14 }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(30,30,80,.5)' },
        ticks: { color: '#5a5570', font: { family: 'Outfit', size: 11 } }
      },
      y: {
        grid: { color: 'rgba(30,30,80,.5)' },
        ticks: { color: '#5a5570', font: { family: 'Outfit', size: 11 } }
      }
    }
  };

  const chart = window.Chart;
  if (!chart) throw new Error('Chart.js is required to display statistics.');

  chartInstances.monthly = new chart(getElement('c-monthly'), {
    type: 'bar',
    data: {
      labels: monthNames,
      datasets: years.map((year, index) => {
        const counts = Array(12).fill(0);
        datedMovies
          .filter(movie => new Date(movie.watchedAt).getFullYear() === year)
          .forEach(movie => counts[new Date(movie.watchedAt).getMonth()]++);
        const color = yearColors[index % yearColors.length];
        return {
          label: String(year),
          data: counts,
          backgroundColor: `${color}80`,
          borderColor: color,
          borderWidth: 1.5,
          borderRadius: 3
        };
      })
    },
    options: { ...chartOptions }
  });

  chartInstances.cumulative = new chart(getElement('c-cumul'), {
    type: 'line',
    data: {
      datasets: years.map((year, index) => {
        const yearMovies = datedMovies
          .filter(movie => new Date(movie.watchedAt).getFullYear() === year)
          .sort((a, b) => a.watchedAt - b.watchedAt);
        const byDay = {};
        yearMovies.forEach(movie => {
          const day = dayOfYear(new Date(movie.watchedAt));
          byDay[day] = (byDay[day] || 0) + 1;
        });
        let cumulative = 0;
        const points = [];
        for (let day = 1; day <= 366; day++) {
          if (byDay[day]) cumulative += byDay[day];
          points.push({ x: day, y: cumulative });
        }
        const sparsePoints = points.filter((point, pointIndex) =>
          pointIndex === 0 || pointIndex === points.length - 1 || point.y !== points[pointIndex - 1].y
        );
        const color = yearColors[index % yearColors.length];
        return {
          label: String(year),
          data: sparsePoints,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1
        };
      })
    },
    options: {
      ...chartOptions,
      scales: {
        x: {
          type: 'linear',
          min: 1,
          max: 366,
          grid: { color: 'rgba(30,30,80,.5)' },
          ticks: {
            color: '#5a5570',
            font: { family: 'Outfit', size: 11 },
            callback: value => {
              const starts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
              const index = starts.indexOf(value);
              return index >= 0 ? monthNames[index] : '';
            },
            maxTicksLimit: 13
          }
        },
        y: {
          grid: { color: 'rgba(30,30,80,.5)' },
          ticks: { color: '#5a5570', font: { family: 'Outfit', size: 11 } }
        }
      }
    }
  });

  const weekdayCounts = Array(7).fill(0);
  datedMovies.forEach(movie => weekdayCounts[new Date(movie.watchedAt).getDay()]++);
  const maxWeekdayCount = Math.max(...weekdayCounts);
  chartInstances.week = new chart(getElement('c-week'), {
    type: 'bar',
    data: {
      labels: dayNames,
      datasets: [{
        data: weekdayCounts,
        backgroundColor: weekdayCounts.map(count =>
          `rgba(200,168,74,${0.25 + (count / maxWeekdayCount) * 0.65})`
        ),
        borderColor: '#c8a84a',
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } }
  });

  const ratingBuckets = Array(10).fill(0);
  appState.movies
    .filter(movie => movie.rating != null)
    .forEach(movie => ratingBuckets[Math.min(9, Math.max(0, Math.ceil(movie.rating) - 1))]++);
  chartInstances.rating = new chart(getElement('c-rate'), {
    type: 'bar',
    data: {
      labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      datasets: [{
        data: ratingBuckets,
        backgroundColor: ratingBuckets.map((_, index) =>
          index >= 7 ? 'rgba(80,200,120,.45)' : index >= 5 ? 'rgba(200,168,74,.45)' : 'rgba(224,85,85,.35)'
        ),
        borderColor: ratingBuckets.map((_, index) =>
          index >= 7 ? '#50c878' : index >= 5 ? '#c8a84a' : '#e05555'
        ),
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } }
  });
}

export function renderTopPicks() {
  const { minimumRating, sortBy } = appState.topPicks;
  getElement('top-thresh-lbl').textContent = `${minimumRating}+`;
  let movies = appState.movies.filter(movie =>
    movie.rating != null && movie.rating >= minimumRating
  );

  if (sortBy === 'rate') movies.sort((a, b) => b.rating - a.rating);
  else if (sortBy === 'date') movies.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
  else movies.sort((a, b) => a.title.localeCompare(b.title));

  getElement('top-count').textContent = `${movies.length} film${movies.length !== 1 ? 's' : ''}`;
  if (!movies.length) {
    getElement('top-grid').innerHTML =
      '<div style="color:var(--dim);font-size:.875rem">No movies at this threshold.</div>';
    return;
  }

  getElement('top-grid').innerHTML = movies.map(movie => `
    <div class="movie-card">
      <div class="movie-card-title">${escapeHTML(movie.title)}</div>
      <div class="movie-card-date">${movie.movieYear || ''} · ${formatDate(movie.watchedAt)}</div>
      <div class="movie-card-meta">
        <span class="badge badge-high">${movie.rating}/10</span>
        ${movie.rewatched ? '<span class="badge badge-rw">↺ rewatch</span>' : ''}
      </div>
      ${movie.notes
        ? `<div style="margin-top:8px;font-size:.75rem;color:var(--dim)">${escapeHTML(movie.notes.substring(0, 80))}</div>`
        : ''}
    </div>`).join('');
}
