// Declare normalizedPath in a broader scope
const pathName = location.pathname;

const normalizedPath = pathName
  .replace(/\/+$/, "") // Remove trailing slashes
  .split("/")
  .pop();

// Remove 'activeLink' from all links
document.querySelectorAll('.nav-link').forEach(link => {
  link.classList.remove('activeLink');
});

if (normalizedPath === "home") {
document.querySelector('.homes').classList.add('activeLink');
}
if (normalizedPath === "home") {
document.querySelector('.homep').classList.add('activeLink');
}
if (normalizedPath === "home") {
document.querySelector('.homem').classList.add('activeLink');
}
if (normalizedPath === "discography") {
document.querySelector('.discography').classList.add('activeLink');
}
if (normalizedPath === "biography") {
document.querySelector('.biography').classList.add('activeLink');
}
if (normalizedPath === "side-projects") {
document.querySelector('.side-projects').classList.add('activeLink');
}
console.log(normalizedPath); // Now this will work


(function($) {
  "use strict"; // Start of use strict

  // Smooth scrolling using jQuery easing
  $('a.js-scroll-trigger[href*="#"]:not([href="#"])').click(function() {
    if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
      if (target.length) {
        $('html, body').animate({
          scrollTop: (target.offset().top - 0)
        }, 0, "easeInOutExpo");
        return false;
      }
    }
  });

  // Closes responsive menu when a scroll trigger link is clicked
  $('.js-scroll-trigger').click(function() {
    $('.navbar-collapse').collapse('hide');
  });

  // Activate scrollspy to add active class to navbar items on scroll
var navbarHeight = $('#mainNav').outerHeight();
$('body').scrollspy({
  target: '#mainNav',
  offset: navbarHeight,
});


  // Collapse Navbar
  var navbarCollapse = function() {
    if ($("#mainNav").offset().top > 100) {
      $("#mainNav").addClass("navbar-shrink");
    } else {
      $("#mainNav").removeClass("navbar-shrink");
    }
  };
  // Collapse now if page is not at top
  navbarCollapse();
  // Collapse the navbar when page is scrolled
  $(window).scroll(navbarCollapse);

$('.js-scroll-trigger').click(function (event) {
  event.preventDefault();
  $('.js-scroll-trigger').removeClass('active');
  $(this).addClass('active');
  var target = $(this.hash);
  if (target.length) {
    $('html, body').animate({
      scrollTop: target.offset().top - 150,
    }, 1000, "easeInOutExpo");
  }
});


})(jQuery); // End of use strict

/* this part to init AOS function */
$(function() {  /* this is the jQuery equivalent of document.ready */
    AOS.init({
    });
});