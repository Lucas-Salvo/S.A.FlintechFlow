/* ==========================================================================
   FinTech Flow · landing page
   1) Abertura cinematográfica: 475 frames controlados pelo scroll
   2) Contadores e animações de entrada
   ========================================================================== */

(() => {
  /* ---------- contadores ---------- */
  function animateCounter(el) {
    const target = parseFloat(el.dataset.target);
    const isDecimal = target % 1 !== 0;
    const duration = 1800;
    const step = 16;
    const increments = duration / step;
    const inc = target / increments;
    let current = 0;

    const timer = setInterval(() => {
      current += inc;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = isDecimal ? current.toFixed(1) : Math.floor(current);
    }, step);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('.stat-number').forEach((el) => counterObserver.observe(el));

  /* ---------- revelação das seções ---------- */
  const revealElements = document.querySelectorAll(
    '.sobre-card, .feature-item, .seg-list li, .footer-brand, .footer-links'
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '0';
        entry.target.style.transform = 'translateY(20px)';
        entry.target.style.transition = `opacity 0.5s ${i * 0.08}s ease, transform 0.5s ${i * 0.08}s ease`;
        requestAnimationFrame(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        });
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealElements.forEach((el) => {
    el.style.opacity = '0';
    revealObserver.observe(el);
  });

  /* ---------- âncoras com scroll suave ---------- */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ---------- abertura cinematográfica ---------- */
  const section = document.getElementById('intro');
  const pin = document.getElementById('introPin');
  const canvas = document.getElementById('introCanvas');
  if (!section || !pin || !canvas) return;

  const ctx = canvas.getContext('2d');
  const loader = document.getElementById('introLoader');
  const loaderFill = document.getElementById('introLoaderFill');
  const loaderPct = document.getElementById('introLoaderPct');
  const scrim = document.getElementById('introScrim');
  const cue = document.getElementById('introCue');
  const reveal = document.getElementById('introReveal');
  const revealInner = document.getElementById('introRevealInner');
  const revealItems = Array.from(document.querySelectorAll('[data-rv]'));

  const FRAME_COUNT = 475;
  const FRAME_DIR = 'bgl/';
  const FRAME_NAME = 'Fintech_box_opening_transition_a…_7cbca672_1080p_';
  const FRAMES_END = 0.70; // fração do scroll usada pela animação
  const frameSrc = (n) => `${FRAME_DIR}${FRAME_NAME}${String(n + 1).padStart(4, '0')}.jpg`;

  // Em telas pequenas, usa um frame a cada dois para poupar memória no mobile.
  const frameStep = window.innerWidth <= 760 ? 2 : 1;
  const frameIndexes = [];
  for (let i = 0; i < FRAME_COUNT; i += frameStep) frameIndexes.push(i);
  if (frameIndexes[frameIndexes.length - 1] !== FRAME_COUNT - 1) frameIndexes.push(FRAME_COUNT - 1);

  const images = new Array(frameIndexes.length).fill(null);
  const view = { w: 0, h: 0, dpr: 1 };
  let travel = 1;
  let target = 0; // progresso do scroll
  let shown = 0;  // progresso suavizado (com inércia)
  let loopId = 0;
  let needsRedraw = true;
  const lastDraw = { a: -1, b: -1, frac: -1 };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function sizeCanvas() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = pin.clientWidth;
    view.h = pin.clientHeight;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    needsRedraw = true;
  }

  function measure() {
    sizeCanvas();
    travel = Math.max(1, section.offsetHeight - pin.clientHeight);
    if (loopId) { cancelAnimationFrame(loopId); loopId = 0; }
    target = shown = progress();
    render(shown);
  }

  function nearestLoaded(target) {
    if (images[target]) return target;
    for (let d = 1; d < images.length; d++) {
      if (images[target - d]) return target - d;
      if (images[target + d]) return target + d;
    }
    return -1;
  }

  function paint(img, alpha) {
    const { w, h, dpr } = view;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;
    let dw, dh, dx, dy;

    if (w / h < 1.2) {
      // Retrato: frame inteiro na parte alta, texto embaixo.
      dw = w;
      dh = (dw * ih) / iw;
      dx = 0;
      dy = Math.max(h * 0.03, h * 0.30 - dh / 2);
    } else {
      // Paisagem: cobre a tela mantendo o centro da cena.
      const scale = Math.max(w / iw, h / ih);
      dw = iw * scale;
      dh = ih * scale;
      dx = (w - dw) / 2;
      dy = (h - dh) / 2;
    }

    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx * dpr, dy * dpr, dw * dpr, dh * dpr);
    ctx.globalAlpha = 1;
  }

  // pos é fracionário: mistura o frame atual com o seguinte para não "pular".
  function drawFrame(pos) {
    const last = images.length - 1;
    const clamped = clamp(pos, 0, last);
    const i0 = Math.floor(clamped);
    const i1 = Math.min(i0 + 1, last);
    const frac = clamped - i0;

    const a = images[i0] ? i0 : nearestLoaded(i0);
    if (a < 0) { needsRedraw = true; return; }
    const b = images[i1] && i1 !== i0 ? i1 : a;

    if (!needsRedraw && a === lastDraw.a && b === lastDraw.b && Math.abs(frac - lastDraw.frac) < 0.0015) return;
    lastDraw.a = a;
    lastDraw.b = b;
    lastDraw.frac = frac;
    needsRedraw = false;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0A0807';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (b > a && frac > 0) {
      paint(images[b], 1);
      paint(images[a], 1 - frac); // crossfade entre frames vizinhos
    } else {
      paint(images[a], 1);
    }
  }

  const revealRanges = {
    1: [0.70, 0.76],
    2: [0.72, 0.80],
    3: [0.76, 0.84],
    4: [0.80, 0.88],
    5: [0.87, 0.97],
  };

  function updateReveal(p) {
    revealItems.forEach((el) => {
      const [start, end] = revealRanges[el.dataset.rv];
      const t = clamp((p - start) / (end - start), 0, 1);
      const eased = t * t * (3 - 2 * t);
      el.style.opacity = eased;
      el.style.transform = `translate3d(0, ${(1 - eased) * 26}px, 0)`;
    });

    scrim.style.opacity = clamp((p - 0.63) / 0.1, 0, 0.95);
    cue.classList.toggle('is-hidden', p > 0.03);

    const live = p >= 0.82;
    reveal.classList.toggle('is-live', live);
    revealInner.inert = !live;
  }

  function progress() {
    return clamp(-section.getBoundingClientRect().top / travel, 0, 1);
  }

  function render(p) {
    const frameProgress = clamp(p / FRAMES_END, 0, 1);
    drawFrame(frameProgress * (images.length - 1));
    updateReveal(p);
  }

  // Aproxima o progresso desenhado do scroll com amortecimento,
  // então a cena desliza e "assenta" como animação em vez de pular.
  function tick() {
    const diff = target - shown;
    if (Math.abs(diff) < 0.0003) {
      shown = target;
      loopId = 0;
      render(shown);
      return;
    }
    shown += diff * 0.16;
    render(shown);
    loopId = requestAnimationFrame(tick);
  }

  function requestUpdate() {
    target = progress();
    if (!loopId) loopId = requestAnimationFrame(tick);
  }

  /* pré-carga dos frames com fila limitada */
  function preload() {
    let cursor = 0;
    let active = 0;
    let done = 0;

    const updateLoader = () => {
      const pct = Math.round((done / frameIndexes.length) * 100);
      loaderFill.style.width = pct + '%';
      loaderPct.textContent = pct + '%';
    };

    const finish = () => {
      loader.classList.add('is-done');
      setTimeout(() => { loader.hidden = true; }, 800);
      target = shown = progress();
      if (loopId) { cancelAnimationFrame(loopId); loopId = 0; }
      render(shown);
    };

    const launch = () => {
      while (active < 6 && cursor < frameIndexes.length) {
        const slot = cursor++;
        active++;
        const img = new Image();
        img.decoding = 'async';

        const settle = () => {
          active--;
          done++;
          if (img.naturalWidth > 0) images[slot] = img;
          updateLoader();

          if (done === frameIndexes.length) {
            finish();
            return;
          }
          if (needsRedraw) render(shown);
          launch();
        };

        img.onload = settle;
        img.onerror = settle;
        img.src = frameSrc(frameIndexes[slot]);
      }
    };

    updateLoader();
    launch();
  }

  revealInner.inert = true;
  window.addEventListener('scroll', requestUpdate, { passive: true });

  window.addEventListener('resize', measure);
  measure();
  preload();
})();
