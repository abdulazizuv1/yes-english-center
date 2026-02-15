/**
 * Main Application Entry Point
 * Orchestrates all modules and application initialization
 * @module main
 */

// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { firebaseConfig } from "../config.js";

// Module imports
import * as Auth from './modules/auth/auth.js';
import * as AuthUI from './modules/auth/auth-ui.js';
import * as DataLoader from './modules/data/data-loader.js';
import * as UIRenderer from './modules/ui/renderer.js';
import * as Skeleton from './modules/ui/skeleton.js';
import * as SwiperConfig from './modules/swiper/swiper-config.js';
import * as Language from './modules/language/language.js';
import * as Helpers from './modules/utils/helpers.js';
import * as Performance from './modules/utils/performance.js';

/**
 * Application State
 */
const AppState = {
  initialized: false,
  firebaseApp: null,
  auth: null,
  swipers: null,
};

/**
 * Initialize Firebase
 */
function initializeFirebase() {
  try {
    AppState.firebaseApp = initializeApp(firebaseConfig);
    AppState.auth = Auth.initAuth(AppState.firebaseApp);
    DataLoader.initFirestore(AppState.firebaseApp);
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize Authentication
 */
function initializeAuth() {
  // Setup auth state change listener
  Auth.onAuthChange((user, userData) => {
    AuthUI.updateAuthUI(user, userData);
    
    // Check if user needs to set up username
    if (user && userData && !Auth.hasValidName(userData)) {
      setTimeout(() => {
        AuthUI.showUsernamePanel();
      }, 500);
    }
  });

  // Initialize login form
  AuthUI.initLoginForm(async (usernameOrEmail, password) => {
    await Auth.login(usernameOrEmail, password);
  });

  // Initialize username setup form
  AuthUI.initUsernameForm(async (name) => {
    const user = Auth.getCurrentUser();
    if (user) {
      await Auth.updateUserName(user.uid, name);
    }
  });

  // Initialize mock redirect
  AuthUI.initMockRedirect(() => Auth.isAuthenticated());

  // Setup global login/logout functions
  window.loginUser = async function() {
    const usernameOrEmail = document.querySelector("#login_email").value.trim();
    const password = document.querySelector("#login_password").value.trim();
    const loginBtn = document.querySelector(".login_submit");

    if (!usernameOrEmail || !password) {
      AuthUI.showLoginError("Please fill in all fields");
      return;
    }

    AuthUI.setLoginLoading(loginBtn, true);

    try {
      await Auth.login(usernameOrEmail, password);
      AuthUI.clearLoginForm();
      AuthUI.hideLoginPanel();
      AuthUI.showLoginSuccess('Login successful');
    } catch (err) {
      AuthUI.showLoginError("Login failed: " + err.message);
    } finally {
      AuthUI.setLoginLoading(loginBtn, false);
    }
  };

  window.logoutUser = async function() {
    try {
      await Auth.logout();
      AuthUI.clearLoginForm();
    } catch (err) {
      alert("Logout failed: " + err.message);
    }
  };

}

/**
 * Load and render data
 */
async function loadAndRenderData() {
  try {
    // Load data with priority (groups first)
    const data = await DataLoader.loadAllData();

    // Render groups first
    if (data.groups) {
      const groupsWrapper = document.querySelector("#groups .swiper-wrapper");
      UIRenderer.renderGroups(data.groups, groupsWrapper);
      SwiperConfig.updateSwiper(".mySwiper");
    }

    // Render results
    if (data.results) {
      const resultsWrapper = document.querySelector("#results .swiper-wrapper");
      UIRenderer.renderResults(data.results, resultsWrapper);
      SwiperConfig.updateSwiper(".mySwiper3");
    }

    // Render feedbacks
    if (data.feedbacks) {
      const feedbacksWrapper = document.querySelector("#feedbacks .swiper-wrapper");
      UIRenderer.renderFeedbacks(data.feedbacks, feedbacksWrapper);
      SwiperConfig.updateSwiper(".mySwiper2");
    }

    // Update all swipers
    SwiperConfig.updateAllSwipers();

  } catch (error) {
    // Error loading and rendering data
  }
}

/**
 * Initialize UI
 */
async function initializeUI() {
  // Show skeleton loaders immediately
  Skeleton.showAllSkeletons();

  // Initialize Swipers with skeleton content
  AppState.swipers = SwiperConfig.initAllSwipers();

  // Hide loader
  setTimeout(() => Helpers.hideLoader(), 500);

  // Load and render data
  await loadAndRenderData();

}

/**
 * Initialize Language
 */
function initializeLanguage() {
  Language.initLanguageOnLoad();
  Language.initLanguageSwitchers();
}

/**
 * Main initialization function
 */
async function startApp() {
  if (AppState.initialized) {
    return;
  }


  try {
    // 1. Initialize Firebase
    if (!initializeFirebase()) {
      throw new Error('Firebase initialization failed');
    }

    // 2. Initialize Authentication
    initializeAuth();

    // 3. Initialize Language
    initializeLanguage();

    // 4. Initialize Performance Tracking
    Performance.initPerformanceTracking();

    // 5. Initialize UI
    await initializeUI();

    AppState.initialized = true;

  } catch (error) {
    Helpers.hideLoader();
    alert('Failed to initialize application. Please refresh the page.');
  }
}

/**
 * DOM Content Loaded Event
 */
document.addEventListener("DOMContentLoaded", () => {
  startApp();
});

/**
 * Export for testing and debugging
 */
export default {
  AppState,
  startApp,
  Auth,
  AuthUI,
  DataLoader,
  UIRenderer,
  Skeleton,
  SwiperConfig,
  Language,
  Helpers,
  Performance
};

// Make modules available globally for debugging
window.App = {
  startApp,
  Auth,
  AuthUI,
  DataLoader,
  UIRenderer,
  Skeleton,
  SwiperConfig,
  Language,
  Helpers,
  Performance,
  AppState
};

