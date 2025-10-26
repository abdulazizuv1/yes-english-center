/**
 * UI Renderer Module
 * Handles rendering of data cards with animations
 * @module ui/renderer
 */

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
    console.warn('Failed to load image:', originalUrl);
    
    // Try adding alt=media
    if (!originalUrl.includes('alt=media')) {
      const newUrl = originalUrl + (originalUrl.includes('?') ? '&' : '?') + 'alt=media';
      imgElement.src = newUrl;
      
      imgElement.onload = () => imgElement.style.opacity = "1";
      imgElement.onerror = () => {
        // Fallback image
        imgElement.src = './image/placeholder.svg';
        imgElement.style.opacity = "1";
        console.error('All loading attempts failed for:', originalUrl);
      };
    } else {
      // Fallback image
      imgElement.src = './image/placeholder.svg';
      imgElement.style.opacity = "1";
    }
  };
}

/**
 * Render groups cards
 * @param {Array} groups - Array of group objects
 * @param {HTMLElement} wrapper - Wrapper element
 */
export function renderGroups(groups, wrapper) {
  if (!wrapper) {
    console.error('Groups wrapper not found');
    return;
  }

  // Clear existing content
  wrapper.innerHTML = '';
  wrapper.classList.add('loaded');

  groups.forEach((group, index) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide1";
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";
    
    slide.innerHTML = `
      <div class="image-placeholder">
        <img 
          data-src="${group.photoURL}" 
          alt="${group.name}"
          loading="lazy"
          style="opacity: 0; transition: opacity 0.3s ease;"
        />
      </div>
      <h3>${group.name}</h3>
    `;

    const img = slide.querySelector("img");
    setupLazyLoading(img, group.photoURL);
    
    wrapper.appendChild(slide);
    
    // Staggered animation
    setTimeout(() => {
      slide.style.transition = "all 0.5s ease-out";
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, index * 100);
  });

  console.log(`✅ Rendered ${groups.length} groups`);
}

/**
 * Render results cards
 * @param {Array} results - Array of result objects
 * @param {HTMLElement} wrapper - Wrapper element
 */
export function renderResults(results, wrapper) {
  if (!wrapper) {
    console.error('Results wrapper not found');
    return;
  }

  // Clear existing content
  wrapper.innerHTML = '';
  wrapper.classList.add('loaded');

  results.forEach((result, index) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide3";
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";

    slide.innerHTML = `
      <img 
        alt="${result.name}"
        loading="lazy"
        style="opacity: 0; transition: opacity 0.3s ease;"
      />
      <h3>${result.name}</h3>
      <p>Band: <a>${result.band}</a></p>
      <p class="lng_results_group">Group: ${result.group}</p>
    `;

    const img = slide.querySelector("img");
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImageWithCorsHandling(img, result.photoURL);
          imageObserver.unobserve(img);
        }
      });
    });
    
    imageObserver.observe(img);
    wrapper.appendChild(slide);
    
    // Staggered animation
    setTimeout(() => {
      slide.style.transition = "all 0.5s ease-out";
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, index * 100);
  });

  console.log(`✅ Rendered ${results.length} results`);
}

/**
 * Render feedbacks cards
 * @param {Array} feedbacks - Array of feedback objects
 * @param {HTMLElement} wrapper - Wrapper element
 */
export function renderFeedbacks(feedbacks, wrapper) {
  if (!wrapper) {
    console.error('Feedbacks wrapper not found');
    return;
  }

  // Clear existing content
  wrapper.innerHTML = '';
  wrapper.classList.add('loaded');

  feedbacks.forEach((feedback, index) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide swiper-slide2";
    slide.style.opacity = "0";
    slide.style.transform = "translateY(20px)";

    slide.innerHTML = `
      <div class="feedback_info">
        <img src="./image/no_user.webp" alt="" loading="lazy"> 
        <div class="feedback_info_detail">
          <h3>${feedback.name}</h3> 
          <p class="lng_feedbacks_group">Group: ${feedback.group}</p>
        </div>
      </div>
      <div class="text-container">
        <p class="text-content lng_feedbacks">${feedback.feedback}</p>
      </div>
    `;

    wrapper.appendChild(slide);
    
    // Staggered animation
    setTimeout(() => {
      slide.style.transition = "all 0.5s ease-out";
      slide.style.opacity = "1";
      slide.style.transform = "translateY(0)";
    }, index * 100);
  });

  console.log(`✅ Rendered ${feedbacks.length} feedbacks`);
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
    const resultsWrapper = document.querySelector("#results .swiper-wrapper");
    renderResults(data.results, resultsWrapper);
  }

  if (data.feedbacks) {
    const feedbacksWrapper = document.querySelector("#feedbacks .swiper-wrapper");
    renderFeedbacks(data.feedbacks, feedbacksWrapper);
  }

  console.log('✅ All data rendered');
}

export default {
  renderGroups,
  renderResults,
  renderFeedbacks,
  renderAll,
  loadImageWithCorsHandling
};

