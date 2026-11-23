// AquAlign v2 story page: reveals, figure tally, step animations, gallery lightbox, pilot form
document.documentElement.classList.add('js');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Scroll reveals (enhance only; content is visible without JS)
const shot = new URLSearchParams(location.search).has('step');
if (!reduced && !shot && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); e.target.classList.remove('pre'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  for (const el of document.querySelectorAll('.reveal')) {
    if (el.getBoundingClientRect().top > innerHeight * 0.92) { el.classList.add('pre'); io.observe(el); }
  }
}

// ---- Step animations
// Elements in each SVG carry data-s (visible from step N), data-e (until step N) or data-only (step N only).
const STEP_MS = 5200;
for (const root of document.querySelectorAll('[data-anim]')) {
  const caps = [...root.querySelectorAll('.anim-cap')];
  const total = caps.length;
  const parts = [...root.querySelectorAll('svg [data-s], svg [data-e], svg [data-only]')].map(el => ({
    el,
    from: +(el.dataset.only || el.dataset.s || 1),
    to: +(el.dataset.only || el.dataset.e || 99),
  }));
  const ctrl = root.querySelector('.anim-ctrl');
  const count = root.querySelector('.anim-count');
  const bar = root.querySelector('.anim-bar i');
  const dots = [];
  for (let i = 1; i <= total; i++) {
    const b = document.createElement('button');
    b.className = 'anim-dot'; b.type = 'button'; b.textContent = i;
    b.setAttribute('aria-label', `Step ${i} of ${total}`);
    b.addEventListener('click', () => { userPaused = true; stop(); go(i); });
    ctrl.appendChild(b); dots.push(b);
  }
  const play = document.createElement('button');
  play.className = 'anim-play'; play.type = 'button';
  ctrl.appendChild(play);

  let step = 1, t0 = 0, raf = 0, playing = false, userPaused = false;

  function go(n) {
    step = n;
    for (const p of parts) p.el.classList.toggle('off', !(step >= p.from && step <= p.to));
    caps.forEach((c, i) => c.classList.toggle('on', i + 1 === step));
    dots.forEach((d, i) => { if (i + 1 === step) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
    count.textContent = `Step ${step} of ${total}`;
    t0 = performance.now();
  }
  function tick(now) {
    if (!playing) return;
    const p = Math.min((now - t0) / STEP_MS, 1);
    bar.style.width = (p * 100) + '%';
    if (p >= 1) go(step % total + 1);
    raf = requestAnimationFrame(tick);
  }
  function start() { if (playing) return; playing = true; play.textContent = 'Pause'; t0 = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { playing = false; cancelAnimationFrame(raf); play.textContent = 'Play'; bar.style.width = '0%'; }
  play.addEventListener('click', () => { if (playing) { userPaused = true; stop(); } else { userPaused = false; start(); } });

  // Allow ?step=N for screenshots and review links
  const qs = new URLSearchParams(location.search).get('step');
  go(qs ? Math.min(+qs, total) : 1);
  stop();
  if (!reduced && !qs && 'IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting && !userPaused) start();
        else if (!e.isIntersecting && playing) stop();
      }
    }, { threshold: 0.45 }).observe(root);
  }
}

// ---- Gallery lightbox
const box = document.getElementById('lightbox');
if (box && box.showModal) {
  const img = box.querySelector('img'), cap = box.querySelector('p');
  for (const b of document.querySelectorAll('.gal button')) {
    b.addEventListener('click', () => {
      const fig = b.closest('figure');
      img.src = b.dataset.full; img.alt = b.querySelector('img').alt;
      cap.textContent = fig.querySelector('figcaption').textContent;
      box.showModal();
    });
  }
  box.addEventListener('click', (e) => { if (e.target === box) box.close(); });
}

// ---- Pilot form: posts to Formspree (same inbox as the main site); falls back to email if sending fails
const FORM_ENDPOINT = 'https://formspree.io/f/mykqjqvp';
const FALLBACK_EMAIL = 'dan@danknowsaguy.org';
const form = document.getElementById('pilot-form');
if (form) {
  const note = form.querySelector('.form-note');
  const safe = s => String(s).replace(/[<>&]/g, '');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.name.value.trim() || !form.contact.value.trim()) { note.textContent = 'Please add your name and an email or phone number.'; return; }
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending...';
    const fd = new FormData(form);
    fd.append('_subject', 'AquAlign pilot request from ' + form.name.value.trim());
    fd.append('source', 'AquAlign v2 page, pilot form');
    try {
      const r = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd });
      if (r.ok) {
        note.textContent = 'Thanks, ' + safe(form.name.value.trim().split(' ')[0]) + '. Your request reached the team; we reply within two business days.';
        form.reset(); btn.textContent = 'Sent'; return;
      }
    } catch (err) { /* fall through to email */ }
    const body = ['Name: ' + form.name.value, 'Contact: ' + form.contact.value, 'Operation: ' + form.operation.value,
      'Water source: ' + form.source.value, 'Line size: ' + form.pipe.value, 'Peak gpm: ' + form.gpm.value,
      'Location: ' + form.location.value, '', form.notes.value].join('\n');
    const mail = 'mailto:' + FALLBACK_EMAIL + '?subject=' + encodeURIComponent('AquAlign pilot request') + '&body=' + encodeURIComponent(body);
    note.innerHTML = 'That didn’t send. <a href="' + mail + '">Email it to us instead</a> (' + FALLBACK_EMAIL + ') and it will open with your details filled in.';
    btn.disabled = false; btn.textContent = label;
  });
}
