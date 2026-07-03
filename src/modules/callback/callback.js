/**
 * Callback Form Module
 * Handles the feedback form submission and sends data to Telegram bot
 * @module callback/callback
 */

// Submissions go through a Cloud Function that formats the message and
// holds the Telegram credentials server-side.
const CONTACT_FORM_URL =
  "https://us-central1-yes-english-center.cloudfunctions.net/submitContactForm";

/**
 * Send form data to the contact-form Cloud Function
 * @param {Object} data - Form data
 * @returns {Promise<boolean>} Success status
 */
async function sendToTelegram(data) {
  try {
    const response = await fetch(CONTACT_FORM_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error("Contact form error:", response.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to submit contact form:", error);
    return false;
  }
}

/**
 * Get form data from the callback form
 * @returns {Object|null} Form data or null if validation fails
 */
function getFormData() {
  const name = document.getElementById("callback_name")?.value?.trim();
  const phone = document.getElementById("callback_phone")?.value?.trim();
  const group = document.getElementById("callback_group")?.value;
  const comment = document.getElementById("callback_comment")?.value?.trim();

  // Validation
  if (!name) return null;
  if (!phone) return null;
  if (!group) return null;

  return { name, phone, group, comment: comment || "" };
}

/**
 * Reset the callback form
 */
function resetForm() {
  const form = document.getElementById("callbackForm");
  if (form) {
    form.reset();
  }
}

/**
 * Set loading state on submit button with spinner
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
function setSubmitLoading(btn, loading) {
  if (!btn) return;

  const span = btn.querySelector("span");
  const shimmer = btn.querySelector(".btn-shimmer");

  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = span?.textContent || "";
    btn.classList.add("is-loading");

    // Hide text & shimmer, show spinner
    if (span) span.style.display = "none";
    if (shimmer) shimmer.style.display = "none";

    // Create spinner if not exists
    if (!btn.querySelector(".callback-spinner")) {
      const spinner = document.createElement("div");
      spinner.className = "callback-spinner";
      btn.appendChild(spinner);
    }
  } else {
    btn.disabled = false;
    btn.classList.remove("is-loading");

    // Remove spinner, show text & shimmer
    const spinner = btn.querySelector(".callback-spinner");
    if (spinner) spinner.remove();
    if (span) {
      span.style.display = "";
      span.textContent = btn.dataset.originalText || "Submit";
    }
    if (shimmer) shimmer.style.display = "";
  }
}

/**
 * Show a temporary notification after form submission
 * @param {string} message
 * @param {boolean} success
 */
function showNotification(message, success = true) {
  // Remove any existing notification
  const existing = document.querySelector(".callback-notification");
  if (existing) existing.remove();

  const notification = document.createElement("div");
  notification.className = "callback-notification";
  notification.style.cssText = `
    position: fixed;
    top: 30px;
    right: 30px;
    padding: 16px 28px;
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    color: white;
    z-index: 9999;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    animation: slideInNotif 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    box-shadow: 0 10px 30px rgba(0,0,0,0.15);
    font-family: "Montserrat", sans-serif;
    background: ${success
      ? "linear-gradient(135deg, #1763e1, #87aaeb)"
      : "linear-gradient(135deg, #e74c3c, #c0392b)"};
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    notification.style.animation = "slideOutNotif 0.3s ease forwards";
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

/**
 * Handle form submission
 */
async function handleSubmit() {
  const data = getFormData();

  if (!data) {
    showNotification("Пожалуйста, заполните все обязательные поля", false);
    return;
  }

  const submitBtn = document.querySelector(".callback-submit");
  setSubmitLoading(submitBtn, true);

  try {
    const success = await sendToTelegram(data);

    if (success) {
      showNotification("✅ Заявка успешно отправлена!");
      resetForm();
    } else {
      showNotification("❌ Ошибка отправки. Попробуйте позже.", false);
    }
  } catch (error) {
    console.error("Callback form error:", error);
    showNotification("❌ Ошибка отправки. Попробуйте позже.", false);
  } finally {
    setSubmitLoading(submitBtn, false);
  }
}

/**
 * Inject dynamic styles for spinner and notifications
 */
function injectStyles() {
  if (document.getElementById("callback-dynamic-styles")) return;

  const style = document.createElement("style");
  style.id = "callback-dynamic-styles";
  style.textContent = `
    /* Spinner inside submit button */
    .callback-spinner {
      width: 24px;
      height: 24px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid #ffffff;
      border-radius: 50%;
      animation: callbackSpin 0.8s linear infinite;
      margin: 0 auto;
    }

    .callback-submit.is-loading {
      opacity: 0.8;
      cursor: not-allowed;
      pointer-events: none;
    }

    @keyframes callbackSpin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Notification animations */
    @keyframes slideInNotif {
      from { transform: translateX(100px); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutNotif {
      from { transform: translateX(0); opacity: 1; }
      to   { transform: translateX(100px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Initialize the callback form module
 */
export function initCallbackForm() {
  const form = document.getElementById("callbackForm");
  if (!form) return;

  // Inject spinner + notification styles
  injectStyles();

  // Listen for form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmit();
  });
}

export default { initCallbackForm };
