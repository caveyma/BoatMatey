/**
 * BoatMatey Logo Component
 * Uses actual logo image file
 */

import logoImage from './BoatMatey_Logo.png';

export function renderLogo(size = 40) {
  return `<img src="${logoImage}" alt="BoatMatey" style="width: ${size}px; height: auto; display: block;">`;
}

export function renderLogoFull(size = 120) {
  return `<img src="${logoImage}" alt="BoatMatey" style="width: ${size}px; height: auto; display: block;">`;
}

export function renderLogoMono(size = 40) {
  // For header, use logo directly without filters
  return `<img src="${logoImage}" alt="BoatMatey" style="width: ${size}px; height: auto; display: block;">`;
}
