// Edit Test Selection Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth animations and interactions
    initializePage();
    
    // Add click handlers for test cards
    addTestCardHandlers();
    
    // Add keyboard navigation support
    addKeyboardNavigation();
});

function initializePage() {
    // Add loading animation
    const testCards = document.querySelectorAll('.test-card');
    
    testCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.6s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

function addTestCardHandlers() {
    const testCards = document.querySelectorAll('.test-card');
    
    testCards.forEach(card => {
        // Add click effect
        card.addEventListener('click', function(e) {
            if (this.classList.contains('coming-soon')) {
                e.preventDefault();
                showComingSoonMessage();
                return;
            }
            
            // Add click animation
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
        
        // Add hover sound effect (optional)
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

function addKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        const testCards = document.querySelectorAll('.test-card.active');
        let currentIndex = -1;
        
        // Find currently focused card
        testCards.forEach((card, index) => {
            if (card === document.activeElement) {
                currentIndex = index;
            }
        });
        
        switch(e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % testCards.length;
                testCards[nextIndex].focus();
                break;
                
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex <= 0 ? testCards.length - 1 : currentIndex - 1;
                testCards[prevIndex].focus();
                break;
                
            case 'Enter':
            case ' ':
                if (currentIndex >= 0) {
                    e.preventDefault();
                    testCards[currentIndex].click();
                }
                break;
        }
    });
    
    // Make test cards focusable
    const testCards = document.querySelectorAll('.test-card');
    testCards.forEach(card => {
        card.setAttribute('tabindex', '0');
    });
}

function showComingSoonMessage() {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ffc107, #fd7e14);
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        font-weight: 600;
        animation: slideIn 0.3s ease;
    `;
    
    notification.textContent = '🚧 This feature is coming soon!';
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add page visibility change handler
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Page is hidden, pause any animations
        document.body.style.animationPlayState = 'paused';
    } else {
        // Page is visible, resume animations
        document.body.style.animationPlayState = 'running';
    }
});

// Add error handling for navigation
window.addEventListener('error', function(e) {
    console.error('Navigation error:', e.error);
    
    // Show user-friendly error message
    const errorNotification = document.createElement('div');
    errorNotification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #dc3545;
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        font-weight: 600;
        text-align: center;
    `;
    
    errorNotification.innerHTML = `
        <div>⚠️ Navigation Error</div>
        <div style="font-size: 14px; margin-top: 10px; opacity: 0.9;">
            Please try refreshing the page or contact support if the problem persists.
        </div>
    `;
    
    document.body.appendChild(errorNotification);
    
    setTimeout(() => {
        if (errorNotification.parentNode) {
            errorNotification.parentNode.removeChild(errorNotification);
        }
    }, 5000);
});