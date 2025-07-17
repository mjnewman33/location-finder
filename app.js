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
    backgroundImage: 'https://lh3.googleusercontent.com/d/1olAGhmPRmlcetHxPZu6HQkD2Cg877XGe'
  }
};

// Application state
let appState = {
  isOnline: navigator.onLine,
  isLoading: false,
  appConfig: null, // Will be populated from API
  user: {
    email: null,
    accessToken: null,
    isAuthorized: null // null = not checked, true/false = checked
  },
  search: {
    autocompleteData: [], // Will store Site IDs and Facility Codes
    version: 0,            // Current version of autocomplete data
    isDropdownVisible: false
  }
};

// Initialize the app when the document is fully loaded
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize UI elements (these run regardless of access as they set up basic components)
    initializeUI();

    // Force CSS refresh if service worker is available
    refreshCSS();

    // Load images directly (don't wait for API for these initial visuals)
    loadImagesDirectly();

    // THIS IS THE CRUCIAL GATEKEEPER.
    // The app will wait for validateUserAccess to determine if main features should load.
    const hasAccess = await validateUserAccess();

    // Only proceed with full app initialization if validateUserAccess returns true (access granted).
    if (hasAccess) {
        // Load configuration from API (requires authorized access)
        loadAppConfiguration();

        // Set up online/offline detection (monitors connectivity for an authorized user)
        setupConnectivityDetection();

        // Load autocomplete data (requires authorized access)
        loadAutocompleteData();
    } else {
        // If hasAccess is NOT granted (because validateUserAccess returned false),
        // validateUserAccess has already handled displaying either the
        // registration form or the access denied message.
        // The main content of the app will remain hidden.
        console.log('Access not granted. Main app features (search, config, autocomplete) not loaded.');
    }
});

/**
 * Force refresh of CSS by adding timestamp parameter
 */
function refreshCSS() {
  const styleSheets = document.querySelectorAll('link[rel="stylesheet"]');
  if (styleSheets.length > 0) {
    styleSheets.forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('v', Date.now());
      link.href = url.toString();
    });
    console.log('CSS refreshed with timestamp parameter');
  }
}

// Variable to store the deferred prompt event
let deferredPrompt;

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('beforeinstallprompt event fired');
  
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  
  // Show the install button
  const installContainer = document.getElementById('installContainer');
  if (installContainer) {
    installContainer.classList.remove('hidden');
  }
});

// Initialize install button functionality
function initializeInstallButton() {
  const installButton = document.getElementById('installButton');
  
  if (installButton) {
    installButton.addEventListener('click', async () => {
      console.log('Install button clicked');
      
      // Hide the install button
      const installContainer = document.getElementById('installContainer');
      if (installContainer) {
        installContainer.classList.add('hidden');
      }
      
      // Show the install prompt
      if (deferredPrompt) {
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);
        
      
        deferredPrompt = null;
      } else {
        console.log('No deferred prompt available');
      }
    });
  }
}

/**
 * Check if the app is running in standalone/installed mode
 * @returns {boolean} True if the app is installed, false otherwise
 */
function isAppInstalled() {
  // Check if running in standalone mode (installed)
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      (window.navigator.standalone === true)) { // iOS Safari
    return true;
  }
  return false;
}

/**
 * Initialize the Install App link and modal functionality
 */
function initializeInstallLink() {
  const installLink = document.getElementById('installLink');
  const installModal = document.getElementById('installModal');
  const closeInstallModal = document.getElementById('closeInstallModal');
  
  // Only show the install link if the app is not installed
  if (installLink) {
    if (!isAppInstalled()) {
      installLink.classList.remove('hidden');
      
      // Add click event listener to show the install modal
      installLink.addEventListener('click', function(e) {
        e.preventDefault();
        if (installModal) {
          installModal.style.display = 'flex';
        }
      });
    } else {
      installLink.classList.add('hidden');
    }
  }
  
  // Add close button functionality to the install modal
  if (closeInstallModal) {
    closeInstallModal.addEventListener('click', function() {
      if (installModal) {
        installModal.style.display = 'none';
      }
    });
  }
  
  // Close modal when clicking outside of it
  if (installModal) {
    window.addEventListener('click', function(e) {
      if (e.target === installModal) {
        installModal.style.display = 'none';
      }
    });
  }
  
  // Listen for display mode changes (in case the user installs the app without refreshing)
  window.matchMedia('(display-mode: standalone)').addEventListener('change', function(e) {
    if (e.matches && installLink) {
      installLink.classList.add('hidden');
    }
  });
}

/**
 * Register email with retry mechanism to handle race conditions
 * @param {string} email - User's email address
 * @param {string} deviceType - User's device type
 * @returns {Promise<Object>} - Registration result
 */
async function registerEmailWithRetry(email, deviceType) {
  let attempts = 0;
  const maxAttempts = 2;
  let delay = 3000; // Initial delay of 3 seconds
  
  while (attempts < maxAttempts) {
    try {
      // Send registration to API with device type
      const response = await fetch(`${CONFIG.apiUrl}?action=registerEmail&email=${encodeURIComponent(email)}&deviceType=${encodeURIComponent(deviceType)}`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        throw new Error('Registration failed. Please try again later.');
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Check if the registration was verified
      if (result.verified === false) {
        attempts++;
        
        if (attempts >= maxAttempts) {
          console.warn('Registration could not be verified after multiple attempts');
          throw new Error('Your registration could not be confirmed. Please try again.');
        }
        
        console.log(`Verification failed, retrying in ${delay/1000} seconds... (Attempt ${attempts} of ${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Success - return the result
      return result;
      
    } catch (error) {
      if (error.message.includes('could not be confirmed') && attempts < maxAttempts - 1) {
        attempts++;
        console.log(`Registration error, retrying in ${delay/1000} seconds... (Attempt ${attempts} of ${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}
  // Check if user is already registered
  const savedUserData = loadUserData();
  if (savedUserData && savedUserData.email) {
    appState.user = savedUserData;
    
    // Hide registration form if user is already registered
    const emailContainer = document.getElementById('emailRegistrationContainer');
    if (emailContainer) {
      emailContainer.style.display = 'none';
    }
  }

/**
 * Display registration status message
 */
function showRegistrationMessage(message, type) {
  const messageDiv = document.getElementById('registrationMessage');
  if (messageDiv) {
    messageDiv.textContent = message;
    messageDiv.classList.remove('hidden', 'success', 'error');
    messageDiv.classList.add(type);
    
    // If registration was successful, show the help modal with donation info
    if (type === 'success') {
      setTimeout(() => {
        messageDiv.classList.add('hidden');
        
        // Show help modal with donation info and navigation hint
        const helpModal = document.getElementById('helpModal');
        if (helpModal) {
          // Show the post-registration navigation hint
          const navigationHint = document.getElementById('postRegistrationHint');
          if (navigationHint) {
            navigationHint.classList.remove('hidden');
          }
          
          helpModal.style.display = 'flex';
          
          // Track that this is a post-registration modal opening
          helpModal.dataset.openedAfterRegistration = 'true';
        }
      }, 3000);
    }
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Detect user's device type
 * @returns {string} The detected device type
 */
function detectDeviceType() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Detect mobile devices
  if (/android/i.test(userAgent)) {
    return "Android";
  }
  
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return "iOS";
  }
  
  // Detect specific browsers on desktop
  if (/Chrome/.test(userAgent) && /Google Inc/.test(navigator.vendor)) {
    return "Desktop - Chrome";
  }
  
  if (/Firefox/.test(userAgent)) {
    return "Desktop - Firefox";
  }
  
  if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
    return "Desktop - Safari";
  }
  
  if (/Edg/.test(userAgent)) {
    return "Desktop - Edge";
  }
  
  if (/Trident/.test(userAgent) || /MSIE/.test(userAgent)) {
    return "Desktop - Internet Explorer";
  }
  
  // Fallback for other desktop browsers
  return "Desktop - Other";
}

/**
 * Save user data to localStorage
 */
function saveUserData() {
  localStorage.setItem('krogerFinderUser', JSON.stringify(appState.user));
}

/**
 * Load user data from localStorage
 */
function loadUserData() {
  const userData = localStorage.getItem('krogerFinderUser');
  return userData ? JSON.parse(userData) : null;
}

/**
 * Save autocomplete data to localStorage
 */
function saveAutocompleteData() {
  localStorage.setItem('krogerFinderAutocomplete', JSON.stringify({
    items: appState.search.autocompleteData,
    version: appState.search.version
  }));
}

/**
 * Load autocomplete data from localStorage
 * @returns {boolean} Whether valid data was loaded
 */
function loadAutocompleteDataFromStorage() {
  try {
    const storedData = localStorage.getItem('krogerFinderAutocomplete');
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (parsedData && Array.isArray(parsedData.items) && parsedData.version) {
        appState.search.autocompleteData = parsedData.items;
        appState.search.version = parsedData.version;
        console.log(`Loaded autocomplete data from storage: ${parsedData.items.length} items, version ${parsedData.version}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error loading autocomplete data from storage:', error);
    return false;
  }
}

/**
 * Check if user has access to the application
 * This is called when the app starts
 * @returns {Promise<boolean>} True if access is granted, false otherwise.
 * If false, the relevant form/message (registration/denied) is shown.
 */
async function validateUserAccess() {
    const emailContainer = document.getElementById('emailRegistrationContainer');
    const mainContainer = document.getElementById('main-container'); // Fixed: was 'main-content'
    const accessDeniedContainer = document.getElementById('accessDeniedContainer');

    // --- Step 1: Hide all main app sections initially ---
    // We will then show only the appropriate section based on access status.
    if (mainContainer) mainContainer.style.display = 'none';
    if (emailContainer) emailContainer.style.display = 'none';
    if (accessDeniedContainer) accessDeniedContainer.style.display = 'none';

    // Load any existing user data from localStorage
    const savedUserData = loadUserData();
    if (savedUserData) {
        appState.user = savedUserData;
    }

    // --- Step 2: Check for existing local user data ---
    // If no user data is stored locally, it means they are new or cleared data.
    // In this new model, we will *force* them to register.
            if (!appState.user || !appState.user.email || !appState.user.accessToken) {
        console.log('No stored user data. Forcing registration.');
        if (emailContainer) {
            emailContainer.style.display = 'block'; // Show registration form
            emailContainer.classList.remove('hidden'); // Remove hidden class if present
        }
        return false; // Deny access to main content until registered
    }

    // --- Step 3: Check online status for *registered* users ---
    // If a user is registered but offline, allow them to use the app
    // based on their cached (assumed valid) credentials.
    if (!navigator.onLine) {
        console.log('Offline. Allowing access for registered user based on cached data.');
        if (mainContainer) mainContainer.style.display = 'block'; // Show main content
        return true; // Grant access
    }

    // --- Step 4: Online validation for *registered* users ---
    // If user is online and has stored data, validate with the backend.
    try {
        console.log('Online. Validating access with backend...');
        const response = await fetch(`${CONFIG.apiUrl}?action=validateAccess&email=${encodeURIComponent(appState.user.email)}&token=${encodeURIComponent(appState.user.accessToken)}`);

        if (!response.ok) {
            // Network error or non-200 HTTP status from API
            console.warn('Backend validation failed (network error or non-OK status). Forcing re-registration.');
            appState.user = { email: null, accessToken: null, isAuthorized: null }; // Clear invalid local data
            saveUserData();
            if (emailContainer) {
                emailContainer.style.display = 'block'; // Show registration form
                emailContainer.classList.remove('hidden'); // Remove hidden class if present
            }
            return false; // Deny access
        }

        const result = await response.json();

        if (result.error) {
            console.error('API returned an error during validation:', result.error);
            appState.user = { email: null, accessToken: null, isAuthorized: null }; // Clear invalid local data
            saveUserData();
            if (emailContainer) {
                emailContainer.style.display = 'block'; // Show registration form
                emailContainer.classList.remove('hidden'); // Remove hidden class if present
            }
            return false; // Deny access
        }

        // --- Step 5: Process backend validation result ---
        // If email not found in backend (e.g., deleted from sheet)
        if (result.validEmail === false) {
            console.log('Registered email not found in backend database. Forcing re-registration.');
            appState.user = { email: null, accessToken: null, isAuthorized: null }; // Clear invalid local data
            saveUserData();
            if (emailContainer) {
                emailContainer.style.display = 'block'; // Show registration form
                emailContainer.classList.remove('hidden'); // Remove hidden class if present
            }
            return false; // Deny access
        }

        // Update appState with the authorization status from backend
        appState.user.isAuthorized = result.hasAccess === true;
        saveUserData(); // Persist the updated authorization status

        // If backend explicitly denied access (email found, but token/status incorrect)
        if (!appState.user.isAuthorized) {
            console.log('Backend denied access (email valid, but token/status incorrect). Showing access denied message.');
            showAccessDenied(); // This function will display accessDeniedContainer
            return false; // Deny access
        }

        // If we reached here, access is granted and validated online
        console.log('Access validated and granted.');
        if (mainContainer) mainContainer.style.display = 'block'; // Show main app content
        return true; // Grant access

    } catch (error) {
        console.error('Unexpected error during access validation:', error);
        // Catch any uncaught network issues or parsing errors
        appState.user = { email: null, accessToken: null, isAuthorized: null }; // Clear local data
        saveUserData();
        if (emailContainer) {
            emailContainer.style.display = 'block'; // Show registration form
            emailContainer.classList.remove('hidden'); // Remove hidden class if present
        }
        return false; // Deny access
    }
}

/**
 * Displays the access denied message and hides other main content.
 * This version uses the pre-existing #accessDeniedContainer from HTML.
 */
function showAccessDenied() {
    const mainContainer = document.getElementById('main-container'); // Fixed: was 'main-content'
    const accessDeniedContainer = document.getElementById('accessDeniedContainer');
    const emailRegistrationContainer = document.getElementById('emailRegistrationContainer');

    // Hide other primary sections
    if (mainContainer) mainContainer.style.display = 'none';
    if (emailRegistrationContainer) emailRegistrationContainer.style.display = 'none';

    // Show the access denied container
    if (accessDeniedContainer) {
        accessDeniedContainer.classList.remove('hidden'); // Ensure it's not hidden by the 'hidden' class
        accessDeniedContainer.style.display = 'block'; // Ensure it's displayed (in case CSS display:none was used)

        // Attach event listener to the re-register button within this container
        const reregisterButton = document.getElementById('reregisterButton');
        if (reregisterButton) {
            reregisterButton.onclick = function() {
                // Clear user data to force a fresh registration attempt
                appState.user = {
                    email: null,
                    accessToken: null,
                    isAuthorized: null
                };
                saveUserData();
                window.location.reload(); // Reload the page to restart the access flow
            };
        }
    }
}

/**
 * Modified email registration to show main content after successful registration
 */
function initializeEmailRegistration() {
  const emailForm = document.getElementById('emailRegistrationForm');
  const messageDiv = document.getElementById('registrationMessage');
  
  if (emailForm) {
    emailForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const emailInput = document.getElementById('emailInput');
      const email = emailInput.value.trim();
      
      // Basic validation
      if (!email || !isValidEmail(email)) {
        showRegistrationMessage('Please enter a valid email address', 'error');
        return;
      }
      
      // Disable form while processing
      const registerButton = document.getElementById('registerButton');
      registerButton.disabled = true;
      registerButton.textContent = 'Registering...';
      
      try {
        // Check if we're online
        if (!navigator.onLine) {
          throw new Error('You are currently offline. Please try again when connected.');
        }
        
        // Get device type
        const deviceType = detectDeviceType();

        // Use the retry mechanism for registration
        const result = await registerEmailWithRetry(email, deviceType);
        
        // Success - store user data
        appState.user.email = email;
        appState.user.accessToken = result.accessToken;
        appState.user.isAuthorized = true;
        
        // Save user data to localStorage
        saveUserData();
        
        // Show success message
        showRegistrationMessage('Registration successful! Loading application...', 'success');
        emailInput.value = '';
        
        // Hide registration form and show main content after successful registration
        setTimeout(() => {
          const emailContainer = document.getElementById('emailRegistrationContainer');
          const mainContainer = document.getElementById('main-container');
          
          if (emailContainer) {
            emailContainer.style.display = 'none';
          }
          if (mainContainer) {
            mainContainer.style.display = 'block';
          }
          
          // Now that user is registered and main content is shown, load the app features
          loadAppConfiguration();
          setupConnectivityDetection();
          loadAutocompleteData();
          
        }, 2000);
        
      } catch (error) {
        console.error('Registration error:', error);
        showRegistrationMessage(error.message || 'Registration failed. Please try again.', 'error');
      } finally {
        // Re-enable form
        registerButton.disabled = false;
        registerButton.textContent = 'Register';
      }
    });
  }
}
// Listen for the appinstalled event
window.addEventListener('appinstalled', (e) => {
  console.log('App was installed successfully');
  
  // Hide the install button if it's still visible
  const installContainer = document.getElementById('installContainer');
  if (installContainer) {
    installContainer.classList.add('hidden');
  }
  
  // Hide the install link if it's still visible
  const installLink = document.getElementById('installLink');
  if (installLink) {
    installLink.classList.add('hidden');
  }
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
  
  // Initialize autocomplete
  initializeAutocomplete();
  
  // Help modal functionality
  helpLink.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Hide the navigation hint for normal help modal openings
    const navigationHint = document.getElementById('postRegistrationHint');
    if (navigationHint) {
      navigationHint.classList.add('hidden');
    }
    
    // Reset the post-registration flag
    helpModal.dataset.openedAfterRegistration = 'false';
    
    helpModal.style.display = 'flex';
  });

  closeModal.addEventListener('click', function() {
    helpModal.style.display = 'none';
    
    // If this was opened after registration, we're done with that special state
    helpModal.dataset.openedAfterRegistration = 'false';
    
    // Hide the navigation hint when closing
    const navigationHint = document.getElementById('postRegistrationHint');
    if (navigationHint) {
      navigationHint.classList.add('hidden');
    }
  });

  // Close modal when clicking outside of it
  window.addEventListener('click', function(e) {
    if (e.target === helpModal) {
      helpModal.style.display = 'none';
      
      // Reset post-registration state
      helpModal.dataset.openedAfterRegistration = 'false';
      
      // Hide the navigation hint when closing
      const navigationHint = document.getElementById('postRegistrationHint');
      if (navigationHint) {
        navigationHint.classList.add('hidden');
      }
    }
  });

  // Initialize install button
  initializeInstallButton();
  
  // Initialize install link and modal
  initializeInstallLink();

  // Initialize email registration
  initializeEmailRegistration();
}

/**
 * Initialize autocomplete functionality for search input
 */
function initializeAutocomplete() {
  const searchInput = document.getElementById('searchInput');
  const searchContainer = document.getElementById('searchContainer');
  
  if (!searchInput || !searchContainer) return;
  
  // Create autocomplete dropdown if it doesn't exist
  let autocompleteDropdown = document.getElementById('autocompleteDropdown');
  if (!autocompleteDropdown) {
    autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.id = 'autocompleteDropdown';
    autocompleteDropdown.className = 'autocomplete-dropdown';
    searchContainer.appendChild(autocompleteDropdown);
  }
  
  // Add input event for real-time filtering
  searchInput.addEventListener('input', function() {
    const query = this.value.trim().toLowerCase();
    
    // Hide dropdown if input is empty
    if (!query) {
      hideAutocompleteDropdown();
      return;
    }
    
    // Filter autocomplete items
    const filteredItems = filterAutocompleteItems(query);
    
    // Update and show dropdown
    updateAutocompleteDropdown(filteredItems, query);
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (e.target !== searchInput && e.target !== autocompleteDropdown) {
      hideAutocompleteDropdown();
    }
  });
  
  // Focus event to show dropdown
  searchInput.addEventListener('focus', function() {
    const query = this.value.trim().toLowerCase();
    if (query) {
      const filteredItems = filterAutocompleteItems(query);
      updateAutocompleteDropdown(filteredItems, query);
    }
  });
  
  // Keyboard navigation
  searchInput.addEventListener('keydown', function(e) {
    if (!appState.search.isDropdownVisible) return;
    
    const dropdown = document.getElementById('autocompleteDropdown');
    const items = dropdown.getElementsByTagName('div');
    const activeItem = dropdown.querySelector('.active');
    
    // Down arrow
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!activeItem) {
        if (items.length > 0) items[0].classList.add('active');
      } else {
        const index = Array.from(items).indexOf(activeItem);
        if (index < items.length - 1) {
          activeItem.classList.remove('active');
          items[index + 1].classList.add('active');
        }
      }
    }
    
    // Up arrow
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeItem) {
        const index = Array.from(items).indexOf(activeItem);
        if (index > 0) {
          activeItem.classList.remove('active');
          items[index - 1].classList.add('active');
        }
      }
    }
    
    // Enter to select
    else if (e.key === 'Enter' && activeItem) {
      e.preventDefault();
      searchInput.value = activeItem.textContent;
      hideAutocompleteDropdown();
      handleSearch();
    }
    
    // Escape to close
    else if (e.key === 'Escape') {
      hideAutocompleteDropdown();
    }
  });
}

/**
 * Filter autocomplete items based on query
 * @param {string} query - The search query
 * @returns {Array} - Filtered list of matching items
 */
function filterAutocompleteItems(query) {
  if (!appState.search.autocompleteData || !appState.search.autocompleteData.length) {
    return [];
  }
  
  // Convert query to lowercase for case-insensitive matching
  const lowerQuery = query.toLowerCase();
  
  // Strip leading zeros from the search query to match data that lost leading zeros
  const queryWithoutLeadingZeros = query.replace(/^0+/, '');
  const lowerQueryNoZeros = queryWithoutLeadingZeros.toLowerCase();
  
  // Filter items that start with the query (try both versions)
  const exactMatches = appState.search.autocompleteData.filter(item => {
    const lowerItem = item.toLowerCase();
    return lowerItem.startsWith(lowerQuery) || 
           (queryWithoutLeadingZeros && lowerItem.startsWith(lowerQueryNoZeros));
  });
  
  // Filter items that contain the query but don't start with it
  const partialMatches = appState.search.autocompleteData.filter(item => {
    const lowerItem = item.toLowerCase();
    const includesOriginal = lowerItem.includes(lowerQuery);
    const includesNoZeros = queryWithoutLeadingZeros && lowerItem.includes(lowerQueryNoZeros);
    const startsWithOriginal = lowerItem.startsWith(lowerQuery);
    const startsWithNoZeros = queryWithoutLeadingZeros && lowerItem.startsWith(lowerQueryNoZeros);
    
    return (includesOriginal || includesNoZeros) && !startsWithOriginal && !startsWithNoZeros;
  });
  
  // Combine exact matches first (they're more relevant), then partial matches
  // Limit to 10 items for performance
  return [...exactMatches, ...partialMatches].slice(0, 10);
}

function updateAutocompleteDropdown(items, query) {
  const dropdown = document.getElementById('autocompleteDropdown');
  
  // Clear previous items
  dropdown.innerHTML = '';
  
  if (items.length === 0) {
    hideAutocompleteDropdown();
    return;
  }
  
  // Add each item to dropdown
  items.forEach(item => {
    const div = document.createElement('div');
    div.textContent = item;
    div.className = 'autocomplete-item';
    
    // Highlight the matching part
    if (query) {
      const lowerItem = item.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const index = lowerItem.indexOf(lowerQuery);
      
      if (index !== -1) {
        const beforeMatch = item.substring(0, index);
        const match = item.substring(index, index + query.length);
        const afterMatch = item.substring(index + query.length);
        
        div.innerHTML = `${beforeMatch}<strong>${match}</strong>${afterMatch}`;
      }
    }
    
    // Add click handler
    div.addEventListener('click', function() {
      document.getElementById('searchInput').value = item;
      hideAutocompleteDropdown();
      handleSearch();
    });
    
    dropdown.appendChild(div);
  });
  
  // Show dropdown
  dropdown.style.display = 'block';
  appState.search.isDropdownVisible = true;
}

/**
 * Hide the autocomplete dropdown
 */
function hideAutocompleteDropdown() {
  const dropdown = document.getElementById('autocompleteDropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
    appState.search.isDropdownVisible = false;
  }
}

/**
 * Load autocomplete data from API or localStorage
 */
async function loadAutocompleteData() {
  // Try to load from localStorage first
  const loadedFromStorage = loadAutocompleteDataFromStorage();
  
  // If offline, use cached data only
  if (!navigator.onLine) {
    console.log('Offline: Using cached autocomplete data only');
    return;
  }
  
  try {
    // Fetch fresh data from API
    console.log('Fetching autocomplete data from API');
    const response = await fetch(`${CONFIG.apiUrl}?action=getAutocompleteData`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch autocomplete data');
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Check if we got valid data
    if (Array.isArray(result.items) && result.version) {
      // Check if we need to update
      if (!loadedFromStorage || result.version != appState.search.version) {
        console.log(`Updating autocomplete data from version ${appState.search.version} to ${result.version}`);
        
        // Update app state
        appState.search.autocompleteData = result.items;
        appState.search.version = result.version;
        
        // Save to localStorage
        saveAutocompleteData();
      } else {
        console.log('Autocomplete data is already up to date');
      }
    }
  } catch (error) {
    console.error('Error loading autocomplete data:', error);
    
    // If we don't have any data, show an error
    if (!loadedFromStorage && (!appState.search.autocompleteData || appState.search.autocompleteData.length === 0)) {
      console.warn('No autocomplete data available');
    }
  }
}

/**
 * Check if autocomplete data needs updating
 * @param {number} serverVersion - The server's current version
 */
function checkAndUpdateAutocompleteData(serverVersion) {
  if (serverVersion && serverVersion != appState.search.version) {
    console.log(`Autocomplete data needs update: client ${appState.search.version}, server ${serverVersion}`);
    
    // Fetch fresh data in the background
    loadAutocompleteData();
  }
}

/**
 * Load application configuration from the API
 */
async function loadAppConfiguration() {
  try {
    // Fetch configuration from API
    const response = await fetch(`${CONFIG.apiUrl}?action=getConfig`);
    
    if (!response.ok) {
      throw new Error('Failed to load configuration');
    }
    
    const config = await response.json();
    appState.appConfig = config;
    
    // Apply configuration to UI
    applyConfiguration(config);
    
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
      // Use main-container instead of backgroundImage
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
    headerLogo.src = CONFIG.images.headerLogo;
    console.log("Set header logo to fallback:", CONFIG.images.headerLogo);
  }
  
  const companyLogo = document.getElementById('companyLogo');
  if (companyLogo) {
    companyLogo.src = CONFIG.images.companyLogo;
    console.log("Set company logo to fallback:", CONFIG.images.companyLogo);
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
  const wasOffline = !appState.isOnline;
  appState.isOnline = navigator.onLine;
  updateOnlineStatus();
  
  // If coming back online after being offline, refresh CSS and reload config
  if (appState.isOnline && wasOffline) {
    console.log('Coming back online - refreshing CSS');
    refreshCSS();
    
    // Also reload app configuration
    if (!appState.appConfig) {
      loadAppConfiguration();
    }
    
    // Reload autocomplete data if we're online again
    loadAutocompleteData();
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
    // Make API request with version parameter
    const response = await fetch(`${CONFIG.apiUrl}?action=searchLocation&query=${encodeURIComponent(query)}&version=${appState.search.version}`);
    
    if (!response.ok) {
      throw new Error('API request failed');
    }
    
    const result = await response.json();
    
    // Check if we need to update autocomplete data
    if (result.version && result.needsUpdate) {
      checkAndUpdateAutocompleteData(result.version);
    }
    
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
        <div class="info-value"><a href="tel:${result.phone.replace(/[^0-9]/g, '')}">${result.phone}</a></div>
      </div>
      <button onclick="getDirections('${result.street.replace(/'/g, "\\'")} ${result.city.replace(/'/g, "\\'")} ${result.state} ${result.zip}')" class="directions-button">Get Directions</button>
    `;
    
    // Clear the search input
    document.getElementById('searchInput').value = '';
    
    // Hide the autocomplete dropdown
    hideAutocompleteDropdown();
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
  document.getElementById('resultArea').classList.add('hidden');
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
  // Desktop browsers - always use Google Maps web URL
  else {
    // window.open with _blank works in all desktop browsers
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }
}
