const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const observed = new WeakSet();
const active = new Set();
function play(element, frames, options) {
  if (!element || reducedMotion.matches || !element.animate) return;
  const animation = element.animate(frames, options);
  active.add(animation);
  animation.finished.catch(() => {}).finally(() => active.delete(animation));
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) for (const animation of active) animation.cancel();
});
const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    if (!entry.target.isConnected) continue;
    // Product buttons must keep their hit targets while a scrolled-in card
    // appears. Moving the whole card can lose a click between down and up.
    const frames=entry.target.classList.contains('card')
      ? [{opacity:0},{opacity:1}]
      : [{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}];
    play(entry.target, frames, { duration: 600, delay: Number(entry.target.dataset.revealDelay || 0), easing: 'cubic-bezier(.2,.7,.2,1)' });
  }
}, { threshold: .08 }) : null;
export function revealContent(root = document) {
  root.querySelectorAll('.card, .section > .kicker, .section > h2, .step, .hero > div').forEach((element, index) => {
    if (!observer || observed.has(element)) return;
    observed.add(element);
    element.dataset.revealDelay = String((index % 3) * 65);
    observer.observe(element);
  });
}
export function addedToCart(button) {
  play(button, [{transform:'scale(1)'},{transform:'scale(.93)',offset:.35},{transform:'scale(1)'}],{duration:280,easing:'ease-out'});
  play(document.querySelector('#cart-count'), [{transform:'scale(1)'},{transform:'scale(1.35)',offset:.45},{transform:'scale(1)'}],{duration:380,easing:'ease-out'});
}
