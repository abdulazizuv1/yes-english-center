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
    
    console.log('✅ Firebase initialized');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
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
  });

  // Initialize login form
  AuthUI.initLoginForm(async (email, password) => {
    await Auth.login(email, password);
  });

  // Initialize mock redirect
  AuthUI.initMockRedirect(() => Auth.isAuthenticated());

  // Setup global login/logout functions
  window.loginUser = async function() {
    const email = document.querySelector("#login_email").value.trim();
    const password = document.querySelector("#login_password").value.trim();
    const loginBtn = document.querySelector(".login_submit");

    if (!email || !password) {
      AuthUI.showLoginError("Please fill in all fields");
      return;
    }

    AuthUI.setLoginLoading(loginBtn, true);

    try {
      await Auth.login(email, password);
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
      console.log("✅ User logged out successfully");
    } catch (err) {
      console.error("❌ Logout error:", err);
      alert("Logout failed: " + err.message);
    }
  };

  console.log('✅ Authentication initialized');
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

    console.log('✅ All data loaded and rendered');
  } catch (error) {
    console.error('Error loading and rendering data:', error);
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

  console.log('✅ UI initialized');
}

/**
 * Initialize Language
 */
function initializeLanguage() {
  Language.initLanguageOnLoad();
  Language.initLanguageSwitchers();
  console.log('✅ Language initialized');
}

/**
 * Main initialization function
 */
async function startApp() {
  if (AppState.initialized) {
    console.warn('App already initialized');
    return;
  }

  console.log('🚀 Initializing YES English Center...');

  try {
    // 1. Initialize Firebase
    if (!initializeFirebase()) {
      throw new Error('Firebase initialization failed');
    }

    // 2. Initialize Authentication
    initializeAuth();

    // 3. Initialize Language
    initializeLanguage();

    // 4. Initialize UI
    await initializeUI();

    AppState.initialized = true;
    console.log('✅ Application initialized successfully!');

  } catch (error) {
    console.error('❌ Application initialization failed:', error);
    Helpers.hideLoader();
    alert('Failed to initialize application. Please refresh the page.');
  }
}

/**
 * DOM Content Loaded Event
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log('📄 DOM loaded, starting initialization...');
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
  Helpers
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
  AppState
};

