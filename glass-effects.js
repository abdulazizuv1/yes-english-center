const glassStyles = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    @keyframes glassShine {
        0% { transform: translateX(-100%) skewX(-15deg); }
        100% { transform: translateX(200%) skewX(-15deg); }
    }
    
    .glass-shine {
        position: relative;
        overflow: hidden;
    }
    
    .glass-shine::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: glassShine 2s infinite;
    }
    
    .menu-open {
        overflow: hidden;
    }
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = glassStyles;
document.head.appendChild(styleSheet);

// Mobile Menu Functions (работают с вашим main.js)
window.toggleMobileMenu = function() {
    const toggle = document.querySelector('.glass-toggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const body = document.body;
    
    toggle.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    body.classList.toggle('menu-open');
};

window.closeMobileMenu = function() {
    const toggle = document.querySelector('.glass-toggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const body = document.body;
    
    toggle.classList.remove('active');
    mobileMenu.classList.remove('active');
    body.classList.remove('menu-open');
};

// Login/Logout Functions (работают с Firebase от main.js)
window.toggleLogin = function() {
    const loginPanel = document.querySelector('.login_panel');
    if (loginPanel) {
        loginPanel.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus на email input
        setTimeout(() => {
            const emailInput = document.querySelector('#login_email');
            if (emailInput) emailInput.focus();
        }, 100);
    }
};

window.closeLogin = function() {
    const loginPanel = document.querySelector('.login_panel');
    if (loginPanel) {
        loginPanel.style.display = 'none';
        document.body.style.overflow = '';
    }
};

// Enhanced Mobile Menu Functions (интегрированы с вашим main.js)
window.toggleMenu = function() {
    const nav = document.querySelector("nav");
    const navRight = document.querySelector(".nav_right");
    const hamburger = document.querySelector(".glass-toggle");
    
    nav.classList.toggle("active");
    hamburger.classList.toggle("active");
    
    if (nav.classList.contains("active")) {
        navRight.style.display = "flex";
        document.body.style.overflow = 'hidden';
    } else {
        setTimeout(() => {
            navRight.style.display = "none";
            document.body.style.overflow = '';
        }, 300);
    }
};

// Glass Effects Initialization
document.addEventListener('DOMContentLoaded', function() {
    
    // Parallax effect for background blurs
    function updateParallax() {
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.bg-blur');
        
        parallaxElements.forEach((element, index) => {
            const speed = 0.1 + (index * 0.05);
            element.style.transform = `translateY(${scrolled * speed}px)`;
        });
    }
    
    // Smooth parallax with RAF
    let ticking = false;
    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', requestTick);
    
    // Glass element hover effects
    const glassElements = document.querySelectorAll('.glass-morphism, .glass-btn, .glass-feature, .glass-stat');
    
    glassElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.02)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // Advanced ripple effect
    function createRipple(event, element) {
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.4);
            transform: scale(0);
            animation: ripple 0.6s linear;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
            pointer-events: none;
        `;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
    
    // Add ripple to buttons
    const rippleButtons = document.querySelectorAll('.glass-btn, .glass-btn-primary, .glass-cta, .glass-btn-nav');
    rippleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            createRipple(e, this);
        });
    });
    
    // Dynamic navbar blur on scroll
    const navbar = document.querySelector('.glass-nav');
    if (navbar) {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const blurValue = Math.min(scrolled / 10, 20);
            navbar.style.backdropFilter = `blur(${blurValue}px)`;
        });
    }
    
    // Intersection Observer for glass cards animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe all swiper slides when they're added
    const observeSlides = () => {
        const slides = document.querySelectorAll('.swiper-slide');
        slides.forEach(slide => {
            slide.style.opacity = '0';
            slide.style.transform = 'translateY(30px)';
            slide.style.transition = 'all 0.6s ease-out';
            observer.observe(slide);
        });
    };
    
    // Call after swiper initialization
    setTimeout(observeSlides, 1000);
    
    // Glass particle animation
    function animateParticles() {
        const particles = document.querySelectorAll('.particle');
        particles.forEach((particle, index) => {
            const time = Date.now() * 0.001;
            const x = Math.sin(time + index) * 50;
            const y = Math.cos(time + index * 0.5) * 30;
            particle.style.transform = `translate(${x}px, ${y}px)`;
        });
        
        requestAnimationFrame(animateParticles);
    }
    
    animateParticles();
    
    // Glass morphism intensity based on scroll
    window.addEventListener('scroll', () => {
        const scrollPercent = window.pageYOffset / (document.body.offsetHeight - window.innerHeight);
        const intensity = 10 + (scrollPercent * 10);
        
        const glassCards = document.querySelectorAll('.swiper-slide');
        glassCards.forEach(card => {
            card.style.backdropFilter = `blur(${intensity}px)`;
        });
    });
    
    // Mock redirect handled centrally in main.js
});

// Event Handlers for Mobile Menu
document.addEventListener('click', function(event) {
    const mobileMenu = document.getElementById('mobileMenu');
    const toggle = document.querySelector('.glass-toggle');
    const nav = document.querySelector('nav');
    
    // Close mobile menu when clicking outside
    if (mobileMenu && mobileMenu.classList.contains('active')) {
        if (!nav.contains(event.target)) {
            closeMobileMenu();
        }
    }
    
    // Close login panel when clicking outside
    const loginPanel = document.querySelector('.login_panel');
    const login = document.querySelector('.login');
    
    if (loginPanel && loginPanel.style.display === 'flex') {
        if (event.target === loginPanel) {
            closeLogin();
        }
    }
});

// Close mobile menu on window resize to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        closeMobileMenu();
    }
});

// Handle escape key for mobile menu and login
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeMobileMenu();
        closeLogin();
    }
});

// Active link management (работает с вашей навигацией)
document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-glass-item');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            navLinks.forEach(el => el.classList.remove('active'));
            // Add active class to clicked link
            this.classList.add('active');
            
            // Close mobile menu when link is clicked
            closeMobileMenu();
        });
    });
    
    // Set default active link on load
    function setDefaultActiveOnLoad() {
        const hash = window.location.hash;
        if (!hash || hash === "#home" || hash === "#en" || hash === "#ru" || hash === "#uz") {
            const homeLinks = document.querySelectorAll('.lng_nav_home');
            homeLinks.forEach(link => {
                if (link.classList.contains('nav-glass-item')) {
                    link.classList.add('active');
                }
            });
        }
    }
    
    setDefaultActiveOnLoad();
});

// Enhanced Login Panel Functions (интегрированы с main.js)
function initLoginPanel() {
    const closeBtn = document.querySelector(".close_btn");
    const loginPanel = document.querySelector(".login_panel");
    
    if (closeBtn) {
        closeBtn.addEventListener("click", () => {
            closeLogin();
        });
    }

    if (loginPanel) {
        loginPanel.addEventListener("click", (e) => {
            if (e.target === loginPanel) {
                closeLogin();
            }
        });
    }
}

// Initialize login panel when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initLoginPanel();
});

// Function to update UI after Firebase authentication (вызывается из main.js)
window.updateAuthUI = function(user, userData = null) {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const settingsLinks = document.querySelectorAll('.settings-link');
    
    if (user) {
        // User is logged in
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'block';
            logoutBtn.textContent = 'Logout';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'none';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'block';
            mobileLogoutBtn.textContent = 'Logout';
        }
        
        // Show/hide settings based on role
        const isAdmin = userData && userData.role === 'admin';
        settingsLinks.forEach(link => {
            if (link) {
                link.style.display = isAdmin ? 'block' : 'none';
            }
        });
        
    } else {
        // User is not logged in
        if (loginBtn) {
            loginBtn.style.display = 'block';
            loginBtn.textContent = 'Login';
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'block';
            mobileLoginBtn.textContent = 'Login';
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.style.display = 'none';
        }
        
        // Hide settings
        settingsLinks.forEach(link => {
            if (link) {
                link.style.display = 'none';
            }
        });
        
        console.log('❌ User not authenticated, UI updated');
    }
};

// Optimized click outside handler with throttling (для старого меню, если нужно)
let clickOutsideTimeout;
function handleClickOutside(e) {
    clearTimeout(clickOutsideTimeout);
    clickOutsideTimeout = setTimeout(() => {
        const nav = document.querySelector("nav");
        const toggle = document.querySelector(".toggle");
        
        if (nav && nav.classList.contains("active")) {
            if (!nav.contains(e.target) && toggle && !toggle.contains(e.target)) {
                nav.classList.remove("active");
                const navInfo = document.querySelector(".nav_info");
                const navRight = document.querySelector(".nav_right");
                if (navInfo) navInfo.style.display = "none";
                if (navRight) navRight.style.display = "none";
            }
        }
    }, 10);
}

// Debounced resize handler
let resizeTimeout;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (window.innerWidth > 768) {
            const nav = document.querySelector("nav");
            const navInfo = document.querySelector(".nav_info");
            const navRight = document.querySelector(".nav_right");
            
            if (nav && nav.classList.contains("active")) {
                nav.classList.remove("active");
                if (navInfo) navInfo.style.display = "";
                if (navRight) navRight.style.display = "";
            }
            
            // Also close mobile menu
            closeMobileMenu();
        }
    }, 250);
});

// Language switcher enhancement (работает с lang.js)
document.addEventListener('DOMContentLoaded', function() {
    const langSelects = document.querySelectorAll('.lang_change');
    
    langSelects.forEach(select => {
        select.addEventListener('change', function() {
            // Sync all language selectors
            const selectedLang = this.value;
            langSelects.forEach(otherSelect => {
                if (otherSelect !== this) {
                    otherSelect.value = selectedLang;
                }
            });
        });
    });
});

// Enhanced glass effects for buttons
document.addEventListener('DOMContentLoaded', function() {
    // Add glass shine effect to buttons on hover
    const glassButtons = document.querySelectorAll('.glass-btn, .glass-btn-primary, .glass-btn-secondary, .glass-cta');
    
    glassButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.classList.add('glass-shine');
        });
        
        button.addEventListener('mouseleave', function() {
            this.classList.remove('glass-shine');
        });
    });
    
    // Enhanced navbar glass effect
    const navbar = document.querySelector('.glass-nav');
    if (navbar) {
        let lastScrollTop = 0;
        
        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollDirection = scrollTop > lastScrollTop ? 'down' : 'up';
            
            // Dynamic blur based on scroll position and direction
            const blurValue = Math.min(Math.max(scrollTop / 10, 15), 25);
            const opacity = scrollDirection === 'down' ? 0.95 : 0.85;
            
            navbar.style.backdropFilter = `blur(${blurValue}px)`;
            navbar.style.background = `rgba(255, 255, 255, ${opacity})`;
            
            lastScrollTop = scrollTop;
        });
    }
});

// Utility function for smooth scrolling to sections
window.smoothScrollTo = function(targetId) {
    const target = document.querySelector(targetId);
    if (target) {
        const headerOffset = 80; // Account for fixed navbar
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
};

// Enhanced CTA button effects
document.addEventListener('DOMContentLoaded', function() {
    const ctaButtons = document.querySelectorAll('.glass-btn-primary, .glass-cta');
    
    ctaButtons.forEach(button => {
        // Add magnetic effect
        button.addEventListener('mousemove', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            
            const moveX = x * 0.1;
            const moveY = y * 0.1;
            
            this.style.transform = `translate(${moveX}px, ${moveY}px) translateY(-2px) scale(1.02)`;
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translate(0, 0) translateY(0) scale(1)';
        });
    });
});

// Performance optimization for glass effects
function optimizeGlassEffects() {
    // Reduce motion for users who prefer it
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.documentElement.style.setProperty('--transition', 'none');
        
        // Disable particle animations
        const particles = document.querySelectorAll('.particle');
        particles.forEach(particle => {
            particle.style.animation = 'none';
        });
        
        // Disable background blur animations
        const bgBlurs = document.querySelectorAll('.bg-blur');
        bgBlurs.forEach(blur => {
            blur.style.animation = 'none';
        });
    }
}

// Initialize performance optimizations
document.addEventListener('DOMContentLoaded', optimizeGlassEffects);
