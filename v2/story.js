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

// ---- Scroll-driven animations ("scrolly")
// Timeline per block: photo intro (dive in) -> steps -> outro (pull back to a photo).
// SVG parts: data-s / data-e / data-only = discrete visibility by step;
// data-fx (grow|count|draw|fade|swell|rise) + data-k + data-range = continuous motion within step k;
// data-particles="pathId" = water particles flowing along a path.
const INTRO = 0.9, OUTRO = 0.9;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const parseCam = s => s.trim().split(/\s+/).map(Number);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpCam = (A, B, t, bulge = 0) => {
  const c = A.map((v, i) => lerp(v, B[i], t));
  if (bulge) {
    const k = 1 + bulge * Math.sin(Math.PI * t), cx = c[0] + c[2] / 2, cy = c[1] + c[3] / 2;
    c[2] *= k; c[3] *= k; c[0] = cx - c[2] / 2; c[1] = cy - c[3] / 2;
  }
  return c;
};
const zoomCam = (cam, fx, fy, z) => { const w = cam[2] / z, h = cam[3] / z; return [fx - (fx - cam[0]) / z, fy - (fy - cam[1]) / z, w, h]; };

const scrollies = [...document.querySelectorAll('.scrolly')];
const live = new Set();
const SVGNS = 'http://www.w3.org/2000/svg';

for (const root of scrollies) {
  const n = +root.dataset.steps;
  const U = INTRO + n + OUTRO;
  root.style.setProperty('--U', U);
  const svg = root.querySelector('svg');
  const cams = root.dataset.cams.split('|').map(parseCam);
  const outro = parseCam(root.dataset.outro);
  const [fx, fy] = root.dataset.focal.split(',').map(Number);
  const zoom = +(root.dataset.zoom || 0.15), endZoom = +(root.dataset.endzoom || 0), bulge = +(root.dataset.bulge || 0);
  const phS = root.querySelector('.ph-start'), phE = root.querySelector('.ph-end');
  const tagS = root.querySelector('.ph-tag-start'), tagE = root.querySelector('.ph-tag-end');
  const vbW = svg.viewBox.baseVal.width, vbH = svg.viewBox.baseVal.height;
  phS.style.transformOrigin = `${fx / vbW * 100}% ${fy / vbH * 100}%`;
  const caps = [...root.querySelectorAll('.anim-cap')];
  const bar = root.querySelector('.scrolly-bar i');
  const count = root.querySelector('.anim-count');
  const parts = [...svg.querySelectorAll('[data-s],[data-e],[data-only]')].map(el => ({
    el, from: +(el.dataset.only || el.dataset.s || 1), to: +(el.dataset.only || el.dataset.e || 99) }));
  const fxs = [...svg.querySelectorAll('[data-fx]')].map(el => {
    const [r0, r1] = (el.dataset.range || '.1,.7').split(',').map(Number);
    const o = { el, type: el.dataset.fx, k: +el.dataset.k, r0, r1 };
    if (o.type === 'draw') { o.len = el.getTotalLength(); el.style.strokeDasharray = o.len; }
    if (o.type === 'count') { o.to = +el.dataset.to; o.from = +(el.dataset.from || 0); o.dec = +(el.dataset.dec || 0); o.suf = el.dataset.suf || ''; }
    if (o.type === 'grow') el.style.transformOrigin = el.dataset.axis === 'x' ? 'left center' : 'center bottom';
    if (o.type === 'swell') el.style.transformOrigin = 'center';
    el.style.transformBox = 'fill-box';
    return o;
  });
  const flows = [...svg.querySelectorAll('[data-particles]')].map(g => {
    const path = svg.getElementById(g.dataset.particles);
    const len = path.getTotalLength(), dots = [];
    for (let i = 0; i < +g.dataset.n; i++) {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('r', 3.6); c.setAttribute('class', 'drop');
      const p0 = path.getPointAtLength((i / +g.dataset.n) * path.getTotalLength());
      c.setAttribute('cx', p0.x.toFixed(1)); c.setAttribute('cy', p0.y.toFixed(1));
      g.appendChild(c); dots.push(c);
    }
    return { g, path, len, dots, speed: +g.dataset.speed, life: g.dataset.life };
  });

  // step dots
  const ctrl = root.querySelector('.anim-ctrl');
  const dots = [];
  for (let i = 1; i <= n; i++) {
    const b = document.createElement('button');
    b.className = 'anim-dot'; b.type = 'button'; b.textContent = i;
    b.setAttribute('aria-label', `Step ${i} of ${n}`);
    b.addEventListener('click', () => {
      if (root.classList.contains('static')) { render(state(INTRO + i - 0.01)); return; }
      const r = root.getBoundingClientRect(), stickyH = root.querySelector('.scrolly-sticky').offsetHeight;
      const top = scrollY + r.top - headH();
      scrollTo({ top: top + ((INTRO + i - 1 + 0.62) / U) * (root.offsetHeight - stickyH), behavior: reduced ? 'auto' : 'smooth' });
    });
    ctrl.appendChild(b); dots.push(b);
  }

  function state(u) {
    if (u < INTRO) return { phase: 'intro', step: 1, lp: 0, li: u / INTRO };
    if (u < INTRO + n) { const k = Math.min(n, Math.floor(u - INTRO) + 1); return { phase: 'step', step: k, lp: u - INTRO - (k - 1) }; }
    return { phase: 'outro', step: n, lp: 1, lo: clamp((u - INTRO - n) / OUTRO) };
  }

  let lastCap = null;
  function render(st) {
    // camera and photo layers
    let cam, svgOp = 1, sOp = 0, eOp = 0, sZ = 1, eZ = 1;
    const introCam = zoomCam(cams[0], fx, fy, 1 + zoom);
    if (st.phase === 'intro') {
      const z = 1 + zoom * ease(st.li);
      cam = zoomCam(cams[0], fx, fy, z);
      sZ = z; sOp = 1 - smooth(0.45, 0.95, st.li); svgOp = smooth(0.45, 0.95, st.li);
    } else if (st.phase === 'step') {
      const from = st.step === 1 ? introCam : cams[st.step - 1];
      cam = lerpCam(from, cams[st.step], ease(clamp(st.lp / 0.5)), st.step === 1 ? 0 : bulge);
    } else {
      cam = lerpCam(cams[n], outro, ease(clamp(st.lo / 0.55)));
      svgOp = 1 - smooth(0.5, 0.92, st.lo); eOp = smooth(0.5, 0.92, st.lo);
      eZ = 1 + endZoom * (1 - ease(clamp((st.lo - 0.4) / 0.6)));
    }
    svg.setAttribute('viewBox', cam.map(v => v.toFixed(2)).join(' '));
    svg.style.opacity = svgOp;
    phS.style.opacity = sOp; phS.style.transform = `scale(${sZ})`;
    phE.style.opacity = eOp; phE.style.transform = `scale(${eZ})`;
    tagS.style.opacity = sOp > 0.6 ? 1 : 0; tagE.style.opacity = eOp > 0.6 ? 1 : 0;
    root.classList.toggle('flowing', svgOp > 0.05);
    // discrete parts
    for (const p of parts) p.el.classList.toggle('off', !(st.step >= p.from && st.step <= p.to));
    // continuous effects
    for (const f of fxs) {
      const v = st.step > f.k ? 1 : st.step < f.k ? 0 : ease(clamp((st.lp - f.r0) / (f.r1 - f.r0)));
      const e = f.el;
      if (f.type === 'grow') e.style.transform = (e.dataset.axis === 'x' ? 'scaleX(' : 'scaleY(') + Math.max(v, 0.001) + ')';
      else if (f.type === 'count') e.textContent = (f.from + (f.to - f.from) * v).toFixed(f.dec) + f.suf;
      else if (f.type === 'draw') e.style.strokeDashoffset = f.len * (1 - v);
      else if (f.type === 'fade') e.style.opacity = v;
      else if (f.type === 'swell') e.style.transform = `scale(${0.86 + 0.2 * v})`;
      else if (f.type === 'rise') { e.style.transform = `translateY(${(1 - v) * 70}px)`; e.style.opacity = v; }
    }
    // captions and controls
    const key = st.phase === 'intro' ? (st.li < 0.7 ? '0' : '1') : st.phase === 'outro' ? (st.lo > 0.45 ? 'end' : String(n)) : String(st.step);
    if (key !== lastCap) {
      caps.forEach(c => c.classList.toggle('on', c.dataset.cap === key));
      lastCap = key;
      count.textContent = key === '0' ? 'Real photo' : key === 'end' ? 'Back to a real photo' : `Step ${key} of ${n}`;
    }
    dots.forEach((d, i) => { if (i + 1 === st.step && st.phase === 'step') d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
  }
  root._update = () => {
    if (root.classList.contains('static')) return;
    const stickyH = root.querySelector('.scrolly-sticky').offsetHeight;
    const r = root.getBoundingClientRect();
    const p = clamp((headH() - r.top) / (root.offsetHeight - stickyH));
    bar.style.width = (p * 100) + '%';
    render(state(p * U));
  };
  root._flows = flows;

  // Reduced motion or ?step=N: show as a simple stepper with no scroll track
  const qs = new URLSearchParams(location.search).get('step');
  if (reduced || qs) {
    root.classList.add('static');
    render(state(INTRO + Math.min(+(qs || 1), n) - 0.01));
    if (qs === 'end') render(state(U));
  } else {
    new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? live.add(root) : live.delete(root))), { rootMargin: '200px 0px' }).observe(root);
    root._update();
  }
}
function headH() { const h = document.querySelector('.site-head'); return h ? h.offsetHeight : 0; }

let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => { ticking = false; live.forEach(r => r._update()); });
}, { passive: true });
addEventListener('resize', () => scrollies.forEach(r => r._update && r._update()));

// particle loop
if (!reduced) {
  const t0 = performance.now();
  const loop = now => {
    const t = (now - t0) / 1000;
    for (const r of scrollies) {
      if (!(live.has(r) || r.classList.contains('static')) || !r.classList.contains('flowing') && !r.classList.contains('static')) continue;
      for (const f of r._flows) {
        if (f.g.classList.contains('off')) continue;
        f.dots.forEach((c, i) => {
          const s = (t * f.speed + i * f.len / f.dots.length) % f.len;
          const pt = f.path.getPointAtLength(s);
          c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
          const edge = Math.min(s, f.len - s);
          c.style.opacity = f.life ? Math.min(1, s / (f.len * 0.3)) * Math.min(1, (f.len - s) / (f.len * 0.15)) : Math.min(1, edge / 14);
        });
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
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
