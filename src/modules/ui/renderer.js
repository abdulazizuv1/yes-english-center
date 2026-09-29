/**
 * UI Renderer Module
 * Handles rendering of data cards with animations
 * @module ui/renderer
 */
import { getCurrentLanguage } from '../language/language.js?v=20260929';
import { mountMarquee } from './marquee.js?v=20260929';

/** Text from Firestore goes into HTML: never let it become markup. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** IELTS bands are written with one decimal: 7.0, 7.5. */
function formatBand(band) {
  const n = Number(band);
  return Number.isFinite(n) ? n.toFixed(1) : String(band ?? '');
}

/** A label in the visitor's language, for cards drawn after the page was translated. */
function translated(key, fallback) {
  const entry = window.langArr && window.langArr[key];
  return (entry && entry[getCurrentLanguage()]) || fallback;
}

/**
 * Lazy load image with Intersection Observer
 * @param {HTMLImageElement} img - Image element
 * @param {string} src - Image source URL
 */
function setupLazyLoading(img, src) {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const targetImg = entry.target;
        targetImg.src = src;
        targetImg.onload = () => {
          targetImg.style.opacity = "1";
        };
        imageObserver.unobserve(targetImg);
      }
    });
  }, {
    rootMargin: '50px',
    threshold: 0.01
  });
  
  imageObserver.observe(img);
}

/**
 * Load image with CORS handling and fallback
 * @param {HTMLImageElement} imgElement - Image element
 * @param {string} originalUrl - Original image URL
 */
export function loadImageWithCorsHandling(imgElement, originalUrl) {
  imgElement.src = originalUrl;
  
  imgElement.onload = () => {
    imgElement.style.opacity = "1";
  };
  
  imgElement.onerror = () => {
    // Try adding alt=media
    if (!originalUrl.includes('alt=media')) {
      const newUrl = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'alt=media';
      imgElement.src = newUrl;
      
      imgElement.onload = () => imgElement.style.opacity = "1";
      imgElement.onerror = () => {
        // Fallback image
        imgElement.src = './image/placeholder.svg';
        imgElement.style.opacity = "1";
      };
    } else {
      // Fallback image
      imgElement.src = './image/placeholder.svg';
      imgElement.style.opacity = "1";
    }
  };
}

/** Initials for an avatar: "Abdulaziz Valiyev" -> "AV". */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '•';
}

const icon = (name, extra = '') =>
  `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/**
 * Render groups cards
 * @param {Array} groups - Array of group objects
 * @param {HTMLElement} wrapper - Wrapper element
 */
export function renderGroups(groups, wrapper) {
  if (!wrapper) {
    return;
  }

  wrapper.innerHTML = '';
  wrapper.classList.add('loaded');

  groups.forEach((group) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide group-slide";
    slide.innerHTML = `
      <div class="group-photo">
        <img
          data-src="${escapeHtml(group.photoURL)}"
          alt="${escapeHtml(group.name || 'Group photo')}"
          loading="lazy"
          width="400"
          height="300"
          style="opacity: 0;"
        />
      </div>
      <h3 class="group-title">${escapeHtml(group.name)}</h3>
    `;
    setupLazyLoading(slide.querySelector("img"), group.photoURL);
    wrapper.appendChild(slide);
  });
}

/**
 * Render results as the continuous strip (see ui/marquee.js)
 * @param {Array} results - Array of result objects
 * @param {HTMLElement} track - The .results-track element
 */
export function renderResults(results, track) {
  if (!track) {
    return;
  }

  // Only the "Group:" label is translated. The class used to sit on the
  // whole line, so every translation pass replaced the student's real group
  // with a fixed "Group: IELTS". Values are escaped: admins edit them.
  const cards = results.map((result) => {
    const band = formatBand(result.band);
    const card = document.createElement("figure");
    card.className = "result-card";
    card.setAttribute("role", "listitem");
    card.dataset.name = result.name || '';
    card.dataset.band = band;
    card.dataset.group = result.group || '';
    card.innerHTML = `
      <button type="button" class="result-photo" aria-label="${escapeHtml(`${result.name || 'Student'} — IELTS ${band}. Open the certificate`)}">
        <img src="${escapeHtml(result.photoURL || './image/placeholder.svg')}" alt="" loading="lazy" decoding="async" width="300" height="375">
        <span class="result-band"><small>IELTS</small>${escapeHtml(band)}</span>
        <span class="result-zoom-hint">${icon('zoom-in')}</span>
      </button>
      <figcaption class="result-meta">
        <h3 class="result-name">${escapeHtml(result.name)}</h3>
        <p class="result-group"><span class="lng_results_group">${escapeHtml(translated('lng_results_group', 'Group:'))}</span> ${escapeHtml(result.group)}</p>
      </figcaption>
    `;
    return card;
  });

  track.classList.add('loaded');
  mountMarquee(track, cards);
}

/**
 * Render feedbacks cards
 * @param {Array} feedbacks - Array of feedback objects
 * @param {HTMLElement} wrapper - Wrapper element
 */
export function renderFeedbacks(feedbacks, wrapper) {
  if (!wrapper) {
    return;
  }

  wrapper.innerHTML = '';
  wrapper.classList.add('loaded');

  // The student's own words, as written. (The text used to carry a
  // translation class, so switching language replaced every review with the
  // same stock paragraph.)
  feedbacks.forEach((feedback) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide feedback-slide";
    slide.innerHTML = `
      ${icon('quote', 'feedback-quote')}
      <div class="feedback-body">
        <p class="feedback-text">${escapeHtml(feedback.feedback)}</p>
      </div>
      <button type="button" class="feedback-more" hidden>
        <span class="feedback-more-label">${escapeHtml(translated('lng_read_more', 'Read more'))}</span>
      </button>
      <div class="feedback-author">
        <span class="feedback-avatar" aria-hidden="true">${escapeHtml(initials(feedback.name))}</span>
        <div class="feedback-who">
          <h3>${escapeHtml(feedback.name)}</h3>
          <p><span class="lng_feedbacks_group">${escapeHtml(translated('lng_feedbacks_group', 'Group:'))}</span> ${escapeHtml(feedback.group)}</p>
        </div>
      </div>
    `;
    wrapper.appendChild(slide);
  });

  // long reviews are cut to a few lines; offer the rest only where it is cut
  requestAnimationFrame(() => {
    wrapper.querySelectorAll('.feedback-slide').forEach((slide) => {
      const text = slide.querySelector('.feedback-text');
      const more = slide.querySelector('.feedback-more');
      if (text.scrollHeight > text.clientHeight + 2) {
        more.hidden = false;
        more.addEventListener('click', () => {
          const open = slide.classList.toggle('expanded');
          more.querySelector('.feedback-more-label').textContent =
            open ? translated('lng_show_less', 'Show less') : translated('lng_read_more', 'Read more');
          more.setAttribute('aria-expanded', String(open));
        });
        more.setAttribute('aria-expanded', 'false');
      }
    });
  });
}

/**
 * Render all data to respective sections
 * @param {Object} data - Object containing groups, results, and feedbacks arrays
 */
export function renderAll(data) {
  if (data.groups) {
    const groupsWrapper = document.querySelector("#groups .swiper-wrapper");
    renderGroups(data.groups, groupsWrapper);
  }

  if (data.results) {
    renderResults(data.results, document.querySelector("#results .results-track"));
  }

  if (data.feedbacks) {
    const feedbacksWrapper = document.querySelector("#feedbacks .swiper-wrapper");
    renderFeedbacks(data.feedbacks, feedbacksWrapper);
  }

}

export default {
  renderGroups,
  renderResults,
  renderFeedbacks,
  renderAll,
  loadImageWithCorsHandling
};

