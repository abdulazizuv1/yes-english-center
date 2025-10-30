import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { firebaseConfig } from "../../../../config.js";
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

function formatTestId(testId) {
  if (!testId) return "Full Mock Test";
  
  const testNumber = testId.replace(/[^0-9]/g, '');
  
  if (testNumber) {
    return `Full Mock ${testNumber}`;
  }
  
  return "Full Mock Test";
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

function getOverallScoreColor(score, total) {
  const percentage = (score / total) * 100;
  if (percentage >= 90) return 'linear-gradient(135deg, #10b981, #059669)'; // Green
  if (percentage >= 80) return 'linear-gradient(135deg, #3b82f6, #1e40af)'; // Blue
  if (percentage >= 70) return 'linear-gradient(135deg, #8b5cf6, #7c3aed)'; // Purple
  if (percentage >= 60) return 'linear-gradient(135deg, #f59e0b, #d97706)'; // Orange
  if (percentage >= 50) return 'linear-gradient(135deg, #ef4444, #dc2626)'; // Red
  return 'linear-gradient(135deg, #6b7280, #4b5563)'; // Gray
}

async function loadResults() {
  showLoader();
  try {
    console.log("🔄 Loading full mock test results...");
    
    // Query results ordered by creation date (newest first)
    const q = query(
      collection(db, "resultFullmock"),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    console.log("📊 Found results:", querySnapshot.size);

    // Create table header
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th>👤 Student</th>
          <th>📝 Test</th>
          <th>🎯 Overall Score</th>
          <th>📊 Section Breakdown</th>
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
          <td colspan="6" class="no-results">
            <div class="no-results-icon">🎯</div>
            <h3>No Results Found</h3>
            <p>No full mock test results available yet.</p>
          </td>
        </tr>
      `;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log("📋 Processing result:", {
        id: docSnap.id,
        name: data.name,
        totalScore: data.totalScore,
        totalPossible: data.totalPossible
      });
      
      const email = data.name || data.email || "Unknown Student";
      const totalScore = data.totalScore || 0;
      const totalPossible = data.totalPossible || 80;
      const listeningScore = data.listeningScore || 0;
      const listeningTotal = data.listeningTotal || 40;
      const readingScore = data.readingScore || 0;
      const readingTotal = data.readingTotal || 40;
      const testId = data.testId || "test-1";
      const createdAt = data.createdAt;
      
      const testName = formatTestId(testId);
      const dateFormatted = formatDate(createdAt);
      const overallScoreColor = getOverallScoreColor(totalScore, totalPossible);
      
      // Calculate percentages
      const listeningPercentage = Math.round((listeningScore / listeningTotal) * 100);
      const readingPercentage = Math.round((readingScore / readingTotal) * 100);
      const overallPercentage = Math.round((totalScore / totalPossible) * 100);

      const row = document.createElement("tr");
      row.style.cursor = "pointer";

      row.innerHTML = `
        <td class="email-cell" data-label="Student">${email}</td>
        <td data-label="Test">
          <span class="test-badge">${testName}</span>
        </td>
        <td class="score-cell" data-label="Overall Score">
          <div class="overall-score" style="background: ${overallScoreColor};">${totalScore}/${totalPossible}</div>
          <div style="font-size: 12px; color: #64748b;">${overallPercentage}%</div>
        </td>
        <td data-label="Section Breakdown">
          <div class="score-breakdown">
            <div class="section-score">
              <span class="section-icon">👂</span>
              <span>Listening: ${listeningScore}/${listeningTotal} (${listeningPercentage}%)</span>
            </div>
            <div class="section-score">
              <span class="section-icon">📖</span>
              <span>Reading: ${readingScore}/${readingTotal} (${readingPercentage}%)</span>
            </div>
            <div class="section-score">
              <span class="section-icon">📝</span>
              <span class="writing-status">Writing Submitted</span>
            </div>
          </div>
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
          console.log(`🔍 Opening result page for: ${docSnap.id}`);
          window.location.href = `/pages/mock/full/resultFullMock.html?id=${docSnap.id}`;
        }
      });

      // Delete functionality
      row.querySelector(".deleteBtn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        const confirmed = confirm(
          `Are you sure you want to delete this full mock test result?\n\n` +
          `Student: ${email}\n` +
          `Test: ${testName}\n` +
          `Overall Score: ${totalScore}/${totalPossible} (${overallPercentage}%)\n` +
          `Listening: ${listeningScore}/${listeningTotal}\n` +
          `Reading: ${readingScore}/${readingTotal}\n` +
          `Date: ${dateFormatted}\n\n` +
          `This action cannot be undone.`
        );
        
        if (confirmed) {
          try {
            console.log(`🗑️ Deleting result: ${docSnap.id}`);
            
            // Show loading state on button
            const deleteBtn = e.target.closest(".deleteBtn");
            const originalContent = deleteBtn.innerHTML;
            deleteBtn.innerHTML = `<div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>`;
            deleteBtn.disabled = true;

            await deleteDoc(doc(db, "resultFullmock", docSnap.id));
            
            console.log("✅ Result deleted successfully");
            
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
                    <td colspan="6" class="no-results">
                      <div class="no-results-icon">🎯</div>
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

    console.log("✅ Results loaded successfully");

  } catch (error) {
    console.error("❌ Error loading results:", error);
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th colspan="6" style="text-align: center; color: #ef4444;">
            ❌ Error Loading Results
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h3>Failed to Load Results</h3>
            <p>There was an error loading the full mock test results.</p>
            <p style="font-size: 14px; margin-top: 10px;">Error: ${error.message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">
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