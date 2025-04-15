const clientId = '43f735a675d04dc593023010c69937f3';
const redirectUri = 'https://fadilbinjabi.github.io/Pied-Piper/main.html';
const scopes = 'user-top-read playlist-read-private playlist-modify-private playlist-modify-public streaming user-read-playback-state user-modify-playback-state user-read-email user-read-private';

function loginWithSpotify() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}


const hash = window.location.hash.substring(1);
const params = new URLSearchParams(hash);
const accessToken = params.get('access_token');

fetch('https://api.spotify.com/v1/me',{
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
.then((response) => response.json())
.then((userData) => {
  const userIconUrl = userData.images[0].url;
  const userIconContainer = document.querySelector('.user-icon-container');
  const userIconImg = userIconContainer.querySelector('img');
  userIconImg.src = userIconUrl;
  userId = userData.id;
})
.catch((error) => {
  console.error('Error fetching user icon:', error);
});

let userId;

fetch('https://api.spotify.com/v1/me', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
.then((response) => response.json())
.then((userData) => {
  console.log('User ID:', userData.id); // store the user ID in a variable
});


fetch(`https://api.spotify.com/v1/me/playlists`, {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
.then((response) => response.json())
.then((data) => {
  const playlistsList = document.getElementById('user-playlists');
  playlistsList.innerHTML = data.items
    .map(
      (playlist) => `
      <li data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}">
        <img src="${playlist.images?.[0]?.url || 'default.jpg'}" alt="${playlist.name}" />
        <span title="${playlist.name}">${playlist.name}</span>
      </li>
    `
    )
    .join('');

  // Add click handlers to playlists
  document.querySelectorAll('#user-playlists li').forEach(item => {
    item.addEventListener('click', (event) => {
      const playlistId = event.currentTarget.getAttribute('data-playlist-id');
      const playlistName = event.currentTarget.getAttribute('data-playlist-name');
      showPlaylistTracks(playlistId, playlistName);
    });
  });
})
.catch(error => console.error('Error fetching playlists:', error));

// Modal close function
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

// Close modal when clicking outside or on close button
document.addEventListener('click', (event) => {
  if (event.target === document.getElementById('modal')) {
    closeModal();
  }
});



// Fetch and display top artists
fetch('https://api.spotify.com/v1/me/top/artists?limit=50', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
  .then((response) => response.json())
  .then((data) => {
    const topArtistsList = document.getElementById('top-artists');
    window.fullArtistsList = data.items;

    topArtistsList.innerHTML = data.items
      .slice(0, 3)
      .map(
        (artist) => `
        <li>
          <img src="${artist.images[0]?.url || 'default.jpg'}" alt="${artist.name}" class="artist-image" />
          <span>${artist.name}</span>
        </li>
      `
      )
      .join('');
  })
  .catch((error) => {
    console.error('Error fetching top artists:', error);
    document.getElementById('top-artists').innerHTML = '<li>Failed to load data</li>';
  });

// Fetch and display top songs
fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
  .then((response) => response.json())
  .then((data) => {
    const topSongsList = document.getElementById('top-songs');
    window.fullSongsList = data.items;

    topSongsList.innerHTML = data.items
      .slice(0, 3)
      .map(
        (track) => `
        <li>
          <img src="${track.album.images[0]?.url || 'default.jpg'}" alt="${track.name}" class="song-image" />
          <span>${track.name} by ${track.artists.map((artist) => artist.name).join(', ')}</span>
        </li>
      `
      )
      .join('');
  })
  .catch((error) => {
    console.error('Error fetching top songs:', error);
    document.getElementById('top-songs').innerHTML = '<li>Failed to load data</li>';
  });

// Fetch user's listening history summary
fetch('https://api.spotify.com/v1/me/top/tracks?limit=50', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
  .then((response) => response.json())
  .then((data) => {
    const totalTracks = data.items.length;
    const favoriteArtist = data.items[0]?.artists[0]?.name || 'Unknown Artist';

    document.getElementById('listening-summary').innerHTML = `
      Total Tracks Played: ${totalTracks}<br>
      Favorite Artist: ${favoriteArtist}
    `;
  })
  .catch((error) => {
    console.error('Error fetching listening history summary:', error);
    document.getElementById('listening-summary').innerHTML = 'Failed to load listening history.';
  });

// Fetch user's top genres
fetch('https://api.spotify.com/v1/me/top/artists?limit=10', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})
  .then((response) => response.json())
  .then((data) => {
    const genres = {};
    data.items.forEach((artist) => {
      artist.genres.forEach((genre) => {
        genres[genre] = (genres[genre] || 0) + 1;
      });
    });

    const sortedGenres = Object.entries(genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topGenresList = document.getElementById('top-genres');
    topGenresList.innerHTML = sortedGenres
      .map(([genre]) => `<li>${genre}</li>`)
      .join('');
  })
  .catch((error) => {
    console.error('Error fetching top genres:', error);
    document.getElementById('top-genres').innerHTML = '<li>Failed to load genres</li>';
  });



// Mock data for active time chart       NOT REAL DATA
const mockData = {
  labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  datasets: [{
    label: 'Active Time (hours)',
    data: [2, 3, 1.5, 4, 2.5, 3.5, 1],
    backgroundColor: [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#1DB954'
    ],
    borderColor: [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#1DB954'
    ],
    borderWidth: 1,
  }],
};

// Chart functionality
let chartInstance;
function renderChart(chartType = 'bar') {
  const ctx = document.getElementById('mock-data-chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: chartType,
    data: mockData,
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: 'white'
          }
        }
      },
      fontColor: 'white',
      scales: {
        x: {
          display: chartType !== 'pie' && chartType !== 'doughnut',
          ticks: {
            color: 'white'
          },
          title: {
            display: chartType !== 'pie' && chartType !== 'doughnut',
            color: 'white'
          }
        },
        y: {
          display: chartType !== 'pie' && chartType !== 'doughnut',
          beginAtZero: true,
          ticks: {
            color: 'white'
          },
          title: {
            display: chartType !== 'pie' && chartType !== 'doughnut',
            color: 'white'
          }
        }
      }
    },
  });
}
document.getElementById('chart-type-selector').addEventListener('change', (event) => {
  renderChart(event.target.value);
});
renderChart();

// Modal functionality
function viewFullList(type, list) {
  const fullListHtml = list
    .map((item) => {
      let itemHtml = '';
      if (type === 'artists' || type === 'songs') {
        itemHtml = `
          <li>
            <img src="${item.images ? item.images[0]?.url : item.album.images[0]?.url || 'default.jpg'}" 
                 alt="${item.name}" class="song-image" />
            <span class="song-info">${item.name} ${item.artists ? `by ${item.artists.map((artist) => artist.name).join(', ')}` : ''}</span>
            <button class="play-button" data-song-url="${item.preview_url}">Play</button>
          </li>
        `;
      } 
      return itemHtml;
    })
    .join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      <h3>Your ${type === 'artists' ? 'Top Artists' : type === 'songs' ? 'Top Songs' : ''}</h3>
      <button id="modal-close-button" class="close-button">Close</button>
    </div>
    <ul class="full-list">${fullListHtml}</ul>
  `;
  document.getElementById('modal').style.display = 'flex';
  
  // Add event listener to close modal when clicking outside
  document.addEventListener('click', (event) => {
    if (event.target === document.getElementById('modal')) {
      closeModal();
    }
  });
  
  // Add event listener to close modal when clicking close button
  document.getElementById('modal-close-button').addEventListener('click', () => {
    closeModal();
  });
}





function showPlaylistTracks(playlistId, playlistName) {
  fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
  .then(response => response.json())
  .then(data => {
    const tracks = data.items.map(item => item.track);
    
    const tracksHtml = tracks.map(track => `
      <li>
        <img src="${track.album.images[0]?.url || 'default.jpg'}" 
             alt="${track.name}" class="track-image" />
        <span class="track-info">
          ${track.name} by ${track.artists.map(artist => artist.name).join(', ')}
        </span>
        ${track.preview_url ? 
          `<button class="play-button" data-song-url="${track.preview_url}">Play</button>` : 
          ''}
      </li> 
    `).join('');

    document.getElementById('modal-content').innerHTML = `
      <div class="modal-header">
        <h3>${playlistName}</h3>
        <button id="modal-close-button" class="close-button">Close</button>
      </div>
      <ul class="playlist-tracks">${tracksHtml}</ul>
    `;
    
    document.getElementById('modal').style.display = 'flex';
    
    // Add event listeners for play buttons
    document.querySelectorAll('.play-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const audioUrl = e.target.getAttribute('data-song-url');
        // Implement your audio playback logic here
        console.log('Play:', audioUrl);
      });
    });
  })
  .catch(error => console.error('Error fetching playlist tracks:', error));
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
}
// Function to save a playlist
function savePlaylist() {
  const playlistName = prompt("Enter playlist name:");
  if (!playlistName) return;

  // Get selected tracks (you'll need to implement this based on your UI)
  const selectedTracks = getSelectedTracks(); // You need to implement this
  
  createPlaylist(playlistName, "My saved playlist", false)
    .then(playlist => {
      // Add tracks to the new playlist
      return addTracksToPlaylist(playlist.id, selectedTracks);
    })
    .then(() => {
      alert("Playlist saved successfully!");
      fetchUserPlaylists(); // Refresh the playlist list
    })
    .catch(error => {
      console.error("Error saving playlist:", error);
      alert("Failed to save playlist");
    });
}

// Function to add tracks to a playlist
function addTracksToPlaylist(playlistId, trackUris) {
  return fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: trackUris
    })
  })
  .then(response => response.json());
}

// Function to generate a special playlist
function generateSpecialPlaylist() {
  // Example: Create a playlist with top tracks
  fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })
  .then(response => response.json())
  .then(data => {
    const trackUris = data.items.map(track => track.uri);
    return createPlaylist("My Top Tracks", "Automatically generated playlist of my top tracks", true);
  })
  .then(playlist => {
    return addTracksToPlaylist(playlist.id, trackUris);
  })
  .then(() => {
    alert("Special playlist generated!");
    fetchUserPlaylists(); // Refresh the playlist list
  })
  .catch(error => {
    console.error("Error generating playlist:", error);
    alert("Failed to generate playlist");
  });
}

// Helper function to get selected tracks (you need to implement based on your UI)
function getSelectedTracks() {
  // This depends on how your UI tracks selected songs
  // Example: Get all checked checkboxes and return their data-uri values
  const selected = [];
  document.querySelectorAll('.track-checkbox:checked').forEach(checkbox => {
    selected.push(checkbox.getAttribute('data-uri'));
  });
  return selected;
}
