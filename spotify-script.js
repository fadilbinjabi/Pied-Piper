const clientId = '43f735a675d04dc593023010c69937f3';
const redirectUri = 'http://localhost:5500/main.html';
const scopes = [
  'user-top-read',
  'playlist-read-private',
  'playlist-modify-private', 
  'playlist-modify-public',
  'user-read-email',
  'user-read-private'
].join(' ');

let userId;
let accessToken;
let refreshToken;
let lastRequestTime = 0;
let currentAudio = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
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
  }
});

function setupModalHandlers() {
  const modal = document.getElementById('modal');
  
  // Close when clicking outside content
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Close with Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
}

function loginWithSpotify() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

async function refreshAccessToken() {
  try {
    // Note: This requires a backend endpoint to securely refresh tokens
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
  // Rate limiting
  const now = Date.now();
  const delay = Math.max(0, 1000 - (now - lastRequestTime));
  await new Promise(resolve => setTimeout(resolve, delay));
  
  if (!options.headers) options.headers = {};
  options.headers.Authorization = `Bearer ${accessToken}`;
  
  let response = await fetch(url, options);
  
  // Token expired - try refreshing
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
    
    // Set user icon
    const userIcon = document.querySelector('.user-icon');
    if (userData.images?.[0]?.url) {
      userIcon.src = userData.images[0].url;
    }
    
    // Load user content
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

    // Add click handlers
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
    const [artistsRes, tracksRes, genresRes] = await Promise.all([
      makeRequest('https://api.spotify.com/v1/me/top/artists?limit=50'),
      makeRequest('https://api.spotify.com/v1/me/top/tracks?limit=50'),
      makeRequest('https://api.spotify.com/v1/me/top/artists?limit=10')
    ]);
    
    const [artistsData, tracksData, genresData] = await Promise.all([
      artistsRes.json(),
      tracksRes.json(),
      genresRes.json()
    ]);
    
    // Top Artists
    window.fullArtistsList = artistsData.items;
    document.getElementById('top-artists').innerHTML = artistsData.items
      .slice(0, 3)
      .map(artist => `
        <li>
          <img src="${artist.images[0]?.url || 'default.jpg'}" alt="${artist.name}" />
          <span>${artist.name}</span>
        </li>
      `).join('');
    
    // Top Tracks
    window.fullSongsList = tracksData.items;
    document.getElementById('top-songs').innerHTML = tracksData.items
      .slice(0, 3)
      .map(track => `
        <li>
          <img src="${track.album.images[0]?.url || 'default.jpg'}" alt="${track.name}" />
          <span>${track.name} by ${track.artists.map(a => a.name).join(', ')}</span>
        </li>
      `).join('');
    
    // Listening Summary
    document.getElementById('listening-summary').innerHTML = `
      Total Tracks: ${tracksData.items.length}<br>
      Favorite Artist: ${tracksData.items[0]?.artists[0]?.name || 'Unknown'}
    `;
    
    // Top Genres
    const genres = {};
    genresData.items.forEach(artist => {
      artist.genres.forEach(genre => {
        genres[genre] = (genres[genre] || 0) + 1;
      });
    });
    
    document.getElementById('top-genres').innerHTML = 
      Object.entries(genres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([genre]) => `<li>${genre}</li>`)
        .join('');
        
  } catch (error) {
    console.error('Error loading top data:', error);
    document.getElementById('top-artists').innerHTML = '<li>Failed to load data</li>';
    document.getElementById('top-songs').innerHTML = '<li>Failed to load data</li>';
    document.getElementById('listening-summary').innerHTML = 'Failed to load data';
    document.getElementById('top-genres').innerHTML = '<li>Failed to load data</li>';
  }
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
    
    return await response.json();
  } catch (error) {
    console.error('Playlist creation failed:', error);
    throw new Error('Failed to create playlist. Please check your permissions.');
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
    
    return await response.json();
  } catch (error) {
    console.error('Failed to add tracks:', error);
    throw new Error('Failed to add tracks to playlist.');
  }
}

// ... (keep all previous constants and variables at the top)

async function generateSpecialPlaylist() {
  const button = document.getElementById('generate-playlist-button');
  button.classList.add('loading');
  
  try {
    // Get settings from UI
    const playlistType = document.getElementById('playlist-type').value;
    const playlistName = document.getElementById('playlist-name').value || 
                         `My ${playlistType} Playlist`;
    const playlistDuration = document.getElementById('playlist-duration').value;
    const isPublic = document.getElementById('playlist-privacy').checked;

    // Get top tracks
    const tracksResponse = await makeRequest(
      `https://api.spotify.com/v1/me/top/tracks?limit=${playlistDuration}`
    );
    const tracksData = await tracksResponse.json();
    
    // Store tracks for later use
    window.generatedTracks = tracksData.items;
    
    // Show tracks in modal for review
    showGeneratedPlaylist(playlistName, tracksData.items, isPublic);
    
  } catch (error) {
    console.error("Error generating playlist:", error);
    alert(`Error: ${error.message}`);
  } finally {
    button.classList.remove('loading');
  }
}

function showGeneratedPlaylist(playlistName, tracks, isPublic) {
  const tracksHtml = tracks.map((track, index) => `
    <li class="track-item" data-track-id="${track.id}" data-track-uri="${track.uri}">
      <div class="track-number">${index + 1}</div>
      <img src="${track.album.images[0]?.url || 'default.jpg'}" 
           alt="${track.name}" />
      <div class="track-info">
        <span class="track-name">${track.name}</span>
        <span class="track-artist">${track.artists.map(a => a.name).join(', ')}</span>
      </div>
      <div class="track-actions">
        <button class="remove-button" data-track-id="${track.id}">Remove</button>
        ${track.preview_url ? 
          `<button class="play-button" data-song-url="${track.preview_url}">Play</button>` : 
          ''}
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
    <ul class="generated-playlist-tracks">${tracksHtml}</ul>
    <div class="add-tracks-section">
      <h4>Add More Songs</h4>
      <input type="text" id="search-tracks" placeholder="Search for songs...">
      <button id="search-button">Search</button>
      <div id="search-results"></div>
    </div>
  `;

  openModal(modalContent);
  
  // Store playlist info for saving later
  window.currentPlaylistInfo = {
    name: playlistName,
    isPublic: isPublic
  };

  // Add event listeners
  document.querySelectorAll('.remove-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = e.target.getAttribute('data-track-id');
      removeTrackFromGeneratedPlaylist(trackId);
    });
  });

  document.querySelectorAll('.play-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const audioUrl = e.target.getAttribute('data-song-url');
      playAudioPreview(audioUrl);
    });
  });

  document.getElementById('save-final-playlist').addEventListener('click', saveFinalPlaylist);
  document.getElementById('cancel-playlist').addEventListener('click', closeModal);
  document.getElementById('search-button').addEventListener('click', searchTracks);
  
  // Also allow Enter key for search
  document.getElementById('search-tracks').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchTracks();
    }
  });
}

function removeTrackFromGeneratedPlaylist(trackId) {
  window.generatedTracks = window.generatedTracks.filter(track => track.id !== trackId);
  showGeneratedPlaylist(
    window.currentPlaylistInfo.name, 
    window.generatedTracks, 
    window.currentPlaylistInfo.isPublic
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
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`
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
    
    // Add event listeners to add buttons
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
    document.getElementById('search-results').innerHTML = '<p>Error searching for tracks</p>';
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = 'Search';
  }
}

function addTrackToGeneratedPlaylist(track) {
  // Check if track already exists
  if (window.generatedTracks.some(t => t.id === track.id)) {
    alert('This track is already in the playlist');
    return;
  }
  
  window.generatedTracks.push(track);
  showGeneratedPlaylist(
    window.currentPlaylistInfo.name, 
    window.generatedTracks, 
    window.currentPlaylistInfo.isPublic
  );
}

async function saveFinalPlaylist() {
  const button = document.getElementById('save-final-playlist');
  button.disabled = true;
  button.textContent = 'Saving...';
  
  try {
    // Create playlist
    const playlist = await createPlaylist(
      window.currentPlaylistInfo.name,
      "Created with SpotifyPlay",
      window.currentPlaylistInfo.isPublic
    );
    
    // Add tracks
    const trackUris = window.generatedTracks.map(track => track.uri);
    await addTracksToPlaylist(playlist.id, trackUris);
    
    alert("Playlist saved successfully to Spotify!");
    closeModal();
    fetchUserPlaylists();
    
  } catch (error) {
    console.error("Error saving playlist:", error);
    alert(`Error: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Save to Spotify';
  }
}

// ... (keep all other existing functions below)

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
        ${item.track.preview_url ? 
          `<button class="play-button" data-song-url="${item.track.preview_url}">Play</button>` 
          : ''}
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
    
    // Add play button handlers
    document.querySelectorAll('.play-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const audioUrl = e.target.getAttribute('data-song-url');
        playAudioPreview(audioUrl);
      });
    });
    
    // Add close button handler
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
  // Stop any currently playing audio
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
  
  // Set focus to modal for keyboard navigation
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('role', 'dialog');
  modalContent.setAttribute('tabindex', '0');
  modalContent.focus();
}

function closeModal() {
  const modal = document.getElementById('modal');
  
  // Stop any playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  modal.style.display = 'none';
  modal.removeAttribute('aria-modal');
  modal.removeAttribute('role');
}

function viewFullList(type, list) {
  const itemsHtml = list.map(item => `
    <li class="list-item">
      <img src="${item.images ? item.images[0]?.url : item.album?.images[0]?.url || 'default.jpg'}" 
           alt="${item.name}" />
      <div class="item-info">
        <span class="item-name">${item.name}</span>
        ${item.artists ? `<span class="item-artist">${item.artists.map(a => a.name).join(', ')}</span>` : ''}
      </div>
      ${item.preview_url ? `<button class="play-button" data-song-url="${item.preview_url}">Play</button>` : ''}
    </li>
  `).join('');
  
  const modalContent = `
    <div class="modal-header">
      <h3>Your Top ${type === 'artists' ? 'Artists' : 'Tracks'}</h3>
      <button class="close-button" aria-label="Close modal">×</button>
    </div>
    <ul class="full-list">${itemsHtml}</ul>
  `;
  
  openModal(modalContent);
  
  // Add play button handlers
  document.querySelectorAll('.play-button').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const audioUrl = e.target.getAttribute('data-song-url');
      playAudioPreview(audioUrl);
    });
  });
  
  // Add close button handler
  document.querySelector('.close-button').addEventListener('click', closeModal);
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href');
    
    // Update active link
    document.querySelectorAll('.nav-link').forEach(navLink => {
      navLink.classList.remove('active');
    });
    link.classList.add('active');
    
    // Show target section
    document.querySelectorAll('.section').forEach(section => {
      section.classList.remove('active');
    });
    document.querySelector(targetId).classList.add('active');
  });
});

// Initialize first section
document.querySelector('.nav-link').classList.add('active');
document.querySelector('.section').classList.add('active');
