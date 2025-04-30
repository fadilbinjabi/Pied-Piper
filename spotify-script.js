const clientId = '43f735a675d04dc593023010c69937f3';
const redirectUri = 'https://fadilbinjabi.github.io/Pied-Piper/main.html';

const scopes = [
  'user-top-read',
  'playlist-read-private',
  'playlist-modify-private', 
  'playlist-modify-public',
  'user-read-email',
  'user-read-private'
].join(' ');
// Add this near the top with your other constants
const DEEPSEEK_API_KEY = 'sk-fd393ae6bef24eacb3bf6055ae6788df'; // Replace with your actual key
//const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'; // Verify the correct endpoint
console.log("Using API Key:", DEEPSEEK_API_KEY?.slice(0, 5) + '...'); // Log first 5 chars
async function testDeepSeekAPI() {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer sk-fd393ae6bef24eacb3bf6055ae6788df` // Replace!
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Say 'TEST'" }]
    })
  });
  
  console.log("HTTP Status:", response.status);
  console.log("Response:", await response.json());
}

testDeepSeekAPI();
// Add this near the top with your other constants
const GENRES = ['acoustic', 'instrumental', 'rock', 'rap', 'jazz', 'pop'];

const PLAYLIST_TYPES = {
  'sleeping': {
    genreOrder: ['instrumental', 'acoustic', 'jazz']
  },
  'workout': {
    genreOrder: ['rap', 'rock', 'pop']
  },
  'dining': {
    genreOrder: ['jazz', 'acoustic', 'instrumental']
  },
  'meditation': {
    genreOrder: ['instrumental', 'acoustic', 'jazz']
  },
  'roadtrip': {
    genreOrder: ['rock', 'pop', 'acoustic']
  }
};
let userId;
let accessToken;
let refreshToken;
let lastRequestTime = 0;
let currentAudio = null;
let currentTimeRange = 'long_term';
let chartInstances = {
  artists: null,
  tracks: null,
  genres: null,
  fullView: null
};
let aiRequestQueue = [];
let isProcessingQueue = false;

async function processAIQueue() {
  if (isProcessingQueue || aiRequestQueue.length === 0) return;
  
  isProcessingQueue = true;
  const { resolve, reject, prompt, limit } = aiRequestQueue.shift();
  
  try {
    const result = await generateAIPlaylist(prompt, limit);
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    isProcessingQueue = false;
    setTimeout(processAIQueue, 1000); // 1 second between requests
  }
}
async function loadGenreOptions() {
  const genreContainer = document.getElementById('genre-options');
  genreContainer.innerHTML = '<div class="loading-spinner"></div>'; // Show loading state

  try {
    // First get user's top artists to determine preferred genres
    const response = await makeRequest('https://api.spotify.com/v1/me/top/artists?limit=50');
    const data = await response.json();
    
    // Count genre occurrences
    const genreCounts = {};
    data.items.forEach(artist => {
      artist.genres.forEach(genre => {
        const simplified = simplifyGenre(genre);
        if (GENRES.includes(simplified)) {
          genreCounts[simplified] = (genreCounts[simplified] || 0) + 1;
        }
      });
    });

    // Sort genres by frequency
    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);

    // Combine with all available genres and remove duplicates
    const allGenres = [...new Set([...sortedGenres, ...GENRES])];
    
    // Create checkboxes for each genre (unchecked by default)
   // In your loadGenreOptions function, modify the HTML generation:
        genreContainer.innerHTML = allGenres.map(genre => `
          <div class="genre-option">
            <input type="checkbox" 
                   id="genre-${genre}" 
                   class="genre-checkbox">
            <label for="genre-${genre}" class="genre-label" style="color: inherit;">
              ${genre}
            </label>
          </div>
        `).join('');
  } catch (error) {
    console.error('Error loading genres:', error);
    // Fallback to basic genre list if API fails (unchecked by default)
    genreContainer.innerHTML = GENRES.map(genre => `
      <div class="genre-option">
        <input type="checkbox" 
               id="genre-${genre}" 
               class="genre-checkbox"> <!-- Removed the 'checked' attribute -->
        <label for="genre-${genre}" class="genre-label">
          ${genre}
        </label>
      </div>
    `).join('');
  }
}
document.getElementById('playlist-type').addEventListener('change', function() {
  const aiContainer = document.getElementById('ai-prompt-container');
  const genreContainer = document.getElementById('genre-selection');
  
  if (this.value === 'ai') {
      aiContainer.style.display = 'block';
      genreContainer.style.display = 'none';
  } else {
      aiContainer.style.display = 'none';
      genreContainer.style.display = 'block';
      // Only load genres if not already loaded
      if (document.querySelectorAll('.genre-option').length === 0) {
          loadGenreOptions();
      }
  }
  
  // Clear AI prompt when switching away from AI
  if (this.value !== 'ai') {
      document.getElementById('ai-prompt').value = '';
  }
});

document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Check for saved theme preference or use system preference
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme === 'light' || (!currentTheme && !prefersDarkScheme.matches)) {
      document.body.classList.add('light-mode');
    }
  
    themeToggle.addEventListener('click', function() {
      document.body.classList.toggle('light-mode');
      const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
      localStorage.setItem('theme', theme);
    });
  const firstSection = document.querySelector('.section');
  if (firstSection) {
    firstSection.classList.add('active');
    firstSection.style.display = 'block';
  }
  
  const firstNavLink = document.querySelector('.nav-link');
  if (firstNavLink) {
    firstNavLink.classList.add('active');
  }

  setupNavigation();

  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  accessToken = params.get('access_token');
  refreshToken = params.get('refresh_token');

  if (!accessToken) {
    loginWithSpotify();
  } else {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    loadUserData();
    setupModalHandlers();
    setupTimeRangeButtons();
    
    // Load genre options immediately
    document.getElementById('genre-selection').style.display = 'block';
    loadGenreOptions();
}
document.getElementById('logout-button').addEventListener('click', logout);

  // Add event listeners for the search functionality
  document.getElementById('song-search-button').addEventListener('click', searchSongs);
  document.getElementById('song-search-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchSongs();
    }
  });

  // Add event listener for AI prompt checkbox
});

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
      });
      
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
        targetSection.scrollTop = 0;
      }
      
      document.querySelectorAll('.nav-link').forEach(navLink => {
        navLink.classList.remove('active');
      });
      link.classList.add('active');
    });
  });
}

function setupModalHandlers() {
  const modal = document.getElementById('modal');
  
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
}

function setupTimeRangeButtons() {
  document.querySelectorAll('.time-range-btn').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('.time-range-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      currentTimeRange = this.dataset.range;
      loadTopData();
    });
  });
}

function loginWithSpotify() {
  // Clear all stored tokens first
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&show_dialog=true`;
  window.location.href = authUrl;
}

async function refreshAccessToken() {
  try {
    const response = await fetch('/refresh_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        refresh_token: localStorage.getItem('refresh_token') 
      })
    });
    
    if (!response.ok) throw new Error('Failed to refresh token');
    
    const data = await response.json();
    accessToken = data.access_token;
    localStorage.setItem('access_token', accessToken);
    return accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    loginWithSpotify();
    throw error;
  }
}

async function makeRequest(url, options = {}) {
  const now = Date.now();
  const delay = Math.max(0, 1000 - (now - lastRequestTime));
  await new Promise(resolve => setTimeout(resolve, delay));
  
  if (!options.headers) options.headers = {};
  options.headers.Authorization = `Bearer ${accessToken}`;
  options.mode = 'cors';
  let response = await fetch(url, options);
  
  if (response.status === 401) {
    try {
      await refreshAccessToken();
      options.headers.Authorization = `Bearer ${accessToken}`;
      response = await fetch(url, options);
    } catch (refreshError) {
      throw new Error('Session expired. Please log in again.');
    }
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
  }
  
  lastRequestTime = Date.now();
  return response;
}

async function loadUserData() {
  try {
    const response = await makeRequest('https://api.spotify.com/v1/me');
    const userData = await response.json();
    userId = userData.id;
    
    const userIcon = document.querySelector('.user-icon');
    if (userData.images?.[0]?.url) {
      userIcon.src = userData.images[0].url;
    }
    
    await Promise.all([
      fetchUserPlaylists(),
      loadTopData()
    ]);
    
  } catch (error) {
    console.error('Error loading user data:', error);
    alert(`Failed to load user data: ${error.message}`);
  }
}

async function fetchUserPlaylists() {
  try {
    const response = await makeRequest(`https://api.spotify.com/v1/me/playlists`);
    const data = await response.json();
    
    const playlistsList = document.getElementById('user-playlists');
    playlistsList.innerHTML = data.items.map(playlist => `
      <li data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}">
        <img src="${playlist.images?.[0]?.url || 'default.jpg'}" alt="${playlist.name}" />
        <span title="${playlist.name}">${playlist.name}</span>
      </li>
    `).join('');

    document.querySelectorAll('#user-playlists li').forEach(item => {
      item.addEventListener('click', (event) => {
        const playlistId = event.currentTarget.getAttribute('data-playlist-id');
        const playlistName = event.currentTarget.getAttribute('data-playlist-name');
        showPlaylistTracks(playlistId, playlistName);
      });
    });
    
  } catch (error) {
    console.error('Error fetching playlists:', error);
    document.getElementById('user-playlists').innerHTML = '<li>Failed to load playlists</li>';
  }
}

async function loadTopData() {
  try {
    document.querySelectorAll('.stats-card').forEach(card => {
      card.classList.add('loading');
    });

    const [artistsRes, tracksRes] = await Promise.all([
      makeRequest(`https://api.spotify.com/v1/me/top/artists?time_range=${currentTimeRange}&limit=50`),
      makeRequest(`https://api.spotify.com/v1/me/top/tracks?time_range=${currentTimeRange}&limit=50`)
    ]);
    
    const [artistsData, tracksData] = await Promise.all([
      artistsRes.json(),
      tracksRes.json()
    ]);
    
    const totalMs = tracksData.items.reduce((sum, track) => sum + track.duration_ms, 0);
    const totalHours = Math.floor(totalMs / 3600000);
    const totalMinutes = Math.floor((totalMs % 3600000) / 60000);
    
    const genres = {};
    artistsData.items.forEach(artist => {
      artist.genres.forEach(genre => {
        genres[genre] = (genres[genre] || 0) + 1;
      });
    });
    
    const sortedGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]);
    
    window.fullArtistsList = artistsData.items;
    window.fullSongsList = tracksData.items;
    window.fullGenresList = sortedGenres;
    
    updateStatsUI({
      topArtists: artistsData.items.slice(0, 5),
      topTracks: tracksData.items.slice(0, 5),
      topGenres: sortedGenres.slice(0, 5),
      listeningTime: `${totalHours}h ${totalMinutes}m`,
      totalTracks: tracksData.items.length,
      favoriteArtist: tracksData.items[0]?.artists[0]?.name || 'Unknown'
    });
    
    document.querySelectorAll('.stats-card').forEach(card => {
      card.classList.remove('loading');
    });
    
  } catch (error) {
    console.error('Error loading top data:', error);
    document.querySelectorAll('.stats-card').forEach(card => {
      card.classList.remove('loading');
      card.innerHTML = '<p>Failed to load data. Please try again.</p>';
    });
  }
}

function updateStatsUI(data) {
  document.getElementById('top-artists').innerHTML = data.topArtists
    .map(artist => `
      <li>
        <img src="${artist.images[0]?.url || 'default.jpg'}" alt="${artist.name}" />
        <div class="artist-info">
          <span class="artist-name" title="${artist.name}">${artist.name}</span>
          <span class="artist-popularity">Popularity: ${artist.popularity}/100</span>
        </div>
      </li>
    `).join('');

  document.getElementById('top-songs').innerHTML = data.topTracks
    .map((track, index) => `
      <li>
        <span class="track-rank">${index + 1}</span>
        <img src="${track.album.images[0]?.url || 'default.jpg'}" alt="${track.name}" />
        <div class="track-info">
          <span class="track-name" title="${track.name}">${track.name}</span>
          <span class="track-artist">${track.artists.map(a => a.name).join(', ')}</span>
        </div>
      </li>
    `).join('');
  
  document.getElementById('top-genres').innerHTML = data.topGenres
    .map(([genre, count]) => `
      <li>
        <span class="genre-name">${genre}</span>
        <div class="genre-bar-container">
          <div class="genre-bar" style="width: ${(count / data.topGenres[0][1]) * 100}%"></div>
        </div>
      </li>
    `).join('');
  
  document.getElementById('listening-summary').innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Total Listening Time</span>
      <span class="stat-value">${data.listeningTime}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Top Tracks Analyzed</span>
      <span class="stat-value">${data.totalTracks}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Most Played Artist</span>
      <span class="stat-value">${data.favoriteArtist}</span>
    </div>
  `;
}

function viewFullList(type, list) {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
    section.style.display = 'none';
  });

  let fullViewSection = document.getElementById('full-view-section');
  if (!fullViewSection) {
    fullViewSection = document.createElement('div');
    fullViewSection.id = 'full-view-section';
    document.querySelector('.content').appendChild(fullViewSection);
  }

  fullViewSection.className = 'section active';
  fullViewSection.style.display = 'block';
  fullViewSection.innerHTML = `
    <div class="full-view-nav">
      <button class="back-button" onclick="backToStats()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Stats
      </button>
      <h2>Your Top ${type === 'artists' ? 'Artists' : type === 'songs' ? 'Tracks' : 'Genres'}</h2>
      <div class="time-range-selector">
        <button class="time-range-btn ${currentTimeRange === 'long_term' ? 'active' : ''}" data-range="long_term">All Time</button>
        <button class="time-range-btn ${currentTimeRange === 'medium_term' ? 'active' : ''}" data-range="medium_term">Last 6 Months</button>
        <button class="time-range-btn ${currentTimeRange === 'short_term' ? 'active' : ''}" data-range="short_term">Last 4 Weeks</button>
      </div>
    </div>
    <div class="full-view-content">
      <div class="full-view-chart-container">
        <canvas id="${type}-full-chart"></canvas>
      </div>
      <div class="full-view-list-container">
        <ul class="full-view-list"></ul>
      </div>
    </div>
  `;

  updateFullListView(type, list);
  
  document.querySelectorAll('#full-view-section .time-range-btn').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('#full-view-section .time-range-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      currentTimeRange = this.dataset.range;
      
      loadTopData().then(() => {
        const updatedList = window[`full${type.charAt(0).toUpperCase() + type.slice(1)}List`];
        updateFullListView(type, updatedList);
        
        if (type === 'artists') {
          renderFullViewChart(
            `${type}-full-chart`,
            'bar',
            updatedList.slice(0, 15).map(a => a.name),
            updatedList.slice(0, 15).map(a => a.popularity),
            'Artist Popularity'
          );
        } else if (type === 'songs') {
          renderFullViewChart(
            `${type}-full-chart`,
            'bar',
            updatedList.slice(0, 15).map(t => t.name.substring(0, 15) + (t.name.length > 15 ? '...' : '')),
            updatedList.slice(0, 15).map(t => Math.floor(t.duration_ms / 1000)),
            'Track Duration (seconds)'
          );
        } else if (type === 'genres') {
          renderFullViewChart(
            `${type}-full-chart`,
            'pie',
            updatedList.slice(0, 15).map(g => g[0]),
            updatedList.slice(0, 15).map(g => g[1]),
            'Genre Distribution'
          );
        }
      });
    });
  });

  if (type === 'songs') {
    document.querySelectorAll('.play-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioUrl = e.target.closest('button').getAttribute('data-song-url');
        playAudioPreview(audioUrl);
      });
    });
  }
}

function updateFullListView(type, list) {
  try {
    const itemsList = document.querySelector('#full-view-section .full-view-list');
    if (!itemsList) throw new Error('List container not found');

    if (type === 'artists') {
      itemsList.innerHTML = list.map(artist => `
        <li>
          <img src="${artist.images?.[0]?.url || 'default.jpg'}" alt="${artist.name}" />
          <div class="item-info">
            <span class="item-name">${artist.name}</span>
            <span class="item-detail">Popularity: ${artist.popularity}/100</span>
            <span class="item-detail">Genres: ${artist.genres.slice(0, 3).join(', ')}</span>
          </div>
        </li>
      `).join('');
    } else if (type === 'songs') {
      itemsList.innerHTML = list.map((track, index) => `
        <li>
          <span class="item-rank">${index + 1}</span>
          <img src="${track.album.images?.[0]?.url || 'default.jpg'}" alt="${track.name}" />
          <div class="item-info">
            <span class="item-name">${track.name}</span>
            <span class="item-detail">${track.artists.map(a => a.name).join(', ')}</span>
            <span class="item-detail">${formatDuration(track.duration_ms)}</span>
          </div>
          <div class="track-actions">
            ${track.preview_url ? `
              <button class="play-button" data-song-url="${track.preview_url}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>` : ''}
            <a href="${track.external_urls.spotify}" target="_blank" class="spotify-link-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
            </a>
          </div>
        </li>
      `).join('');
    } else if (type === 'genres') {
      itemsList.innerHTML = list.map(([genre, count], index) => `
        <li>
          <span class="item-rank">${index + 1}</span>
          <div class="item-info">
            <span class="item-name">${genre}</span>
            <div class="genre-bar-container">
              <div class="genre-bar" style="width: ${(count / list[0][1]) * 100}%"></div>
              <span class="item-count">${count} artists</span>
            </div>
          </div>
        </li>
      `).join('');
    }
  } catch (error) {
    console.error('Error updating full list view:', error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = 'Failed to load content. Please try again.';
    document.querySelector('#full-view-section .full-view-content').prepend(errorDiv);
  }
}

function renderFullViewChart(elementId, chartType, labels, data, title) {
  setTimeout(() => {
    const canvas = document.getElementById(elementId);
    if (!canvas) {
      console.error(`Canvas element not found, retrying...`);
      return setTimeout(() => renderFullViewChart(elementId, chartType, labels, data, title), 100);
    }

    if (chartInstances.fullView) {
      chartInstances.fullView.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances.fullView = new Chart(ctx, {
      type: chartType,
      data: {
        labels: labels,
        datasets: [{
          label: title,
          data: data,
          backgroundColor: chartType === 'pie' ? 
                     [
                       '#4E79A7', // muted blue
                       '#F28E2B', // orange
                       '#E15759', // red
                       '#76B7B2', // teal
                       '#59A14F', // green
                       '#EDC948', // yellow-gold
                       '#B07AA1', // purple
                       '#FF9DA7', // soft pink
                       '#9C755F', // brownish
                       '#BAB0AC'  // neutral gray
                     ].sort(() => Math.random() - 0.5) : '#1DB954',
          borderColor: '#1DB954',
          borderWidth: 1
        }]
      },
      options: getChartOptions(title)
    });
  }, 50);
}

function getChartOptions(yAxisTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#b3b3b3',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: '#282828',
        titleColor: '#1DB954',
        bodyColor: '#ffffff',
        borderColor: '#1DB954',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: '#b3b3b3'
        },
        title: {
          display: !!yAxisTitle,
          text: yAxisTitle,
          color: '#b3b3b3'
        },
        grid: {
          color: 'rgba(255,255,255,0.1)'
        }
      },
      x: {
        ticks: {
          color: '#b3b3b3',
          maxRotation: 45,
          minRotation: 45
        },
        grid: {
          display: false
        }
      }
    }
  };
}

function backToStats() {
  const fullViewSection = document.getElementById('full-view-section');
  if (fullViewSection) {
    fullViewSection.remove();
  }
  
  const statsSection = document.getElementById('stats-section');
  statsSection.classList.add('active');
  statsSection.style.display = 'block';
  statsSection.scrollTop = 0;
  
  document.querySelectorAll('.nav-link').forEach(navLink => {
    navLink.classList.remove('active');
  });
  document.querySelector('.nav-link[href="#stats-section"]').classList.add('active');
  
  if (chartInstances.fullView) {
    chartInstances.fullView.destroy();
    chartInstances.fullView = null;
  }
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds.padStart(2, '0')}`;
}

async function createPlaylist(name, description, isPublic) {
  try {
    const response = await makeRequest(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          description: description,
          public: isPublic
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message.includes('scope')) {
        // Handle insufficient scope error
        showError('Missing required permissions. Please log in again.');
        loginWithSpotify(); // Force re-authentication
        return;
      }
      throw new Error(errorData.error?.message || 'Failed to create playlist');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Playlist creation failed:', error);
    throw new Error(`Playlist creation failed: ${error.message}`);
  }
}
async function addTracksToPlaylist(playlistId, trackUris) {
  try {
    const response = await makeRequest(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uris: trackUris,
          position: 0
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to add tracks');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to add tracks:', error);
    throw new Error(`Failed to add tracks: ${error.message}`);
  }
}


function getSelectedGenres() {
  const checkboxes = document.querySelectorAll('.genre-checkbox:checked');
  const selectedGenres = Array.from(checkboxes).map(cb => cb.id.replace('genre-', ''));
  
  if (selectedGenres.length === 0) {
    showError('Please select at least one genre');
    return null;
  }
  
  return selectedGenres;
}
function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  const container = document.getElementById('mood-playlist-container');
  container.prepend(errorElement);
  
  setTimeout(() => errorElement.remove(), 5000);
}
function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;
  
  const container = document.getElementById('mood-playlist-container');
  container.prepend(errorElement);
  
  setTimeout(() => errorElement.remove(), 5000);
}
async function getSeedTracks() {
  try {
    const response = await makeRequest('https://api.spotify.com/v1/me/top/tracks?limit=5');
    const data = await response.json();
    return data.items.map(track => track.id);
  } catch (error) {
    console.error('Error getting seed tracks:', error);
    return [];
  }
}
async function getRecommendedTracks(seedTracks, genres, limit) {
  try {
    if (seedTracks.length > 0) {
      const response = await makeRequest(
        `https://api.spotify.com/v1/recommendations?limit=${limit}&seed_tracks=${seedTracks.join(',')}`
      );
      const data = await response.json();
      
      if (data.tracks.length > 0) {
        return data.tracks.filter(track => 
          track.artists.some(artist => 
            artist.genres?.some(genre => genres.includes(simplifyGenre(genre)))
        ).slice(0, limit));
      }
    }
    
    return await getTracksByGenres(genres, limit);
    
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return await getTracksByGenres(genres, limit);
  }
}
async function getTracksByGenres(genres, limit) {
  const tracks = [];
  let genreIndex = 0;
  
  while (tracks.length < limit && genreIndex < genres.length * 3) {
    const genre = genres[genreIndex % genres.length];
    try {
      const response = await makeRequest(
        `https://api.spotify.com/v1/search?q=genre:${encodeURIComponent(genre)}&type=track&limit=5`
      );
      const data = await response.json();
      
      data.tracks.items.forEach(track => {
        if (tracks.length < limit && !tracks.some(t => t.id === track.id)) {
          tracks.push(track);
        }
      });
    } catch (error) {
      console.error(`Error searching genre ${genre}:`, error);
    }
    
    genreIndex++;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return tracks;
}
async function fetchTopTracks(limit) {
  const response = await makeRequest(
    `https://api.spotify.com/v1/me/top/tracks?limit=${limit}`
  );
  const tracksData = await response.json();
  return tracksData.items;
}





// Playlist Generation
async function generateSpecialPlaylist() {
  const button = document.getElementById('generate-playlist-button');
  button.classList.add('loading');
  
  try {
    const playlistType = document.getElementById('playlist-type').value;
    const isAI = playlistType === 'ai';
    const playlistName = document.getElementById('playlist-name').value || 
                       `My ${playlistType} Playlist`;
    const trackCount = parseInt(document.getElementById('playlist-duration').value);
    const isPublic = document.getElementById('playlist-privacy').checked;

    if (trackCount < 1 || trackCount > 50) {
      throw new Error('Playlist must contain 1-50 songs');
    }

    let tracksToAdd = [];
    
    if (isAI) {
      const aiPrompt = document.getElementById('ai-prompt').value.trim();
      if (!aiPrompt) throw new Error('Please describe your playlist idea');
      
      tracksToAdd = await generateAIPlaylist(aiPrompt, trackCount);
    } else {
      const manualTracks = Array.from(document.getElementById('mood-playlist').children).map(item => ({
        uri: item.getAttribute('data-track-uri'),
        id: item.getAttribute('data-track-id'),
        name: item.querySelector('.track-name').textContent,
        artists: [{ name: item.querySelector('.track-artist').textContent }],
        album: {
          images: [{ url: item.querySelector('img').src }]
        },
        external_urls: {
          spotify: item.querySelector('.spotify-link-button').href
        },
        preview_url: item.querySelector('.play-button')?.getAttribute('data-song-url') || null
      }));

      if (manualTracks.length > 0) {
        tracksToAdd = manualTracks.slice(0, trackCount);
      } else {
        const selectedGenres = getSelectedGenres();
        if (selectedGenres.length === 0) {
          throw new Error('Please select at least one genre');
        }

        const seedTracks = await getSeedTracks();
        tracksToAdd = await getRecommendedTracks(seedTracks, selectedGenres, trackCount);
      }
    }

    if (tracksToAdd.length === 0) {
      throw new Error('Failed to find tracks for your playlist');
    }

    tracksToAdd = tracksToAdd.slice(0, trackCount);
    showGeneratedPlaylist(playlistName, tracksToAdd, isPublic);
    
  } catch (error) {
    showError(error.message);
  } finally {
    button.classList.remove('loading');
  }
}

async function generateAIPlaylist(prompt, limit) {
  try {
    // Show loading state
    document.getElementById('generation-status').textContent = 
      "🧠 AI is generating your playlist...";
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{
          role: "user",
          content: `Suggest ${limit} exact song titles and artists for a Spotify playlist based on: "${prompt}". 
                    Return ONLY a JSON array like this: 
                    [{"name":"Song Title","artist":"Artist Name"},...]`
        }],
        temperature: 0.7
      })
    });

    if (!response.ok) throw new Error('AI request failed');
    
    const data = await response.json();
    let songs;
    
    try {
      // Try to parse the AI response
      songs = JSON.parse(data.choices[0].message.content);
    } catch (e) {
      // Fallback if the response isn't perfect JSON
      songs = extractSongsFromText(data.choices[0].message.content);
    }

    // Search Spotify for each song
    const spotifyTracks = [];
    for (const song of songs) {
      try {
        const searchResponse = await makeRequest(
          `https://api.spotify.com/v1/search?q=track:${encodeURIComponent(song.name)} artist:${encodeURIComponent(song.artist)}&type=track&limit=1`
        );
        const searchData = await searchResponse.json();
        if (searchData.tracks.items[0]) {
          spotifyTracks.push(searchData.tracks.items[0]);
        }
      } catch (error) {
        console.error(`Couldn't find song: ${song.name} by ${song.artist}`, error);
      }
      
      // Avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return spotifyTracks;
    
  } catch (error) {
    console.error('AI generation failed:', error);
    // Fallback to top tracks if AI fails
    return await fetchTopTracks(limit);
  } finally {
    document.getElementById('generation-status').textContent = "";
  }
}

// Helper function to extract songs if JSON parse fails
function extractSongsFromText(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const songs = [];
  
  lines.forEach(line => {
    const match = line.match(/"name":"([^"]+)","artist":"([^"]+)"/) || 
                 line.match(/"title":"([^"]+)","artist":"([^"]+)"/) ||
                 line.match(/(.+)\s+by\s+(.+)/i);
    if (match) {
      songs.push({
        name: match[1].trim(),
        artist: match[2].trim()
      });
    }
  });
  
  return songs;
}
async function fetchTopTracks(limit) {
  const response = await makeRequest(
    `https://api.spotify.com/v1/me/top/tracks?limit=${limit}`
  );
  const tracksData = await response.json();
  return tracksData.items;
}

function showGeneratedPlaylist(playlistName, tracks, isPublic) {
  // Initialize tracks array and playlist info
  window.generatedTracks = Array.isArray(tracks) ? tracks : [];
  window.currentPlaylistInfo = {
    name: playlistName || "New Playlist",
    isPublic: typeof isPublic === 'boolean' ? isPublic : true,
    tracks: window.generatedTracks
  };

  const tracksHtml = window.generatedTracks.map((track, index) => `
    <li class="track-item" data-track-id="${track.id}" data-track-uri="${track.uri}">
      <div class="track-number">${index + 1}</div>
      <img src="${track.album?.images?.[0]?.url || 'default.jpg'}" 
           alt="${track.name}" />
      <div class="track-info">
        <span class="track-name">${track.name}</span>
        <span class="track-artist">${track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}</span>
      </div>
      <div class="track-actions">
        <button class="remove-button" data-track-id="${track.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff6b6b">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        ${track.preview_url ? 
          `<button class="play-button" data-song-url="${track.preview_url}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>` : ''}
        <a href="${track.external_urls?.spotify || '#'}" target="_blank" class="spotify-link-button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
        </a>
      </div>
    </li>
  `).join('');

  const modalContent = `
    <div class="modal-header">
      <h3>Generated Playlist: ${playlistName}</h3>
      <button class="close-button" aria-label="Close modal">×</button>
    </div>
    <div class="playlist-actions">
      <button id="save-final-playlist" class="save-button">Save to Spotify</button>
      <button id="cancel-playlist" class="cancel-button">Cancel</button>
    </div>
    <div class="modal-body">
      <div class="modal-playlist-container">
        <ul class="generated-playlist-tracks">${tracksHtml}</ul>
      </div>
      <div class="add-tracks-section">
        <h4>Add More Songs</h4>
        <div class="search-input-container">
          <input type="text" id="search-tracks" placeholder="Search for songs...">
          <button id="search-button">Search</button>
        </div>
        <div id="search-results-container" class="search-results-container">
          <div id="search-results" class="search-results"></div>
        </div>
      </div>
    </div>
  `;

  openModal(modalContent);

  document.querySelectorAll('.remove-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const trackId = e.target.closest('button').getAttribute('data-track-id');
      removeTrackFromGeneratedPlaylist(trackId);
    });
  });

  document.querySelectorAll('.play-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const audioUrl = e.target.closest('button').getAttribute('data-song-url');
      playAudioPreview(audioUrl);
    });
  });

  document.getElementById('save-final-playlist').addEventListener('click', saveFinalPlaylist);
  document.getElementById('cancel-playlist').addEventListener('click', closeModal);
  document.getElementById('search-button').addEventListener('click', searchTracks);
  
  document.getElementById('search-tracks').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchTracks();
    }
  });
}
function removeTrackFromGeneratedPlaylist(trackId) {
  // Safety checks
  if (!window.generatedTracks || !Array.isArray(window.generatedTracks)) {
    console.error('Generated tracks not properly initialized');
    return;
  }

  // Filter out the track
  window.generatedTracks = window.generatedTracks.filter(track => track.id !== trackId);
  
  // Update current playlist info
  if (window.currentPlaylistInfo) {
    window.currentPlaylistInfo.tracks = window.generatedTracks;
  }

  // Refresh view
  showGeneratedPlaylist(
    window.currentPlaylistInfo?.name || "New Playlist",
    window.generatedTracks,
    window.currentPlaylistInfo?.isPublic ?? true
  );
}
async function searchTracks() {
  const query = document.getElementById('search-tracks').value.trim();
  if (!query) return;

  const searchButton = document.getElementById('search-button');
  searchButton.disabled = true;
  searchButton.textContent = 'Searching...';

  try {
    const response = await makeRequest(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`
    );
    const data = await response.json();
    
    const resultsHtml = data.tracks.items.map(track => `
      <div class="search-result-item" data-track-id="${track.id}">
        <img src="${track.album.images[0]?.url || 'default.jpg'}" alt="${track.name}" />
        <div class="search-result-info">
          <span class="track-name">${track.name}</span>
          <span class="track-artist">${track.artists.map(a => a.name).join(', ')}</span>
        </div>
        <button class="add-track-button" data-track-id="${track.id}">Add</button>
      </div>
    `).join('');

    document.getElementById('search-results').innerHTML = resultsHtml || '<p>No results found</p>';
    
    document.querySelectorAll('.add-track-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const trackId = e.target.getAttribute('data-track-id');
        const trackToAdd = data.tracks.items.find(track => track.id === trackId);
        if (trackToAdd) {
          addTrackToGeneratedPlaylist(trackToAdd);
        }
      });
    });
    
  } catch (error) {
    console.error('Search failed:', error);
    document.getElementById('search-results').innerHTML = '<p class="error-message">Error searching for tracks</p>';
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = 'Search';
  }
}
function addTrackToGeneratedPlaylist(track) {
  // Safely initialize if not exists
  if (!window.generatedTracks) {
    window.generatedTracks = [];
  }
  
  // Validate track object
  if (!track || !track.id) {
    console.error('Invalid track object:', track);
    return;
  }

  // Check for existing track
  const exists = window.generatedTracks.some(t => t.id === track.id);
  if (exists) {
    alert('This track is already in the playlist');
    return;
  }

  // Add new track
  window.generatedTracks.push(track);
  
  // Update current playlist info
  if (window.currentPlaylistInfo) {
    window.currentPlaylistInfo.tracks = window.generatedTracks;
  }

  // Refresh view
  showGeneratedPlaylist(
    window.currentPlaylistInfo?.name || "New Playlist",
    window.generatedTracks,
    window.currentPlaylistInfo?.isPublic ?? true
  );
}

async function saveFinalPlaylist() {
  const button = document.getElementById('save-final-playlist');
  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    // Use the tracks stored in currentPlaylistInfo
    const { name, isPublic, tracks } = window.currentPlaylistInfo;
    
    if (!tracks || tracks.length === 0) {
      throw new Error('No tracks available to save');
    }

    // Create playlist
    const playlist = await createPlaylist(
      name,
      "Created with PiedPiper",
      isPublic
    );

    // Prepare track URIs
    const trackUris = tracks
      .filter(track => track.uri)
      .map(track => track.uri);

    // Add tracks in batches of 100
    const batchSize = 100;
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      await addTracksToPlaylist(playlist.id, batch);
    }

    // Show success message
    const successContent = `
      <div class="modal-header">
        <h3>Playlist Saved!</h3>
        <button class="close-button">×</button>
      </div>
      <div class="success-message">
        <p>"${name}" is now in your Spotify library.</p>
        <a href="${playlist.external_urls.spotify}" target="_blank" class="success-link">
          Open in Spotify
        </a>
      </div>
    `;
    
    openModal(successContent);
    
  } catch (error) {
    console.error("Save failed:", error);
    if (error.message.includes('scope')) {
      const errorContent = `
        <div class="modal-header">
          <h3>Permission Required</h3>
          <button class="close-button">×</button>
        </div>
        <div class="error-message">
          <p>We need additional permissions to create playlists.</p>
          <button id="reauthorize" class="save-button">Grant Permissions</button>
        </div>
      `;
      
      openModal(errorContent);
      document.getElementById('reauthorize').addEventListener('click', loginWithSpotify);
    }  
  } finally {
    button.disabled = false;
    button.textContent = 'Save to Spotify';
  }
}
async function showPlaylistTracks(playlistId, playlistName) {
  try {
    const response = await makeRequest(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`
    );
    const data = await response.json();
    
    const tracksHtml = data.items.map(item => `
      <li class="track-item">
        <img src="${item.track.album.images[0]?.url || 'default.jpg'}" 
             alt="${item.track.name}" />
        <div class="track-info">
          <span class="track-name">${item.track.name}</span>
          <span class="track-artist">${item.track.artists.map(a => a.name).join(', ')}</span>
        </div>
        <div class="track-actions">
          ${item.track.preview_url ? 
            `<button class="play-button" data-song-url="${item.track.preview_url}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>` : ''}
          <a href="${item.track.external_urls.spotify}" target="_blank" class="spotify-link-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
          </a>
        </div>
      </li>
    `).join('');
    
    const modalContent = `
      <div class="modal-header">
        <h3>${playlistName}</h3>
        <button class="close-button" aria-label="Close modal">×</button>
      </div>
      <ul class="playlist-tracks">${tracksHtml}</ul>
    `;
    
    openModal(modalContent);
    
    document.querySelectorAll('.play-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioUrl = e.target.closest('button').getAttribute('data-song-url');
        playAudioPreview(audioUrl);
      });
    });
    
    document.querySelector('.close-button').addEventListener('click', closeModal);
    
  } catch (error) {
    const errorContent = `
      <div class="modal-header">
        <h3>Error</h3>
        <button class="close-button" aria-label="Close modal">×</button>
      </div>
      <p>Failed to load tracks: ${error.message}</p>
    `;
    openModal(errorContent);
    document.querySelector('.close-button').addEventListener('click', closeModal);
  }
}

function playAudioPreview(url) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  currentAudio = new Audio(url);
  currentAudio.play().catch(e => console.error('Audio playback failed:', e));
}

function openModal(content) {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  
  modalContent.innerHTML = content;
  modal.style.display = 'flex';
  
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('role', 'dialog');
  modalContent.setAttribute('tabindex', '0');
  modalContent.focus();
}

function closeModal() {
  const modal = document.getElementById('modal');
  
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  modal.style.display = 'none';
  modal.removeAttribute('aria-modal');
  modal.removeAttribute('role');
}

/* ===== Song Search Functionality ===== */
async function searchSongs() {
  const query = document.getElementById('song-search-input').value.trim();
  if (!query) return;

  const button = document.getElementById('song-search-button');
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Searching...';

  try {
    const response = await makeRequest(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`
    );
    const data = await response.json();
    
    displaySearchResults(data.tracks.items);
  } catch (error) {
    console.error('Search failed:', error);
    document.getElementById('song-search-results').innerHTML = `
      <div class="error-message">
        Failed to search for songs: ${error.message}
      </div>
    `;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function displaySearchResults(tracks) {
  const resultsContainer = document.getElementById('song-search-results');
  
  if (!tracks || tracks.length === 0) {
    resultsContainer.innerHTML = '<p>No results found</p>';
    return;
  }

  resultsContainer.innerHTML = tracks.map(track => `
    <div class="search-result" data-track-id="${track.id}">
      <img src="${track.album.images[0]?.url || 'default.jpg'}" alt="${track.name}" />
      <div class="search-result-info">
        <div class="search-result-name">${track.name}</div>
        <div class="search-result-artist">${track.artists.map(a => a.name).join(', ')}</div>
      </div>
      <button class="add-song-button" 
              data-track-id="${track.id}"
              data-track-name="${track.name}"
              data-track-artist="${track.artists.map(a => a.name).join(', ')}"
              data-track-uri="${track.uri}"
              data-track-image="${track.album.images[0]?.url || ''}">
        Add to Playlist
      </button>
    </div>
  `).join('');

  // Add event listeners to the add buttons
  document.querySelectorAll('.add-song-button').forEach(button => {
    button.addEventListener('click', function() {
      const track = {
        id: this.getAttribute('data-track-id'),
        name: this.getAttribute('data-track-name'),
        artists: [{ name: this.getAttribute('data-track-artist') }],
        uri: this.getAttribute('data-track-uri'),
        album: {
          images: this.getAttribute('data-track-image') ? 
            [{ url: this.getAttribute('data-track-image') }] : []
        },
        external_urls: {
          spotify: `https://open.spotify.com/track/${this.getAttribute('data-track-id')}`
        },
        preview_url: track.preview_url || ''
      };
      
      addTrackToMoodPlaylist(track);
    });
  });
}

function addTrackToMoodPlaylist(track) {
  const playlistContainer = document.getElementById('mood-playlist');
  
  // Check if track already exists
  const existingTrack = playlistContainer.querySelector(`[data-track-id="${track.id}"]`);
  if (existingTrack) {
    alert('This track is already in your playlist');
    return;
  }

  const trackElement = document.createElement('li');
  trackElement.className = 'track-item';
  trackElement.setAttribute('data-track-id', track.id);
  trackElement.setAttribute('data-track-uri', track.uri);
  
  trackElement.innerHTML = `
    <div class="track-number">${playlistContainer.children.length + 1}</div>
    <img src="${track.album.images[0]?.url || 'default.jpg'}" 
         alt="${track.name}" />
    <div class="track-info">
      <span class="track-name">${track.name}</span>
      <span class="track-artist">${track.artists.map(a => a.name).join(', ')}</span>
    </div>
    <div class="track-actions">
      <button class="remove-button" data-track-id="${track.id}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff6b6b">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
      ${track.preview_url ? 
        `<button class="play-button" data-song-url="${track.preview_url}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>` : ''}
      <a href="${track.external_urls.spotify}" target="_blank" class="spotify-link-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
      </a>
    </div>
  `;

  playlistContainer.appendChild(trackElement);
  
  // Add event listener to the remove button
  trackElement.querySelector('.remove-button').addEventListener('click', function() {
    trackElement.remove();
    updateTrackNumbers();
  });
}
function logout() {
  // Clear all stored tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  
  // Clear any user data
  userId = null;
  accessToken = null;
  refreshToken = null;
  
  // Redirect to the login page (which will be the same page)
  window.location.href = 'https://fadilbinjabi.github.io/Pied-Piper/intro.html';
}

function updateTrackNumbers() {
  const playlistContainer = document.getElementById('mood-playlist');
  Array.from(playlistContainer.children).forEach((item, index) => {
    item.querySelector('.track-number').textContent = index + 1;
  });
}
