function toggleMobileMenu() {
    const navbar = document.getElementById('mainNavbar');
    const burgerBtn = document.querySelector('.burger-btn');
    navbar.classList.toggle('active');
    burgerBtn.classList.toggle('active');
}

// Close mobile menu when clicking outside (on mobile only)
document.addEventListener('click', function(e) {
    const navbar = document.getElementById('mainNavbar');
    const burgerBtn = document.querySelector('.burger-btn');
    if (window.innerWidth > 1000) return;
    if (!navbar.contains(e.target) && !burgerBtn.contains(e.target)) {
        navbar.classList.remove('active');
        burgerBtn.classList.remove('active');
    }
}); 