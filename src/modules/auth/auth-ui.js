/**
 * Auth UI Module
 * Handles UI updates for authentication state
 * @module auth/auth-ui
 */

/**
 * Update authentication UI based on user state
 * @param {Object|null} user - Firebase user object
 * @param {Object|null} userData - User data from Firestore
 */
export function updateAuthUI(user, userData = null) {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  const settingsLinks = document.querySelectorAll('.settings-link');
  const studentSettingsLinks = document.querySelectorAll('.student-settings-link');
  
  const isLoggedIn = !!user;
  const isAdmin = userData && userData.role === 'admin';

  // Desktop buttons
  if (loginBtn) {
    loginBtn.style.display = isLoggedIn ? 'none' : 'block';
    if (!isLoggedIn) loginBtn.textContent = 'Login';
  }
  
  if (logoutBtn) {
    logoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) logoutBtn.textContent = 'Logout';
  }

  // Mobile buttons
  if (mobileLoginBtn) {
    mobileLoginBtn.style.display = isLoggedIn ? 'none' : 'block';
    if (!isLoggedIn) mobileLoginBtn.textContent = 'Login';
  }
  
  if (mobileLogoutBtn) {
    mobileLogoutBtn.style.display = isLoggedIn ? 'block' : 'none';
    if (isLoggedIn) mobileLogoutBtn.textContent = 'Logout';
  }

  // Admin settings link (admin only)
  settingsLinks.forEach(link => {
    if (link) {
      link.style.display = isAdmin ? 'block' : 'none';
    }
  });

  // Student settings link (all authenticated users)
  studentSettingsLinks.forEach(link => {
    if (link) {
      link.style.display = isLoggedIn ? 'block' : 'none';
    }
  });
}

/**
 * Show login panel
 */
export function showLoginPanel() {
  const loginPanel = document.querySelector('.login_panel');
  if (loginPanel) {
    loginPanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on email input
    setTimeout(() => {
      const emailInput = document.querySelector('#login_email');
      if (emailInput) emailInput.focus();
    }, 100);
    
  }
}

/**
 * Hide login panel
 */
export function hideLoginPanel() {
  const loginPanel = document.querySelector('.login_panel');
  if (loginPanel) {
    loginPanel.style.display = 'none';
    document.body.style.overflow = '';
  }
}

/**
 * Toggle login panel visibility
 */
export function toggleLoginPanel() {
  const loginPanel = document.querySelector('.login_panel');
  if (loginPanel) {
    const isVisible = loginPanel.style.display === 'flex';
    if (isVisible) {
      hideLoginPanel();
    } else {
      showLoginPanel();
    }
  }
}

/**
 * Clear login form
 */
export function clearLoginForm() {
  const emailInput = document.querySelector('#login_email');
  const passwordInput = document.querySelector('#login_password');
  
  if (emailInput) emailInput.value = '';
  if (passwordInput) passwordInput.value = '';
  
}

/**
 * Show login loading state
 * @param {HTMLElement} button - Login button element
 * @param {boolean} isLoading - Loading state
 */
export function setLoginLoading(button, isLoading) {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = 'Logging in...';
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || 'Login';
    button.disabled = false;
  }
}

/**
 * Show login error message
 * @param {string} message - Error message
 */
export function showLoginError(message) {
  alert(message); // TODO: Replace with better UI notification
}

/**
 * Show login success message
 * @param {string} message - Success message
 */
export function showLoginSuccess(message) {
  // TODO: Add success toast notification
}

/**
 * Show username setup panel
 */
export function showUsernamePanel() {
  const usernamePanel = document.querySelector('.username_panel');
  if (usernamePanel) {
    usernamePanel.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on username input
    setTimeout(() => {
      const usernameInput = document.querySelector('#setup_username');
      if (usernameInput) usernameInput.focus();
    }, 100);
    
  }
}

/**
 * Hide username setup panel
 */
export function hideUsernamePanel() {
  const usernamePanel = document.querySelector('.username_panel');
  if (usernamePanel) {
    usernamePanel.style.display = 'none';
    document.body.style.overflow = '';
  }
}

/**
 * Clear username form
 */
export function clearUsernameForm() {
  const usernameInput = document.querySelector('#setup_username');
  if (usernameInput) usernameInput.value = '';
}

/**
 * Initialize login form handlers
 * @param {Function} onLogin - Login handler function
 */
export function initLoginForm(onLogin) {
  const form = document.querySelector('.login form');
  const emailInput = document.querySelector('#login_email');
  const passwordInput = document.querySelector('#login_password');
  const loginButton = document.querySelector('.login_submit');
  const closeButton = document.querySelector('.close_btn');
  const loginPanel = document.querySelector('.login_panel');

  // Form submit handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!email || !password) {
        showLoginError('Please fill in all fields');
        return;
      }

      setLoginLoading(loginButton, true);

      try {
        await onLogin(email, password);
        clearLoginForm();
        hideLoginPanel();
        showLoginSuccess('Login successful');
      } catch (error) {
        showLoginError('Login failed: ' + error.message);
      } finally {
        setLoginLoading(loginButton, false);
      }
    });
  }

  // Close button handler
  if (closeButton) {
    closeButton.addEventListener('click', hideLoginPanel);
  }

  // Click outside to close
  if (loginPanel) {
    loginPanel.addEventListener('click', (e) => {
      if (e.target === loginPanel) {
        hideLoginPanel();
      }
    });
  }

}

/**
 * Initialize mock test redirect
 * @param {Function} isUserAuthenticated - Function to check auth state
 */
export function initMockRedirect(isUserAuthenticated) {
  const mockLinks = document.querySelectorAll("#mockLink, #mobileTokenLink");
  
  mockLinks.forEach(mockLink => {
    if (mockLink) {
      mockLink.addEventListener("click", (e) => {
        e.preventDefault();
        
        const isAuthenticated = isUserAuthenticated();
        
        if (isAuthenticated) {
          window.location.href = "pages/mock.html";
        } else {
          showLoginPanel();
        }
      });
    }
  });

}

/**
 * Initialize username setup form handlers
 * @param {Function} onUsernameSubmit - Username submit handler function
 */
export function initUsernameForm(onUsernameSubmit) {
  const form = document.querySelector('#username-setup-form');
  const usernameInput = document.querySelector('#setup_username');
  const submitButton = document.querySelector('.username_submit');

  // Form submit handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = usernameInput?.value.trim();

      if (!username) {
        showLoginError('Please enter your name');
        return;
      }

      setLoginLoading(submitButton, true);

      try {
        await onUsernameSubmit(username);
        clearUsernameForm();
        hideUsernamePanel();
        showLoginSuccess('Name saved successfully');
      } catch (error) {
        showLoginError('Failed to save name: ' + error.message);
      } finally {
        setLoginLoading(submitButton, false);
      }
    });
  }

}

// Make functions globally available for compatibility
window.toggleLogin = toggleLoginPanel;
window.closeLogin = hideLoginPanel;
window.updateAuthUI = updateAuthUI;

export default {
  updateAuthUI,
  showLoginPanel,
  hideLoginPanel,
  toggleLoginPanel,
  clearLoginForm,
  setLoginLoading,
  showLoginError,
  showLoginSuccess,
  initLoginForm,
  initMockRedirect,
  showUsernamePanel,
  hideUsernamePanel,
  clearUsernameForm,
  initUsernameForm
};

