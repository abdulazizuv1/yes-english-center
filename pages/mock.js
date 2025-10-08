import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "../config.js";


const app = initializeApp(firebaseConfig);
const auth = getAuth();

// Check authentication function
async function checkAuthentication() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        console.log("❌ User not authenticated, redirecting to home page");
        alert("🔒 Please login first to access mock tests");
        window.location.href = "/";
        return;
      }
      console.log("✅ User authenticated:", user.email);
      resolve(user);
    });
  });
}

// Initialize mock page functionality
async function initializeMockPage() {
  try {
    // Check authentication first
    const user = await checkAuthentication();
    if (!user) return; // Will redirect if not authenticated

    console.log("🌐 Mock page loaded for user:", user.email);

    // Setup button event listeners after authentication check
    document.querySelectorAll(".mock_page_btn").forEach((btn, index) => {
      const modes = ["reading", "listening", "writing", "speaking", "full"];
      btn.addEventListener("click", () => {
        const selectedMode = modes[index];
        console.log(`🎯 User selected mode: ${selectedMode}`);
        window.location.href = `./mock/select-test.html?mode=${selectedMode}`;
      });
    });

    console.log("✅ Mock page initialized successfully");

  } catch (error) {
    console.error("❌ Error initializing mock page:", error);
    alert("Error loading mock tests. Please try again.");
    window.location.href = "/";
  }
}

// Initialize when page loads
window.addEventListener("load", () => {
  console.log("🌐 Mock page loading...");
  initializeMockPage();
});

// Optional: Add logout functionality if there's a logout button
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await auth.signOut();
        console.log("👋 User logged out");
        window.location.href = "/";
      } catch (error) {
        console.error("❌ Logout error:", error);
      }
    });
  }
}

// Call setup functions
window.addEventListener("load", () => {
  setupLogoutButton();
});