// Full mock entry: auth, test loading, PIN gate — everything else lives
// in js/ modules (state, stages, listening, reading, writing, results...).
import { state } from "./js/state.js";
import { auth, db, doc, getDoc, onAuthStateChanged } from "./js/firebase.js";
import { loadSavedState } from "./js/storage.js";
import { initializeHighlightSystem } from "./js/highlights.js";
import { initializeStage, setupStageControls } from "./js/stages.js";
import { setupAnswerCapture } from "./js/answers.js";

setupAnswerCapture();
setupStageControls();

// Authentication check
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("Please log in to take the test.");
    window.location.href = "/login.html";
    return;
  }
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    state.isAdmin = userDoc.exists() && userDoc.data().role === "admin";
  } catch (e) {
    state.isAdmin = false;
  }
  loadTest();
});

// Load test function
async function loadTest() {
  try {
    // Получить testId из URL параметров
    const urlParams = new URLSearchParams(window.location.search);
    state.currentTestId = urlParams.get("testId") || "test-1";
    state.testStorageKey = `fullmockTest_${state.currentTestId}`;
    
    
    // Load saved state
    loadSavedState();
    
    const docRef = doc(db, "fullmockTests", state.currentTestId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error("❌ Test document not found");
      return;
    }

    state.testData = docSnap.data();

    // If the test is PIN-protected, require correct PIN before initializing stages
    // Prompt with custom UI modal on every entry
    const requiredPin = state.testData.accessPin ? String(state.testData.accessPin).trim() : "";
    if (requiredPin) {
      const isValid = await verifyPinUI(requiredPin);
      if (!isValid) return; // verifyPinUI handles redirection on cancel
    }

    // Extract stage data
    state.testData.stages.forEach((stage) => {
      state.stageData[stage.id] = stage;
    });


    // Initialize highlight system
    initializeHighlightSystem();

    // Start with saved stage or listening
    initializeStage(state.savedStage || "listening");
  } catch (error) {
    console.error("❌ Error loading test:", error);
  }
}

// Global PIN Verification UI logic
function verifyPinUI(requiredPin) {
  return new Promise((resolve) => {
    const modal = document.getElementById('pinModal');
    const inputs = document.querySelectorAll('.pin-digit');
    const submitBtn = document.getElementById('submitPinBtn');
    const cancelBtn = document.getElementById('cancelPinBtn');
    const errorMsg = document.getElementById('pinErrorMsg');

    if (!modal) {
      // Fallback if modal isn't loaded
      const entered = prompt("This test is protected. Enter the 6-digit access PIN:");
      if (entered && entered.trim() === requiredPin) resolve(true);
      else {
        window.location.href = "/pages/dashboard/#/fullmock";
        resolve(false);
      }
      return;
    }
    
    modal.style.display = 'flex';
    inputs.forEach(i => i.value = ''); // clear initial
    errorMsg.textContent = '';
    
    // Auto-focus first input slightly later to ensure modal is visible
    setTimeout(() => inputs[0].focus(), 50);

    // Setup input behaviors (only run once)
    if (!modal.dataset.initialized) {
      inputs.forEach((input, index) => {
        // handle paste
        if (index === 0) {
          input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').substring(0, 6);
            for(let i = 0; i < pasted.length; i++) {
               if(inputs[i]) {
                  inputs[i].value = pasted[i];
                  if(i < 5) inputs[i+1].focus();
               }
            }
            if (pasted.length === 6) submitBtn.click();
          });
        }
        
        input.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/\D/g, ''); // digits only
          if (e.target.value && index < 5) {
            inputs[index + 1].focus();
          }
        });
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !e.target.value && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
          } else if (e.key === 'Enter') {
            submitBtn.click();
          }
        });
        
        // Focus styling
        input.addEventListener('focus', () => input.style.borderColor = '#3b82f6');
        input.addEventListener('blur', () => input.style.borderColor = '#e2e8f0');
      });
      modal.dataset.initialized = 'true';
    }

    const finish = (result) => {
      modal.style.display = 'none';
      resolve(result);
    };

    submitBtn.onclick = () => {
      const entered = Array.from(inputs).map(i => i.value).join('');
      if (entered.length < 6) {
        errorMsg.textContent = 'Please enter all 6 digits.';
        return;
      }
      
      if (entered === requiredPin) {
        finish(true);
      } else {
        errorMsg.textContent = 'Incorrect PIN. Please try again.';
        inputs.forEach(i => i.value = '');
        inputs[0].focus();
      }
    };

    cancelBtn.onclick = () => {
      window.location.href = "/pages/dashboard/#/fullmock";
      finish(false);
    };
  });
}

window.openReview = function () {
  alert(
    "Review functionality - showing all answers and flagged questions for current stage"
  );
};

// Initialize everything when page loads
window.onload = () => {
};
