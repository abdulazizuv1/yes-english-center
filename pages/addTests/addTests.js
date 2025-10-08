// addTests.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig } from "/config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Check if user is admin
async function checkAdminAccess() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (!user) {
        console.log("❌ User not authenticated");
        alert("🔒 Please login first to access this page");
        window.location.href = "/";
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.log("❌ User document not found");
          alert("❌ User data not found. Access denied.");
          window.location.href = "/";
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (userRole !== "admin") {
          console.log("❌ User is not admin. Role:", userRole);
          alert("🚫 Access denied. Admin privileges required.");
          window.location.href = "/";
          return;
        }

        console.log("✅ Admin access granted for:", user.email);
        resolve({ user, userData });

      } catch (error) {
        console.error("❌ Error checking user role:", error);
        alert("❌ Error verifying admin access. Please try again.");
        window.location.href = "/";
      }
    });
  });
}

// Show coming soon message
window.showComingSoon = function(testType) {
  alert(`📅 ${testType} test management coming soon!\n\nCurrently, only Writing tests can be added.`);
}

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🎯 Add Tests page loaded");
  
  // Check admin access
  await checkAdminAccess();
  
  console.log("✅ Page initialized successfully");
});