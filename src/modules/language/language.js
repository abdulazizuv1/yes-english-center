/**
 * Language Module
 * Handles language switching and translations
 * @module language/language
 */

const ALL_LANGUAGES = ["en", "ru", "uz"];
const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "yes-language";

let langChangeTimeout = null;

/**
 * Get current language from URL hash
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  // 1) Prefer stored value
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ALL_LANGUAGES.includes(stored)) {
    return stored;
  }

  // 2) Fallback to URL hash
  const hash = window.location.hash.replace("#", "");
  if (ALL_LANGUAGES.includes(hash)) {
    // persist for future loads
    localStorage.setItem(STORAGE_KEY, hash);
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
    lang = DEFAULT_LANGUAGE;
  }

  localStorage.setItem(STORAGE_KEY, lang);

  // keep hash for backward compatibility
  const newUrl = `${window.location.pathname}#${lang}`;
  if (window.location.href !== newUrl) {
    window.location.replace(newUrl);
  }

  // apply immediately without hard reload
  updateLanguageSelectors(lang);
  applyTranslations(lang);
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

  // Fallback to default and persist if invalid
  if (!ALL_LANGUAGES.includes(currentLang)) {
    currentLang = DEFAULT_LANGUAGE;
    localStorage.setItem(STORAGE_KEY, currentLang);
  }

  // Keep hash in sync
  const expectedHash = `#${currentLang}`;
  if (window.location.hash !== expectedHash) {
    window.location.replace(`${window.location.pathname}${expectedHash}`);
  }

  updateLanguageSelectors(currentLang);
  applyTranslations(currentLang);
}

/**
 * Initialize language switchers
 */
export function initLanguageSwitchers() {
  const selects = document.querySelectorAll(".lang_change");
  
  if (selects.length === 0) {
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

