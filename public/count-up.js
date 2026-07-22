// MODULE 6.7 — Count-up animation
// Animates numbers from 0 to target value on mount

export function animateCountUp(el, target, duration = 800) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    const value = Math.round(start + (target - start) * ease(progress));
    el.textContent = String(value);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = String(target);
  }
  requestAnimationFrame(tick);
}

export function autoCountUpInView(root) {
  if (!root) return;
  const targets = root.querySelectorAll('.score-num, .kpi-num');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.counted) return;
        const text = el.textContent.trim();
        const num = parseInt(text, 10);
        if (!isNaN(num) && num > 0 && num < 10000) {
          el.dataset.counted = '1';
          animateCountUp(el, num, 600);
        }
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.4 });
  targets.forEach(t => observer.observe(t));
}
