export const appState = {
  currentUser: null,
  movies: [],
  activeView: 'dashboard',
  filters: {
    search: '',
    watchedYear: '',
    sortBy: 'date-d',
    rewatchesOnly: false
  },
  topPicks: {
    minimumRating: 8,
    sortBy: 'rate'
  },
  pendingImport: null
};

export function setCurrentUser(user) {
  appState.currentUser = user;
}

export function setMovies(movies) {
  appState.movies = movies;
}

export function resetSessionState() {
  appState.currentUser = null;
  appState.movies = [];
  appState.pendingImport = null;
}
