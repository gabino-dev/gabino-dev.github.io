(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  // Apparition des éléments au scroll
  const revealEls = document.querySelectorAll('.reveal');
  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('visible'));
  }

  // Met en pause les animations continues quand elles sont hors écran
  if (hasIO) {
    const pauseIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-offscreen', !entry.isIntersecting));
    });
    document.querySelectorAll('.icon-cloud, .marquee, .hero h1, .featured-visual, .about-photo, .stats').forEach((el) => pauseIo.observe(el));
  }

  // Bandeau défilant : duplique le groupe d'apps juste assez pour couvrir la
  // largeur visible + un groupe d'avance, puis fait défiler d'un groupe par cycle
  // (boucle sans saut, vitesse constante quel que soit le nombre d'apps)
  const track = document.querySelector('.marquee-track');
  const group = track && track.querySelector('.marquee-group');
  if (group) {
    const SPEED = 32; // px par seconde
    let lastWidth = 0;
    const fill = () => {
      const groupWidth = group.getBoundingClientRect().width;
      if (!groupWidth) return;
      const copies = Math.max(2, Math.ceil(track.parentElement.clientWidth / groupWidth) + 1);
      while (track.children.length < copies) {
        const clone = group.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      }
      while (track.children.length > copies) track.lastElementChild.remove();
      track.style.setProperty('--copies', copies);
      // Ne change la durée que si la largeur du groupe change (sinon la position saute)
      if (Math.abs(groupWidth - lastWidth) > 1) {
        lastWidth = groupWidth;
        track.style.setProperty('--marquee-dur', `${(groupWidth / SPEED).toFixed(2)}s`);
      }
    };
    fill();
    if ('ResizeObserver' in window) {
      new ResizeObserver(fill).observe(track.parentElement);
      new ResizeObserver(fill).observe(group);
    } else {
      window.addEventListener('resize', fill, { passive: true });
      window.addEventListener('load', fill);
    }
  }

  // Le nombre d'apps affiché suit le nombre de cartes présentes sur la page
  const appCount = document.querySelectorAll('.app-grid > .app-card').length;
  document.querySelectorAll('[data-count-apps]').forEach((el) => {
    el.dataset.count = appCount;
    el.textContent = appCount;
  });

  // Compteurs animés (chiffres clés)
  const counters = document.querySelectorAll('[data-count]');
  if (hasIO && !reduceMotion) {
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const start = performance.now();
        const duration = 1400;
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        countIo.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => countIo.observe(el));
  }

  if (reduceMotion || !finePointer) return;

  // Cartes : inclinaison 3D + halo qui suit la souris (1 mise à jour par frame max)
  // Le rect est mesuré à la demande et invalidé au scroll (une seule mesure par frame)
  const hovered = new Set();
  document.querySelectorAll('.app-card').forEach((card) => {
    let rect = null;
    let raf = 0;
    let px = 0;
    let py = 0;
    const state = { reset: () => { rect = null; } };

    const update = () => {
      raf = 0;
      if (!hovered.has(state)) return;
      if (!rect) rect = card.getBoundingClientRect();
      const x = px - rect.left;
      const y = py - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      if (!card.classList.contains('visible')) return;
      const rx = ((y / rect.height) - 0.5) * -5;
      const ry = ((x / rect.width) - 0.5) * 5;
      card.style.transform = `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(0, -4px, 0)`;
    };

    card.addEventListener('pointerenter', () => { rect = null; hovered.add(state); });
    card.addEventListener('pointermove', (e) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      rect = null;
      hovered.delete(state);
      card.style.transform = '';
    });
  });
  // Le rect mis en cache devient faux si la page défile pendant le survol
  window.addEventListener('scroll', () => {
    hovered.forEach((s) => s.reset());
  }, { passive: true });

  // Parallaxe des icônes du hero
  const cloud = document.querySelector('.icon-cloud');
  if (cloud) {
    const icons = [...cloud.querySelectorAll('.float-icon')].map((el) => ({ el, depth: Number(el.dataset.depth || 15) }));
    let raf = 0;
    let dx = 0;
    let dy = 0;
    window.addEventListener('pointermove', (e) => {
      dx = e.clientX / window.innerWidth - 0.5;
      dy = e.clientY / window.innerHeight - 0.5;
      if (raf || cloud.classList.contains('is-offscreen')) return;
      raf = requestAnimationFrame(() => {
        icons.forEach(({ el, depth }) => {
          el.style.setProperty('--px', `${(dx * depth).toFixed(1)}px`);
          el.style.setProperty('--py', `${(dy * depth).toFixed(1)}px`);
        });
        raf = 0;
      });
    }, { passive: true });
  }
})();
