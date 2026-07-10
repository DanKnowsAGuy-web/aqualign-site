// AquAlign landing — reveal choreography + form handling
document.documentElement.classList.add('js');

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scroll reveals: enhance already-visible content; never gate visibility.
// Staged elements are a progressive enhancement with two independent
// un-hide paths (IntersectionObserver + scroll sweep) so nothing can
// stay invisible if either misbehaves.
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
    // Only stage elements below the first viewport; everything else stays visible.
    if (r.top > window.innerHeight * 0.92) {
      el.classList.add('pre');
      staged.add(el);
      io.observe(el);
    }
  }

  // Safety sweep: any staged element that has entered the viewport gets
  // revealed on the next scroll frame, even if IO never fired for it.
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

// Results page: category filters.
const filterRow = document.querySelector('.filter-row');
if (filterRow) {
  const cases = document.querySelectorAll('.case');
  filterRow.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filter-btn');
    if (!btn) return;
    for (const b of filterRow.querySelectorAll('.filter-btn')) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    }
    const want = btn.dataset.filter;
    for (const c of cases) {
      c.hidden = want !== 'all' && c.dataset.cat !== want;
    }
  });
}

// Contact form: endpoint wiring pending deploy — acknowledge locally.
const form = document.getElementById('contactForm');
const note = document.getElementById('formNote');
if (form && note) {
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    // TODO: wire to form endpoint at deploy (no live email addresses yet).
    note.textContent = 'Thanks, ' + (form.name.value.split(' ')[0] || 'there') + '. Your note is queued for the team; we respond within two business days.';
    form.querySelector('button[type="submit"]').disabled = true;
  });
}
