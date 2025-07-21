// Navbar logic extracted from test3.html
const pills = [
  document.getElementById('pill-socials'),
  document.getElementById('pill-latest'),
  document.getElementById('pill-stream'),
  document.getElementById('pill-discography'),
  document.getElementById('pill-bio'),
  document.getElementById('pill-side-projects')
];
const burger = document.getElementById('pill-burger');
let pillsVisible = false;
function positionPills() {
  const gap = 32; // px
  const isMobile = window.innerWidth < 1150;
  burger.style.display = isMobile ? 'block' : 'none';
  if (isMobile) {
    // Stack pills vertically, center horizontally with left: 50vw and transform
    const pillHeight = pills[0].offsetHeight;
    const burgerCenter = 28 + 56/2; // burger top + half its height
    const firstPillTop = burgerCenter - pillHeight/2;
    pills.forEach((pill, i) => {
      pill.style.position = 'fixed';
      pill.style.visibility = 'visible';
      pill.style.opacity = '1';
      pill.style.pointerEvents = pillsVisible ? 'auto' : 'none';
      pill.style.transition = 'none';
      pill.style.top = (firstPillTop + i * (pillHeight + gap)) + 'px';
      pill.style.left = pillsVisible ? '50vw' : '110vw';
      pill.style.transform = pillsVisible ? 'translateX(-50%)' : 'none';
      pill.style.right = '';
    });
  } else {
    let right = 32;
    pills.slice().reverse().forEach(pill => {
      pill.style.position = 'fixed';
      pill.style.top = '32px';
      pill.style.left = '';
      pill.style.right = right + 'px';
      pill.style.opacity = '1';
      pill.style.pointerEvents = 'auto';
      pill.style.transition = 'none';
      pill.style.visibility = 'visible';
      pill.style.transform = 'none';
      right += pill.offsetWidth + gap;
    });
  }
}
burger.addEventListener('click', function() {
  pillsVisible = !pillsVisible;
  positionPills();
});
window.addEventListener('resize', positionPills);
window.addEventListener('DOMContentLoaded', positionPills); 