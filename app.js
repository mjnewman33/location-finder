/**
 * Kroger Location Finder PWA
 * Main application JavaScript
 */

// Configuration with API endpoint
const CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbxOuM-BCQqM0uBSgsSvZt7Ky2H57YOyVT0Gz3O5-tolE7e38ypBaT71GOlMvV3-qLCTDg/exec',
  // Use direct image URLs
  images: {
    headerLogo: 'https://lh3.googleusercontent.com/d/1lAI-LC-RXSJPhMyFOYok8bxYRvBit_ye',
    companyLogo: 'https://lh3.googleusercontent.com/d/1zngYUKdx-lfZ8iNiKg3DvEc_LiO1eIhk',
    backgroundImage: 'https://lh3.googleusercontent.com/d/1kD-noLuLaR0ke-jm-yl0ahzs_acoyRnx'
  },
  // Default fallback images in case API is unreachable
  fallbackImages: {
    headerLogo: 'images/kroger-logo.png',
    companyLogo: 'images/company-logo.png'
  }
};

// Application state
let appState = {
  isOnline: navigator.onLine,
  isLoading: false,
  appConfig: null // Will be populated from API
};

// Initialize the app when the document is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize UI elements
  initializeUI();
  
  // Load images directly (don't wait for API)
  loadImagesDirectly();
  
  // Load configuration from API
  loadAppConfiguration();
  
  // Set up online/offline detection
  setupConnectivityDetection();
});

/**
 * Initialize UI elements and event listeners
 */
function initializeUI() {
  // Get references to elements
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const helpLink = document.getElementById('helpLink');
  const helpModal = document.getElementById('helpModal');
  const closeModal = document.getElementById('closeModal');
  
  // Set up search event listeners
  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleSearch();
    }
  });
  
  // Help modal functionality
  helpLink.addEventListener('click', function(e) {
    e.preventDefault();
    helpModal.style.display = 'flex';
  });
  
  closeModal.addEventListener('click', function() {
    helpModal.style.display = 'none';
  });
  
  // Close modal when clicking outside of it
  window.addEventListener('click', function(e) {
    if (e.target === helpModal) {
      helpModal.style.display = 'none';
    }
  });
}

/**
 * Load application configuration from the API
 */
async function loadAppConfiguration() {
  try {
    // Show initial loading state if needed
    // document.getElementById('loading').style.display = 'block';
    
    // Fetch configuration from API
    const response = await fetch(`${CONFIG.apiUrl}?action=getConfig`);
    
    if (!response.ok) {
      throw new Error('Failed to load configuration');
    }
    
    const config = await response.json();
    appState.appConfig = config;
    
    // Apply configuration to UI
    applyConfiguration(config);
    
    // Hide loading state if needed
    // document.getElementById('loading').style.display = 'none';
  } catch (error) {
    console.error('Error loading configuration:', error);
    
    // Apply fallback configuration for critical elements
    applyFallbackConfiguration();
  }
}

/**
 * Apply configuration received from API to the UI
 */
function applyConfiguration(config) {
  console.log("Applying configuration:", config);
  
  // Set images
  if (config.images) {
    if (config.images.headerLogo) {
      const headerLogo = document.getElementById('headerLogo');
      if (headerLogo) {
        headerLogo.src = config.images.headerLogo;
        console.log("Set header logo to:", config.images.headerLogo);
      }
    }
    
    if (config.images.companyLogo) {
      const companyLogo = document.getElementById('companyLogo');
      if (companyLogo) {
        companyLogo.src = config.images.companyLogo;
        console.log("Set company logo to:", config.images.companyLogo);
      }
    }
    
    if (config.images.backgroundImage) {
      // FIXED: Use main-container instead of backgroundImage
      const container = document.getElementById('main-container');
      if (container) {
        container.style.backgroundImage = `url('${config.images.backgroundImage}')`;
        console.log("Set background image to:", config.images.backgroundImage);
      }
    }
  }
  
  // Set links
  if (config.links) {
    if (config.links.companyWebsite) {
      const companyLink = document.getElementById('companyWebsite');
      if (companyLink) {
        companyLink.href = config.links.companyWebsite;
        companyLink.target = "_blank"; // Open in new tab
        console.log("Set company website to:", config.links.companyWebsite);
      }
    }
    
    if (config.links.supportEmail) {
      const supportLink = document.getElementById('supportEmail');
      if (supportLink) {
        supportLink.href = `mailto:${config.links.supportEmail}`;
        // supportLink.textContent = config.links.supportEmail;
        console.log("Set support email to:", config.links.supportEmail);
      }
    }
  }
}

/**
 * Apply fallback configuration when API is unreachable
 */
function applyFallbackConfiguration() {
  console.log("Applying fallback configuration");
  
  // Apply fallback images with error handling
  const headerLogo = document.getElementById('headerLogo');
  if (headerLogo) {
    headerLogo.src = CONFIG.fallbackImages.headerLogo;
    console.log("Set header logo to fallback:", CONFIG.fallbackImages.headerLogo);
  }
  
  const companyLogo = document.getElementById('companyLogo');
  if (companyLogo) {
    companyLogo.src = CONFIG.fallbackImages.companyLogo;
    console.log("Set company logo to fallback:", CONFIG.fallbackImages.companyLogo);
  }
  
  // Disable features that require API if needed
  const searchBtn = document.getElementById('searchBtn');
  if (!appState.isOnline) {
    searchBtn.disabled = true;
  }
  
  // Show offline notification if needed
  updateOnlineStatus();
}

/**
 * Load images directly without waiting for API
 */
function loadImagesDirectly() {
  console.log("Loading images directly");
  
  // Set header logo
  const headerLogo = document.getElementById('headerLogo');
  if (headerLogo) {
    headerLogo.src = CONFIG.images.headerLogo;
    console.log("Directly set header logo");
  }
  
  // Set company logo
  const companyLogo = document.getElementById('companyLogo');
  if (companyLogo) {
    companyLogo.src = CONFIG.images.companyLogo;
    console.log("Directly set company logo");
  }
  
  // Set background image
  const container = document.getElementById('main-container');
  if (container) {
    container.style.backgroundImage = `url('${CONFIG.images.backgroundImage}')`;
    console.log("Directly set background image");
  }
}

/**
 * Set up detection for online/offline status
 */
function setupConnectivityDetection() {
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);
  
  // Initial check
  updateOnlineStatus();
}

/**
 * Handle changes in online/offline status
 */
function handleOnlineStatusChange() {
  appState.isOnline = navigator.onLine;
  updateOnlineStatus();
  
  // If coming back online, try to reload config
  if (appState.isOnline && !appState.appConfig) {
    loadAppConfiguration();
  }
}

/**
 * Update UI based on online status
 */
function updateOnlineStatus() {
  const offlineNotification = document.getElementById('offline-notification');
  
  if (!appState.isOnline) {
    offlineNotification.style.display = 'block';
    
    // Disable search if offline
    document.getElementById('searchBtn').disabled = true;
    document.getElementById('searchInput').disabled = true;
  } else {
    offlineNotification.style.display = 'none';
    
    // Enable search if online
    document.getElementById('searchBtn').disabled = false;
    document.getElementById('searchInput').disabled = false;
  }
}

/**
 * Handle search button click
 */
async function handleSearch() {
  // Get search query
  const searchInput = document.getElementById('searchInput');
  const query = searchInput.value.trim();
  
  // Validate input
  if (!query) {
    return;
  }
  
  // Check if online
  if (!appState.isOnline) {
    showOfflineSearchError();
    return;
  }
  
  // Update UI - show loading, hide results
  const loadingDiv = document.getElementById('loading');
  const resultArea = document.getElementById('resultArea');
  
  loadingDiv.style.display = 'block';
  resultArea.classList.add('hidden');
  appState.isLoading = true;
  
  try {
    // Make API request
    const response = await fetch(`${CONFIG.apiUrl}?action=searchLocation&query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const result = await response.json();
    
    // Handle result
    handleSearchResult(result);
  } catch (error) {
    console.error('Search error:', error);
    handleSearchError(error.message);
  } finally {
    // Update UI - hide loading
    loadingDiv.style.display = 'none';
    appState.isLoading = false;
  }
}

/**
 * Handle successful search result
 */
function handleSearchResult(result) {
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  
  if (result.error) {
    resultArea.innerHTML = `<p class="error">${result.error}</p>`;
  } else {
    resultArea.innerHTML = `
      <h2>Location Found</h2>
      <div class="location-info">
        <div class="info-label">Site:</div>
        <div class="info-value">${result.siteId}</div>
        
        <div class="info-label">Facility Code:</div>
        <div class="info-value">${result.facilityCode}</div>
        
        <div class="info-label">Address:</div>
        <div class="info-value address-block">
          <div>${result.street}</div>
          <div>${result.city}, ${result.state} ${result.zip}</div>
        </div>
        
        <div class="info-label">Phone:</div>
        <div class="info-value">${result.phone}</div>
      </div>
      <button onclick="getDirections('${result.street.replace(/'/g, "\\'")} ${result.city.replace(/'/g, "\\'")} ${result.state} ${result.zip}')" class="directions-button">Get Directions</button>
    `;
    
    // Clear the search input
    document.getElementById('searchInput').value = '';
  }
}

/**
 * Handle search error
 */
function handleSearchError(errorMessage) {
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = `<p class="error">Error: ${errorMessage}</p>`;
}

/**
 * Show error when trying to search while offline
 */
function showOfflineSearchError() {
  const resultArea = document.getElementById('resultArea');
  resultArea.classList.remove('hidden');
  resultArea.innerHTML = `
    <p class="error">You are currently offline. Please connect to the internet to search for locations.</p>
  `;
}

/**
 * Open maps app for directions across different platforms
 */
function getDirections(address) {
  const encodedAddress = encodeURIComponent(address);
  
  // Detect platform
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    window.location.href = `https://maps.apple.com/?q=${encodedAddress}`;
  } 
  // Android detection
  else if (/android/i.test(userAgent)) {
    window.location.href = `https://maps.google.com/?q=${encodedAddress}`;
  } 
  // Default fallback for all other platforms
  else {
    window.location.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  }
}
