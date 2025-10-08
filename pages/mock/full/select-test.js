import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "/config.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const container = document.getElementById("test-buttons");
const loading = document.getElementById("loading");

// Check authentication
onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("🔒 Please login first to access tests");
    window.location.href = "/";
    return;
  }
  
  console.log("👤 User authenticated:", user.email);
  loadFullMockTests(user);
});

// Function to convert total score to IELTS band (assuming total 120 questions: 40 listening + 40 reading + 2 writing tasks)
function convertToIELTS(listeningScore, readingScore, writingScore) {
  // Calculate overall band as average of three sections
  const listeningBand = convertListeningToIELTS(listeningScore);
  const readingBand = convertReadingToIELTS(readingScore);
  const writingBand = writingScore; // Writing is already in band format
  
  const totalBand = (listeningBand + readingBand + writingBand) / 3;
  
  // Round to nearest 0.5
  return Math.round(totalBand * 2) / 2;
}

function convertListeningToIELTS(score, total = 40) {
  const percent = (score / total) * 100;
  if (percent >= 90) return 9.0;
  if (percent >= 87.5) return 8.5;
  if (percent >= 80) return 8.0;
  if (percent >= 75) return 7.5;
  if (percent >= 70) return 7.0;
  if (percent >= 65) return 6.5;
  if (percent >= 60) return 6.0;
  if (percent >= 55) return 5.5;
  if (percent >= 50) return 5.0;
  if (percent >= 45) return 4.5;
  if (percent >= 40) return 4.0;
  return 3.5;
}

function convertReadingToIELTS(score, total = 40) {
  const percent = (score / total) * 100;
  if (percent >= 90) return 9.0;
  if (percent >= 87.5) return 8.5;
  if (percent >= 80) return 8.0;
  if (percent >= 75) return 7.5;
  if (percent >= 70) return 7.0;
  if (percent >= 65) return 6.5;
  if (percent >= 60) return 6.0;
  if (percent >= 55) return 5.5;
  if (percent >= 50) return 5.0;
  if (percent >= 45) return 4.5;
  if (percent >= 40) return 4.0;
  return 3.5;
}

function getBandClass(band) {
  const score = parseFloat(band);
  if (score >= 9.0) return 'band-9';
  if (score >= 8.0) return 'band-8';
  if (score >= 7.0) return 'band-7';
  if (score >= 6.0) return 'band-6';
  if (score >= 5.0) return 'band-5';
  return 'band-low';
}

async function getUserLatestResult(userId, testId) {
  try {
    console.log("Searching for full mock results - userId:", userId, "testId:", testId);
    
    // First try with userId
    let resultsQuery = query(
      collection(db, "resultFullmock"),
      where("userId", "==", userId),
      where("testId", "==", testId),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    
    let snapshot = await getDocs(resultsQuery);
    
    // If no results with userId, try with email in name field
    if (snapshot.empty) {
      const user = auth.currentUser;
      if (user && user.email) {
        console.log("No results with userId, trying with email:", user.email);
        resultsQuery = query(
          collection(db, "resultFullmock"),
          where("name", "==", user.email),
          where("testId", "==", testId),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        snapshot = await getDocs(resultsQuery);
      }
    }
    
    // Debug: Check all user's results if none found for this test
    if (snapshot.empty) {
      console.log("No results found with testId filter. Checking all user results...");
      const allResultsQuery = query(
        collection(db, "resultFullmock"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const allResults = await getDocs(allResultsQuery);
      
      if (!allResults.empty) {
        console.log("User has full mock results, but not for this testId. User's test IDs:");
        allResults.forEach(doc => {
          console.log("- testId:", doc.data().testId);
        });
      } else {
        // Try with name field
        const allResultsByName = await getDocs(query(
          collection(db, "resultFullmock"),
          where("name", "==", auth.currentUser?.email || ""),
          orderBy("createdAt", "desc")
        ));
        
        if (!allResultsByName.empty) {
          console.log("User has results by email, test IDs:");
          allResultsByName.forEach(doc => {
            console.log("- testId:", doc.data().testId);
          });
        }
      }
    }
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      console.log("Found result for full mock test", testId, ":", doc.data());
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    
    console.log("No result found for full mock test", testId);
    return null;
  } catch (error) {
    console.error("Error fetching user result for full mock test", testId, ":", error);
    return null;
  }
}

function createResultSection(result, testId) {
  if (!result) {
    return `
      <div class="user-result no-result">
        <div class="no-result-text">Take this test to see your score</div>
      </div>
    `;
  }

  // Calculate overall band from individual section scores
  const listeningScore = result.listeningScore || 0;
  const readingScore = result.readingScore || 0;
  const writingScore = result.writingScore || 0;
  
  const overallBand = convertToIELTS(listeningScore, readingScore, writingScore);
  const bandClass = getBandClass(overallBand);
  
  // Create score display
  const totalCorrect = listeningScore + readingScore;
  const scoreText = `L:${listeningScore}/40 R:${readingScore}/40 W:${writingScore}`;
  
  return `
    <div class="user-result" data-result-id="${result.id}">
      <div class="result-score">${scoreText}</div>
      <div class="band-badge ${bandClass}">Band ${overallBand}</div>
    </div>
  `;
}

async function loadFullMockTests(user) {
  try {
    console.log("🔄 Loading full mock tests...");
    
    const testsSnapshot = await getDocs(collection(db, "fullmockTests"));
    const tests = [];
    
    testsSnapshot.forEach((doc) => {
      tests.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    console.log("📊 Found tests:", tests.length);
    console.log("📋 Test IDs:", tests.map(t => t.id)); // Debug log
    
    loading.style.display = 'none';
    
    if (tests.length === 0) {
      container.innerHTML = `
        <div class="no-tests">
          <h3>🎯 No full mock tests available yet</h3>
          <p>Full mock tests are coming soon! Check back later.</p>
        </div>
      `;
      return;
    }
    
    // Sort tests by ID for consistent ordering
    tests.sort((a, b) => {
      // Natural sort to handle test-1, test-2, test-10 etc correctly
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
    
    // Load all test cards first
    for (const [index, test] of tests.entries()) {
      const btn = document.createElement("button");
      btn.className = "test-card";
      
      // Use the actual document ID for display and navigation
      const testId = test.id;
      const testTitle = test.data.title || `Full Mock Test ${testId}`;
      const testDescription = test.data.description || "Complete IELTS practice with Listening, Reading, and Writing sections in one comprehensive test.";
      
      // Calculate total duration
      const totalDuration = calculateTotalDuration(test.data.stages);
      
      // Add data attribute for debugging
      btn.setAttribute('data-test-id', testId);
      
      btn.innerHTML = `
        <div>
          <span class="test-icon">🎯</span>
          <div class="test-title">${testTitle}</div>
          <p class="test-subtitle">${totalDuration} • All 3 sections</p>
          <span class="test-status available">Available</span>
        </div>
        
        <div class="test-details">
          <div class="test-stages">
            <span class="stage-badge">👂 Listening</span>
            <span class="stage-badge">📖 Reading</span>
            <span class="stage-badge">📝 Writing</span>
          </div>
          <div class="test-duration">Total time: ${totalDuration}</div>
        </div>
        
        <div class="test-description">
          <h4>📋 Full Mock Test - ${testId}</h4>
          <p>${testDescription}</p>
        </div>
        
        <div class="user-result-container" id="result-${testId}">
          <div class="loading-result">
            <div class="spinner-small"></div>
            Loading your result...
          </div>
        </div>
      `;
      
      // Main button click - navigate to test
      btn.addEventListener("click", (e) => {
        // Check if click is on the result section
        if (!e.target.closest('.user-result') || e.target.closest('.user-result.no-result')) {
          const selectedTestId = testId; // Use the actual test ID
          console.log(`🎯 Button clicked for test: ${selectedTestId}`);
          console.log(`📄 Test data:`, test.data);
          
          if (confirm(`🎯 Start Full Mock Test: ${testId}?\n\nThis is a complete IELTS practice test with:\n• Listening (30 min)\n• Reading (60 min) \n• Writing (60 min)\n\nTotal time: ${totalDuration}\n\nReady to begin?`)) {
            console.log(`🚀 Starting full mock test: ${selectedTestId}`);
            const targetUrl = `fullMock.html?testId=${selectedTestId}`;
            console.log(`🔗 Navigating to: ${targetUrl}`);
            window.location.href = targetUrl;
          }
        }
      });
      
      container.appendChild(btn);
      
      console.log(`✅ Added test card for: ${testId} (${testTitle})`);

      // Load user result asynchronously
      getUserLatestResult(user.uid, testId).then(result => {
        const resultContainer = document.getElementById(`result-${testId}`);
        if (resultContainer) {
          resultContainer.innerHTML = createResultSection(result, testId);
          
          // Add click handler for result section if result exists
          if (result) {
            const resultElement = resultContainer.querySelector('.user-result');
            resultElement.addEventListener('click', (e) => {
              e.stopPropagation();
              console.log(`🔗 Navigating to result page for: ${result.id}`);
              window.location.href = `/pages/mock/full/resultFullMock.html?id=${result.id}`;
            });
          }
        }
      });
    }
    
  } catch (error) {
    console.error("❌ Error loading full mock tests:", error);
    loading.innerHTML = `
      <div class="error">
        <h3>❌ Error loading tests</h3>
        <p>Please try again later or contact support.</p>
        <p style="font-size: 0.9rem; opacity: 0.7; margin-top: 10px;">Error: ${error.message}</p>
      </div>
    `;
  }
}

// Calculate total duration from stages
function calculateTotalDuration(stages) {
  if (!stages || !Array.isArray(stages)) {
    return "150 minutes"; // Default fallback
  }
  
  let totalMinutes = 0;
  stages.forEach(stage => {
    if (stage.duration) {
      totalMinutes += stage.duration;
    }
  });
  
  return totalMinutes > 0 ? `${totalMinutes} minutes` : "150 minutes";
}

// Add some interactive effects
document.addEventListener('DOMContentLoaded', () => {
  // Add subtle animations to the background
  document.body.style.backgroundAttachment = 'fixed';
  
  // Add keyboard navigation
  document.addEventListener('keydown', (e) => {
    const testCards = document.querySelectorAll('.test-card');
    if (testCards.length === 0) return;
    
    let currentIndex = Array.from(testCards).findIndex(card => 
      card === document.activeElement
    );
    
    switch(e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        currentIndex = (currentIndex + 1) % testCards.length;
        testCards[currentIndex].focus();
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        currentIndex = currentIndex <= 0 ? testCards.length - 1 : currentIndex - 1;
        testCards[currentIndex].focus();
        break;
      case 'Enter':
        if (document.activeElement.classList.contains('test-card')) {
          document.activeElement.click();
        }
        break;
    }
  });
});

console.log("🌐 Full mock test selection page loaded");