/**
 * Language Module
 * Handles language switching and translations
 * @module language/language
 */

const ALL_LANGUAGES = ["en", "ru", "uz"];
const DEFAULT_LANGUAGE = "en";

let langChangeTimeout = null;

/**
 * Get current language from URL hash
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  let hash = window.location.hash;
  hash = hash.substr(1);
  
  if (ALL_LANGUAGES.includes(hash)) {
    return hash;
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * Set language in URL hash
 * @param {string} lang - Language code
 */
export function setLanguage(lang) {
  if (!ALL_LANGUAGES.includes(lang)) {
    console.warn(`Invalid language: ${lang}, using default: ${DEFAULT_LANGUAGE}`);
    lang = DEFAULT_LANGUAGE;
  }
  
  location.href = window.location.pathname + "#" + lang;
  location.reload();
}

/**
 * Update all language selectors
 * @param {string} lang - Language code
 */
function updateLanguageSelectors(lang) {
  const selects = document.querySelectorAll(".lang_change");
  selects.forEach(select => {
    select.value = lang;
  });
}

/**
 * Apply translations to page elements
 * @param {string} lang - Language code
 */
function applyTranslations(lang) {
  if (typeof window.langArr === 'undefined') {
    console.warn('Language translations not loaded');
    return;
  }

  requestAnimationFrame(() => {
    for (let key in window.langArr) {
      const elements = document.querySelectorAll(`.${key}`);
      if (elements.length > 0) {
        elements.forEach((elem) => {
          elem.innerHTML = window.langArr[key][lang];
        });
      }
    }
  });

  console.log(`🌐 Translations applied: ${lang}`);
}

/**
 * Change language with debounce
 * @param {HTMLSelectElement} select - Language select element
 */
function changeLanguage(select) {
  clearTimeout(langChangeTimeout);
  langChangeTimeout = setTimeout(() => {
    const lang = select.value;
    setLanguage(lang);
  }, 100);
}

/**
 * Initialize language on page load
 */
export function initLanguageOnLoad() {
  let currentLang = getCurrentLanguage();
  
  // Redirect to default if invalid
  if (!ALL_LANGUAGES.includes(currentLang)) {
    location.href = window.location.pathname + "#" + DEFAULT_LANGUAGE;
    location.reload();
    return;
  }
  
  // Update selectors
  updateLanguageSelectors(currentLang);
  
  // Apply translations
  applyTranslations(currentLang);
  
  console.log(`✅ Language initialized: ${currentLang}`);
}

/**
 * Initialize language switchers
 */
export function initLanguageSwitchers() {
  const selects = document.querySelectorAll(".lang_change");
  
  if (selects.length === 0) {
    console.warn('No language selectors found');
    return;
  }

  // Add change listeners
  selects.forEach(select => {
    select.addEventListener("change", () => changeLanguage(select));
  });

  // Sync all selectors when one changes
  selects.forEach(select => {
    select.addEventListener('change', function() {
      const selectedLang = this.value;
      selects.forEach(otherSelect => {
        if (otherSelect !== this) {
          otherSelect.value = selectedLang;
        }
      });
    });
  });

  console.log('✅ Language switchers initialized');
}

/**
 * Get available languages
 * @returns {string[]}
 */
export function getAvailableLanguages() {
  return [...ALL_LANGUAGES];
}

/**
 * Check if language is supported
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isLanguageSupported(lang) {
  return ALL_LANGUAGES.includes(lang);
}

/**
 * Get language name
 * @param {string} code - Language code
 * @returns {string}
 */
export function getLanguageName(code) {
  const names = {
    en: 'English',
    ru: 'Русский',
    uz: 'O\'zbekcha'
  };
  return names[code] || code;
}

export default {
  getCurrentLanguage,
  setLanguage,
  initLanguageOnLoad,
  initLanguageSwitchers,
  getAvailableLanguages,
  isLanguageSupported,
  getLanguageName
};

