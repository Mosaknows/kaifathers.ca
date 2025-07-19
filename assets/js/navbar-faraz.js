// CodewithFaraz Responsive Navbar JS
// Toggle mobile menu
const navToggle = document.getElementById('nav-toggle');
const navList = document.querySelector('.nav-list');
if (navToggle && navList) {
  navToggle.addEventListener('click', function(e) {
    e.preventDefault();
    navList.classList.toggle('active');
    navToggle.classList.toggle('open');
  });
}
// Dropdowns for mobile
const navDropdownParents = document.querySelectorAll('.nav-list > li');
navDropdownParents.forEach(function(parent) {
  parent.addEventListener('click', function(e) {
    if (window.innerWidth <= 900 && this.querySelector('.nav-dropdown')) {
      e.stopPropagation();
      this.querySelector('.nav-dropdown').classList.toggle('active');
    }
  });
});