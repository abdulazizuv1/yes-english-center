import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBw36xP5tVYO2D0T-XFQQAGFA4wrJ8If8k",
  authDomain: "yes-english-center.firebaseapp.com",
  projectId: "yes-english-center",
  storageBucket: "yes-english-center.appspot.com",
  messagingSenderId: "203211203853",
  appId: "1:203211203853:web:7d499925c3aa830eaefc44",
  measurementId: "G-4LHEBLG2KK",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const resultsTable = document.getElementById("resultsTable");
const loader = document.getElementById("loader");

function showLoader() {
  loader.classList.remove("hidden");
}

function hideLoader() {
  loader.classList.add("hidden");
}

function convertToIELTS(score, total) {
  const normalizedScore = Math.round((score / total) * 40);
  if (normalizedScore >= 39) return "9.0";
  if (normalizedScore >= 37) return "8.5";
  if (normalizedScore >= 35) return "8.0";
  if (normalizedScore >= 32) return "7.5";
  if (normalizedScore >= 30) return "7.0";
  if (normalizedScore >= 26) return "6.5";
  if (normalizedScore >= 23) return "6.0";
  if (normalizedScore >= 18) return "5.5";
  if (normalizedScore >= 16) return "5.0";
  if (normalizedScore >= 13) return "4.5";
  if (normalizedScore >= 10) return "4.0";
  return "Below 4.0";
}

function formatTestId(testId) {
  if (!testId) return { text: "Unknown", class: "test-unknown" };
  
  const testNumber = testId.replace(/[^0-9]/g, '');
  
  switch (testId.toLowerCase()) {
    case 'test-1':
      return { text: "Test 1", class: "test-1" };
    case 'test-2':
      return { text: "Test 2", class: "test-2" };
    case 'test-3':
      return { text: "Test 3", class: "test-3" };
    case 'test-4':
      return { text: "Test 4", class: "test-4" };
    default:
      if (testNumber) {
        return { text: `Test ${testNumber}`, class: `test-${testNumber}` };
      }
      return { text: testId, class: "test-unknown" };
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "Unknown date";
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return "Invalid date";
  }
}

function getBandScoreColor(band) {
  const score = parseFloat(band);
  if (score >= 9.0) return 'linear-gradient(135deg, #10b981, #059669)';
  if (score >= 8.0) return 'linear-gradient(135deg, #3b82f6, #1e40af)';
  if (score >= 7.0) return 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
  if (score >= 6.0) return 'linear-gradient(135deg, #f59e0b, #d97706)';
  if (score >= 5.0) return 'linear-gradient(135deg, #ef4444, #dc2626)';
  return 'linear-gradient(135deg, #6b7280, #4b5563)';
}

async function loadResults() {
  showLoader();
  try {
    // Query results ordered by creation date (newest first)
    const q = query(
      collection(db, "resultsListening"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    // Create table header
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th>👤 Student</th>
          <th>📝 Test</th>
          <th>🎯 Score</th>
          <th>📅 Date</th>
          <th>🗑️ Action</th>
        </tr>
      </thead>
      <tbody id="resultsBody"></tbody>
    `;

    const resultsBody = document.getElementById("resultsBody");

    if (querySnapshot.empty) {
      resultsBody.innerHTML = `
        <tr>
          <td colspan="5" class="no-results">
            <div class="no-results-icon">🎧</div>
            <h3>No Results Found</h3>
            <p>No listening test results available yet.</p>
          </td>
        </tr>
      `;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const email = data.name || "Unknown Student";
      const score = data.score || 0;
      const total = data.total || 40;
      const testId = data.testId || "test-1";
      const createdAt = data.createdAt;
      const band = convertToIELTS(score, total);
      
      const testInfo = formatTestId(testId);
      const dateFormatted = formatDate(createdAt);
      const bandColor = getBandScoreColor(band);

      const row = document.createElement("tr");
      row.style.cursor = "pointer";

      row.innerHTML = `
        <td class="email-cell" data-label="Student">${email}</td>
        <td data-label="Test">
          <span class="test-badge ${testInfo.class}">${testInfo.text}</span>
        </td>
        <td class="score-cell" data-label="Score">
          <div class="band-score" style="background: ${bandColor};">${band}</div>
          <div class="detailed-score">(${score}/${total})</div>
        </td>
        <td data-label="Date" style="color: #64748b; font-size: 14px;">${dateFormatted}</td>
        <td data-label="Action">
          <button class="deleteBtn" title="Delete Result">
            🗑️ Delete
          </button>
        </td>
      `;

      // Navigate to result page on row click (except delete button)
      row.addEventListener("click", (e) => {
        if (!e.target.closest(".deleteBtn")) {
          window.location.href = `/pages/mock/listening/resultListening.html?id=${docSnap.id}`;
        }
      });

      // Delete functionality
      row.querySelector(".deleteBtn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        const confirmed = confirm(
          `Are you sure you want to delete this result?\n\n` +
          `Student: ${email}\n` +
          `Test: ${testInfo.text}\n` +
          `Score: ${band} (${score}/${total})\n` +
          `Date: ${dateFormatted}\n\n` +
          `This action cannot be undone.`
        );
        
        if (confirmed) {
          try {
            // Show loading state on button
            const deleteBtn = e.target.closest(".deleteBtn");
            const originalContent = deleteBtn.innerHTML;
            deleteBtn.innerHTML = `<div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>`;
            deleteBtn.disabled = true;

            await deleteDoc(doc(db, "resultsListening", docSnap.id));
            
            // Animate row removal
            row.style.transition = "all 0.3s ease";
            row.style.transform = "translateX(100%)";
            row.style.opacity = "0";
            
            setTimeout(() => {
              row.remove();
              
              // Check if table is empty after deletion
              if (resultsBody.children.length === 0) {
                resultsBody.innerHTML = `
                  <tr>
                    <td colspan="5" class="no-results">
                      <div class="no-results-icon">🎧</div>
                      <h3>No Results Found</h3>
                      <p>All results have been deleted.</p>
                    </td>
                  </tr>
                `;
              }
            }, 300);

          } catch (err) {
            console.error("❌ Error deleting result:", err);
            
            // Reset button state
            const deleteBtn = e.target.closest(".deleteBtn");
            deleteBtn.innerHTML = originalContent;
            deleteBtn.disabled = false;
            
            alert(
              "❌ Failed to delete result\n\n" +
              "You may not have permission to delete this result, or a network error occurred.\n\n" +
              "Error: " + err.message
            );
          }
        }
      });

      resultsBody.appendChild(row);
    });

    // Add some animation to the rows
    const rows = resultsBody.querySelectorAll("tr");
    rows.forEach((row, index) => {
      row.style.opacity = "0";
      row.style.transform = "translateY(20px)";
      setTimeout(() => {
        row.style.transition = "all 0.3s ease";
        row.style.opacity = "1";
        row.style.transform = "translateY(0)";
      }, index * 100);
    });

  } catch (error) {
    console.error("❌ Error loading results:", error);
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th colspan="5" style="text-align: center; color: #ef4444;">
            ❌ Error Loading Results
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: #64748b;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h3>Failed to Load Results</h3>
            <p>There was an error loading the listening test results.</p>
            <p style="font-size: 14px; margin-top: 10px;">Error: ${error.message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 8px; cursor: pointer;">
              🔄 Retry
            </button>
          </td>
        </tr>
      </tbody>
    `;
  } finally {
    hideLoader();
  }
}

// Authentication check
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ User authenticated:", user.email);
    loadResults();
  } else {
    console.log("❌ User not authenticated");
    alert("🔒 Please login first to view results");
    window.location.href = "/login.html";
  }
});

// Add ripple effect to buttons
document.addEventListener('click', function(e) {
  if (e.target.matches('button')) {
    const button = e.target;
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      transform: scale(0);
      animation: ripple-animation 0.6s linear;
      pointer-events: none;
    `;
    
    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }
});

// Add CSS for ripple animation
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple-animation {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);