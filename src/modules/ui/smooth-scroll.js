/**
 * Smooth scrolling
 *
 * The page glides with the mouse wheel the way inter-nation.uz does (Lenis).
 * Touch screens keep their own momentum scroll, which already feels right.
 * Links to a section (#groups, #results…) glide there and stop just below
 * the fixed header (html { scroll-padding-top } in style.css). While the
 * menu, the login panel or a certificate is open, the page underneath holds
 * still. Visitors who asked their system for less motion keep the
 * browser's plain scrolling.
 *
 * @module ui/smooth-scroll
 */

let lenis = null;

/**
 * Scrolls to an element or to the top, smoothly when Lenis runs.
 * Where a section stops is set once, in CSS: html { scroll-padding-top },
 * which both Lenis and the browser's own anchor jumps honour (the full
 * header on desktop, the folded one on phones). Adding an offset here as
 * well would count the header twice.
 */
export function scrollToTarget(target) {
  if (lenis) {
    lenis.scrollTo(target === 'top' ? 0 : target);
    return;
  }
  if (target === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function initSmoothScroll() {
  if (lenis || typeof window.Lenis !== 'function') return lenis;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  lenis = new window.Lenis({
    autoRaf: true,
    lerp: 0.1,
    wheelMultiplier: 1,
    // panels that scroll on their own keep their own scrolling
    prevent: (node) => !!node.closest?.('.login_panel, .username_panel, dialog, .mobile-menu, [data-lenis-prevent]'),
  });
  window.lenis = lenis;

  // section links glide, and the address bar keeps its #language
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const link = e.target.closest?.('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    if (!id) return;                                   // "#": leave it to its own handler
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(id === 'home' ? 'top' : target);
  });

  // an open overlay holds the page still
  const locked = () =>
    document.body.classList.contains('menu-open') ||
    document.body.style.overflow === 'hidden' ||
    !!document.querySelector('dialog[open]');
  const sync = () => (locked() ? lenis.stop() : lenis.start());
  const watcher = new MutationObserver(sync);
  watcher.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  document.querySelectorAll('dialog').forEach((d) => watcher.observe(d, { attributes: true, attributeFilter: ['open'] }));

  return lenis;
}

export default { initSmoothScroll, scrollToTarget };
