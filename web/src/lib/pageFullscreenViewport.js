/**
 * Keeps `.page-fullscreen` sized to the visual viewport so keyboards (WebView / mobile)
 * don't leave content "above" the scroll range. Sets CSS vars on documentElement.
 */
export function initPageFullscreenViewport() {
  const vv = window.visualViewport;
  if (!vv) return;

  const root = document.documentElement;

  const sync = () => {
    root.style.setProperty('--page-fullscreen-vv-top', `${vv.offsetTop}px`);
    root.style.setProperty('--page-fullscreen-vv-height', `${vv.height}px`);
  };

  sync();
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
}
