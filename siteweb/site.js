(function () {
  var nav = document.getElementById('navbar');
  window.addEventListener('scroll', function () { nav.classList.toggle('scrolled', window.scrollY > 50); });

  var toggle = document.getElementById('nav-toggle'), links = document.getElementById('nav-links');
  function setMenu(open) {
    links.classList.toggle('open', open); toggle.classList.toggle('active', open);
    var s = toggle.querySelectorAll('span');
    s[0].style.transform = open ? 'rotate(45deg) translate(5px, 5px)' : 'none';
    s[1].style.opacity = open ? '0' : '1';
    s[2].style.transform = open ? 'rotate(-45deg) translate(5px, -5px)' : 'none';
  }
  toggle.addEventListener('click', function () { setMenu(!links.classList.contains('open')); });
  links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach(function (el) { io.observe(el); });

  document.querySelectorAll('[data-carousel]').forEach(function (c) {
    var track = c.querySelector('.car-track'), slides = c.querySelectorAll('.car-slide');
    var dots = c.querySelector('.car-dots'), cur = 0;
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-label', 'Image ' + (i + 1) + ' sur ' + slides.length);
      b.addEventListener('click', function () { go(i); }); dots.appendChild(b);
    });
    function mark() { dots.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-current', i === cur ? 'true' : 'false'); }); }
    function go(i) { cur = Math.max(0, Math.min(slides.length - 1, i)); track.scrollTo({ left: slides[cur].offsetLeft, behavior: 'smooth' }); mark(); }
    c.querySelector('[data-prev]').addEventListener('click', function () { go(cur - 1); });
    c.querySelector('[data-next]').addEventListener('click', function () { go(cur + 1); });
    track.addEventListener('scroll', function () { var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== cur) { cur = i; mark(); } });
    c.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); });
    mark();
  });
})();
