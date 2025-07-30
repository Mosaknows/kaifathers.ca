// Better FOUC prevention - hide html immediately, show when everything loads
document.documentElement.classList.add('hidden');

window.addEventListener('load', function() {
    // Show the page
    document.documentElement.classList.remove('hidden');
    
    // Fade out loading screen
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                // Initialize AOS after loading screen is completely hidden
                if ('AOS' in window) {
                    console.log('Initializing AOS...');
                    AOS.init({
                        duration: 1000,
                        easing: 'ease-in-out',
                        once: true,
                        offset: 100,
                        delay: 0
                    });
                    console.log('AOS initialized successfully');
                } else {
                    console.log('AOS not found in window');
                }
            }, 300);
        }, 100);
    } else {
        // If no loading screen, initialize AOS immediately
        if ('AOS' in window) {
            console.log('Initializing AOS (no loading screen)...');
            AOS.init({
                duration: 1000,
                easing: 'ease-in-out',
                once: true,
                offset: 100,
                delay: 0
            });
            console.log('AOS initialized successfully');
        } else {
            console.log('AOS not found in window');
        }
    }
}); 