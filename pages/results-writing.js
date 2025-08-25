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
  storageBucket: "yes-english-center.firebasestorage.app",
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

function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
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

function getCompletionStatus(task1, task2) {
  const task1HasContent = task1 && task1.trim().length > 0;
  const task2HasContent = task2 && task2.trim().length > 0;
  
  if (task1HasContent && task2HasContent) {
    return { text: "Complete", class: "status-complete" };
  } else if (task1HasContent || task2HasContent) {
    return { text: "Partial", class: "status-partial" };
  } else {
    return { text: "Incomplete", class: "status-incomplete" };
  }
}

function getWordCountColor(totalWords) {
  if (totalWords >= 400) return 'linear-gradient(135deg, #10b981, #059669)'; // Green - Good
  if (totalWords >= 300) return 'linear-gradient(135deg, #3b82f6, #1e40af)'; // Blue - OK
  if (totalWords >= 200) return 'linear-gradient(135deg, #f59e0b, #d97706)'; // Orange - Low
  return 'linear-gradient(135deg, #ef4444, #dc2626)'; // Red - Very Low
}

async function loadResults() {
  showLoader();
  try {
    console.log("🔍 Loading Writing results...");
    
    // Сначала попробуем загрузить без сортировки для отладки
    let querySnapshot;
    try {
      const q = query(
        collection(db, "resultsWriting"),
        orderBy("submittedAt", "desc")
      );
      querySnapshot = await getDocs(q);
      console.log("✅ Query with orderBy successful");
    } catch (orderError) {
      console.log("⚠️ OrderBy failed, trying without ordering:", orderError);
      // Если orderBy не работает, загружаем без сортировки
      querySnapshot = await getDocs(collection(db, "resultsWriting"));
    }
    
    console.log("📊 Query results:", {
      empty: querySnapshot.empty,
      size: querySnapshot.size,
      docs: querySnapshot.docs.length
    });

    // Create table header
    resultsTable.innerHTML = `
      <thead>
        <tr>
          <th>👤 Student</th>
          <th>📝 Test</th>
          <th>📊 Words</th>
          <th>✅ Status</th>
          <th>📅 Date</th>
          <th>🗑️ Action</th>
        </tr>
      </thead>
      <tbody id="resultsBody"></tbody>
    `;

    const resultsBody = document.getElementById("resultsBody");

    if (querySnapshot.empty) {
      console.log("❌ No documents found in resultsWriting collection");
      resultsBody.innerHTML = `
        <tr>
          <td colspan="6" class="no-results">
            <div class="no-results-icon">✍️</div>
            <h3>No Results Found</h3>
            <p>No writing test results available yet.</p>
            <p style="font-size: 14px; margin-top: 10px;">Collection: resultsWriting | Docs: ${querySnapshot.size}</p>
          </td>
        </tr>
      `;
      return;
    }

    console.log("📝 Processing documents...");
    let processedCount = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      console.log(`📄 Document ${docSnap.id}:`, data);
      
      const email = data.email || data.name || "Unknown Student";
      const task1 = data.task1Content || data.task1 || "";
      const task2 = data.task2Content || data.task2 || "";
      const testId = data.testId || "test-1";
      const createdAt = data.submittedAt || data.createdAt;
      
      console.log(`Processing doc ${docSnap.id}:`, {
        email,
        task1Length: task1.length,
        task2Length: task2.length,
        testId,
        createdAt
      });
      
      // Calculate word counts
      const task1Words = countWords(task1);
      const task2Words = countWords(task2);
      const totalWords = task1Words + task2Words;
      
      const testInfo = formatTestId(testId);
      const dateFormatted = formatDate(createdAt);
      const completionStatus = getCompletionStatus(task1, task2);
      const wordCountColor = getWordCountColor(totalWords);

      const row = document.createElement("tr");
      row.style.cursor = "pointer";

      row.innerHTML = `
        <td class="email-cell" data-label="Student">${email}</td>
        <td data-label="Test">
          <span class="test-badge ${testInfo.class}">${testInfo.text}</span>
        </td>
        <td class="word-count-cell" data-label="Words">
          <div class="word-count-badge" style="background: ${wordCountColor};">${totalWords}</div>
          <div class="tasks-info">T1: ${task1Words} | T2: ${task2Words}</div>
        </td>
        <td data-label="Status">
          <span class="completion-status ${completionStatus.class}">${completionStatus.text}</span>
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
          window.location.href = `/pages/mock/writing/resultWriting.html?id=${docSnap.id}`;
        }
      });

      // Delete functionality
      row.querySelector(".deleteBtn").addEventListener("click", async (e) => {
        e.stopPropagation();
        
        const confirmed = confirm(
          `Are you sure you want to delete this result?\n\n` +
          `Student: ${email}\n` +
          `Test: ${testInfo.text}\n` +
          `Words: ${totalWords} (T1: ${task1Words}, T2: ${task2Words})\n` +
          `Status: ${completionStatus.text}\n` +
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

            await deleteDoc(doc(db, "resultsWriting", docSnap.id));
            
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
                      <div class="no-results-icon">✍️</div>
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
      processedCount++;
    });

    console.log(`✅ Processed ${processedCount} documents successfully`);
    
    // Добавляем обработчик поиска
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = resultsBody.querySelectorAll('tr:not(.no-results tr)');
        
        let visibleCount = 0;
        rows.forEach(row => {
          const emailCell = row.querySelector('.email-cell');
          if (emailCell) {
            const email = emailCell.textContent.toLowerCase();
            const shouldShow = email.includes(searchTerm);
            row.style.display = shouldShow ? '' : 'none';
            if (shouldShow) visibleCount++;
          }
        });
        
        // Показываем сообщение если ничего не найдено
        if (visibleCount === 0 && searchTerm.trim()) {
          const noResultsRow = document.createElement('tr');
          noResultsRow.className = 'search-no-results';
          noResultsRow.innerHTML = `
            <td colspan="6" style="text-align: center; padding: 40px; color: #64748b;">
              <div style="font-size: 48px; margin-bottom: 20px;">🔍</div>
              <h3>No Results Found</h3>
              <p>No results match "<strong>${searchTerm}</strong>"</p>
            </td>
          `;
          
          // Удаляем предыдущее сообщение о поиске
          const existingNoResults = resultsBody.querySelector('.search-no-results');
          if (existingNoResults) {
            existingNoResults.remove();
          }
          
          resultsBody.appendChild(noResultsRow);
        } else {
          // Удаляем сообщение о поиске если что-то найдено
          const searchNoResults = resultsBody.querySelector('.search-no-results');
          if (searchNoResults) {
            searchNoResults.remove();
          }
        }
      });
    }
    
    // Анимация появления строк
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
            <p>There was an error loading the writing test results.</p>
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