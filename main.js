// AquAlign — reveal choreography, figure tally, accordion physics, form handling
document.documentElement.classList.add('js');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

// ---- Scroll reveals: enhance already-visible content; never gate visibility.
if (!prefersReduced && 'IntersectionObserver' in window && !location.hash) {
  const staged = new Set();

  const show = (el) => {
    el.classList.add('in');
    el.classList.remove('pre');
    staged.delete(el);
    io.unobserve(el);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) show(e.target);
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  for (const el of document.querySelectorAll('.reveal')) {
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.92) {
      el.classList.add('pre');
      staged.add(el);
      io.observe(el);
    }
  }

  // Safety sweep: reveal anything staged that has entered the viewport,
  // even if IntersectionObserver never fired for it.
  let ticking = false;
  const sweep = () => {
    ticking = false;
    for (const el of [...staged]) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) show(el);
    }
    if (!staged.size) window.removeEventListener('scroll', onScroll);
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(sweep); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

// ---- Figure tally: trial numbers count up when they enter view.
if (!prefersReduced && 'IntersectionObserver' in window) {
  const figs = [];
  for (const fig of document.querySelectorAll('.fig')) {
    const node = fig.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) continue;
    const m = node.textContent.match(/^([+−-]?)(\d+)$/);
    if (!m) continue;
    figs.push({ node, sign: m[1], target: parseInt(m[2], 10) });
  }
  if (figs.length) {
    const tally = (f) => {
      const dur = 1100;
      const t0 = performance.now();
      const frame = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        f.node.textContent = f.sign + Math.round(easeOutQuart(p) * f.target);
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    const figIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const f = figs.find(x => x.node.parentNode === e.target);
          if (f) tally(f);
          figIO.unobserve(e.target);
        }
      }
    }, { threshold: 0.6 });
    for (const f of figs) figIO.observe(f.node.parentNode);
  }
}

// ---- Accordion physics: smooth open/close for details disclosures.
if (!prefersReduced) {
  for (const details of document.querySelectorAll('details.trial-more, details.qa')) {
    const summary = details.querySelector('summary');
    const body = details.querySelector('.trial-body, .qa-body');
    if (!summary || !body) continue;
    let animating = false;
    summary.addEventListener('click', (ev) => {
      if (animating) { ev.preventDefault(); return; }
      if (details.open) {
        // Animate closed, then actually close.
        ev.preventDefault();
        animating = true;
        const anim = body.animate(
          [{ height: body.scrollHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
          { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        );
        anim.onfinish = () => { details.open = false; animating = false; };
      } else {
        // Let it open, then animate in.
        requestAnimationFrame(() => {
          animating = true;
          const anim = body.animate(
            [{ height: '0px', opacity: 0 }, { height: body.scrollHeight + 'px', opacity: 1 }],
            { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          );
          anim.onfinish = () => { animating = false; };
        });
      }
    });
  }
}

// ---- Header shadow once the page is scrolled.
const head = document.querySelector('.site-head');
if (head) {
  const setShadow = () => head.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', setShadow, { passive: true });
  setShadow();
}

// ---- Contact form: posts to Formspree (delivers to Dan's inbox); falls back to email if sending fails.
const FORM_ENDPOINT = 'https://formspree.io/f/mykqjqvp';
const FALLBACK_EMAIL = 'dan@danknowsaguy.org';
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
if (form && note) {
  const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';
  const safe = s => String(s).replace(/[<>&]/g, '');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('button[type="submit"]');
    const first = form.name.value.trim().split(' ')[0] || 'there';
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Sending...';
    const fd = new FormData(form);
    fd.append('_subject', 'AquAlign site inquiry from ' + (form.name.value.trim() || 'a visitor'));
    fd.append('source', 'AquAlign website contact form');
    try {
      const r = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { 'Accept': 'application/json' }, body: fd });
      if (r.ok) {
        note.innerHTML = tick + 'Thanks, ' + safe(first) + '. Your note reached the team; we respond within two business days.';
        form.reset();
        btn.textContent = 'Sent';
        return;
      }
    } catch (e) { /* fall through to the email fallback */ }
    const body = ['Name: ' + form.name.value, 'Operation: ' + form.operation.value, 'Email: ' + form.email.value,
      'Region: ' + form.region.value, 'Operation type: ' + form.type.value, '', form.message.value].join('\n');
    const mail = 'mailto:' + FALLBACK_EMAIL + '?subject=' + encodeURIComponent('AquAlign inquiry') + '&body=' + encodeURIComponent(body);
    note.innerHTML = 'That didn\u2019t send. <a href="' + mail + '">Email it to us instead</a> and it will open with your details filled in.';
    btn.disabled = false;
    btn.textContent = label;
  });
}

// ---- For the people who check.
console.log(
  '%cAquAlign%c  Reading the source? Good. We publish our methods too: /results.html. We like people who check.',
  'font-weight:800; font-size:14px; color:oklch(0.5 0.145 38);',
  'color:inherit;'
);
