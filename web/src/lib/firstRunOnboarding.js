/**
 * Lightweight first-run onboarding helpers (zero boats).
 * Skip is in-memory only: cleared on full page reload (user sees onboarding again if they still have no boats).
 * Reset on sign-out so another account on the same SPA session is not affected.
 */

let skipZeroBoatOnboardingThisLoad = false;
let openAddBoatOnceAfterNavigateToHome = false;

export function setSkipZeroBoatOnboardingThisLoad(value = true) {
  skipZeroBoatOnboardingThisLoad = !!value;
}

export function isSkipZeroBoatOnboardingThisLoad() {
  return skipZeroBoatOnboardingThisLoad;
}

export function requestOpenAddBoatOnHome() {
  openAddBoatOnceAfterNavigateToHome = true;
}

export function peekOpenAddBoatOnHome() {
  return openAddBoatOnceAfterNavigateToHome;
}

export function consumeOpenAddBoatOnHome() {
  const v = openAddBoatOnceAfterNavigateToHome;
  openAddBoatOnceAfterNavigateToHome = false;
  return v;
}

export function resetFirstRunOnboardingClientState() {
  skipZeroBoatOnboardingThisLoad = false;
  openAddBoatOnceAfterNavigateToHome = false;
}
