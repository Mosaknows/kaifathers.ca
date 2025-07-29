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
            }, 300);
        }, 100);
    }
}); 