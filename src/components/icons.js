/**
 * Simple SVG icons for the app
 */

export function createIcon(svgPath, className = '') {
  return `
    <svg class="icon ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${svgPath}
    </svg>
  `;
}

// Icon paths (simple line icons)
export const icons = {
  // Nautical icons for dashboard
  boat: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="none"/><path d="M12 4L14 10L12 12L10 10Z" fill="currentColor"/><path d="M20 12L14 10L12 12L14 14Z" fill="currentColor"/><path d="M12 20L10 14L12 12L14 14Z" fill="currentColor"/><path d="M4 12L10 14L12 12L10 10Z" fill="currentColor"/><path d="M12 4L12 8M12 16L12 20M4 12L8 12M16 12L20 12"/>`, // Helm wheel
  engine: `<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="none"/><path d="M12 6L13.5 9L12 12L10.5 9Z" fill="currentColor"/><path d="M18 12L15 13.5L12 12L15 10.5Z" fill="currentColor"/><path d="M12 18L10.5 15L12 12L13.5 15Z" fill="currentColor"/><path d="M6 12L9 10.5L12 12L9 13.5Z" fill="currentColor"/><path d="M12 6L12 8M12 16L12 18M6 12L8 12M16 12L18 12"/>`, // Propeller
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  compass: `<circle cx="12" cy="12" r="10"/><polygon points="12 6 16 14 12 12 8 14 12 6"/>`,
  shield: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="6" fill="none" stroke-width="1.5"/><path d="M12 4L12 8M12 16L12 20M4 12L8 12M16 12L20 12"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`, // Lifebuoy
  book: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 6h8M8 10h8M8 14h6"/>`, // Logbook with lines
  link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  arrowLeft: `<path d="M19 12H5M12 19l-7-7 7-7"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  edit: `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`,
  trash: `<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  file: `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/>`,
  check: `<path d="M20 6L9 17l-5-5"/>`,
  x: `<path d="M18 6L6 18M6 6l12 12"/>`
};

/**
 * Render icon as HTML
 */
export function renderIcon(iconName, className = '') {
  const path = icons[iconName];
  if (!path) {
    console.warn(`Icon not found: ${iconName}`);
    return '';
  }
  return createIcon(path, className);
}
