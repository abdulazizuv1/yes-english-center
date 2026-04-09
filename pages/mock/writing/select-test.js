import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { firebaseConfig } from "/config.js";


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();


function extractNumber(str) {
  // Ищем первое число в строке
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

async function loadWritingTests() {
  try {
    console.log("🔥 Loading writing tests from Firestore...");
    console.log("📍 Current path:", window.location.href);

    // Убираем orderBy - он может вызывать ошибку
    const querySnapshot = await getDocs(collection(db, "writingTests"));

    console.log("📊 Query result:", querySnapshot.size, "documents");

    const testsGrid = document.getElementById("testsGrid");
    testsGrid.innerHTML = "";

    if (querySnapshot.empty) {
      console.log("⚠️ No documents found in writingTests collection");
      testsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: white;">
                    <h3>📝 No Writing Tests Available</h3>
                    <p>Writing tests will be available soon. Please check back later.</p>
                </div>
            `;
      return;
    }

    // Собираем все тесты в массив для сортировки
    const tests = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`✅ Found test: ${doc.id}`, data);
      tests.push({
        id: doc.id,
        data: data,
      });
    });

    // Сортируем по testId
    // Сортируем по числовой части testId
    tests.sort((a, b) => {
      const aId = a.data.testId || a.data.title || a.id;
      const bId = b.data.testId || b.data.title || b.id;

      // Извлекаем числа из строк
      const aNumber = extractNumber(aId);
      const bNumber = extractNumber(bId);

      return aNumber - bNumber;
    });

    // Создаем карточки
    tests.forEach((test, index) => {
      const testCard = createTestCard(test.id, test.data, index + 1);
      testsGrid.appendChild(testCard);
    });

    // Add animations
    const cards = testsGrid.querySelectorAll(".test-card");
    cards.forEach((card, index) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      setTimeout(() => {
        card.style.transition = "all 0.5s ease";
        card.style.opacity = "1";
        card.style.transform = "translateY(0)";
      }, index * 150);
    });

    console.log(`✅ Successfully loaded ${tests.length} writing tests`);
  } catch (error) {
    console.error("❌ Detailed error:", error);
    console.error("❌ Error code:", error.code);
    console.error("❌ Error message:", error.message);
    console.error("❌ Full error object:", JSON.stringify(error, null, 2));

    document.getElementById("testsGrid").innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: white;">
                <h3>❌ Error Loading Tests</h3>
                <p>Error: ${error.message}</p>
                <p style="font-size: 12px; opacity: 0.8; margin-top: 10px;">Code: ${
                  error.code || "Unknown"
                }</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: white; color: #059669; border: none; border-radius: 8px; cursor: pointer;">
                    🔄 Retry
                </button>
            </div>
        `;
  }
}

function createTestCard(testId, data, number) {
  const card = document.createElement("div");
  card.className = "test-card";

  console.log(`🎨 Creating card for test: ${testId}`, data);

  // Extract task previews safely
  const task1Preview = data.task1?.question
    ? data.task1.question.substring(0, 80) + "..."
    : "Chart/Graph description task";

  const task2Preview = data.task2?.question
    ? data.task2.question.substring(0, 80) + "..."
    : "Essay writing task";

  // Get test title safely
  const testTitle = data.title || `Writing Test ${number}`;

  card.innerHTML = `
        <div class="test-header">
            <div class="test-icon">✍️</div>
            <div class="test-badge">Academic</div>
        </div>
        
        <h3 class="test-title">${testTitle}</h3>
        
        <div class="test-description">
            Complete two writing tasks: describe visual data and write an argumentative essay.
        </div>
        
        <div class="test-features">
            <div class="feature-item">
                <span class="feature-icon">📊</span>
                <span>Task 1: ${task1Preview}</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">📝</span>
                <span>Task 2: ${task2Preview}</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">⏱️</span>
                <span>60 minutes total (20 + 40 minutes)</span>
            </div>
            <div class="feature-item">
                <span class="feature-icon">📧</span>
                <span>Results sent via telegram to your teacher</span>
            </div>
        </div>
        
        <div class="test-stats">
            <div class="stat-item">
                <span class="stat-number">2</span>
                <span class="stat-label">Tasks</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">400+</span>
                <span class="stat-label">Min Words</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">60</span>
                <span class="stat-label">Minutes</span>
            </div>
        </div>
        
        <button class="start-btn" onclick="startTest('${testId}')">
            ✍️ Start Writing Test
        </button>
    `;

  return card;
}

// Global function for starting tests
window.startTest = function (testId) {
  console.log(`🚀 Starting writing test: ${testId}`);
  window.location.href = `test.html?testId=${testId}`;
};

// Initialize on page load
window.addEventListener("load", async () => {
  console.log("🌐 Page loaded, initializing...");

  // Check authentication
  const user = await new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      resolve(u);
    });
  });

  console.log(
    "👤 User authentication:",
    user ? "✅ Logged in" : "❌ Not logged in"
  );

  if (!user) {
    alert("🔒 Please login first to access writing tests");
    window.location.href = "/";
    return;
  }

  await loadWritingTests();
});
