/**
 * Auth Page - Sign In / Create Account
 *
 * Mirrors PetHub+ account creation flow (email + password, validation, profile bootstrap, session, redirect).
 *
 * Flow:
 * 1. Sign In → existing users log in; redirect to home or requested path.
 * 2. Create Account (web and native) → signUp → profile upsert → optional promo redeem → set session → redirect home.
 * 3. Promo is optional: with valid promo we apply after signup; without promo we still create account and redirect.
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { supabase } from '../lib/supabaseClient.js';
import { getSubscriptionStatus, refreshSubscriptionStatus } from '../lib/subscription.js';
import { logInWithAppUserId } from '../services/revenuecat.js';
import { touchLastLoginAfterAuthSession, getBoats } from '../lib/dataService.js';
import { Capacitor } from '@capacitor/core';
import { APP_STORE_URL, GOOGLE_PLAY_URL, APP_STORE_BADGE_URL, GOOGLE_PLAY_BADGE_URL } from '../lib/constants.js';
import { fireGoogleAdsSignupConversionIfEligible } from '../lib/googleAdsConversions.js';

// Store pending signup data (cleared after use)
let pendingSignup = null;

/** Default post-auth landing: onboarding when the fleet is empty, otherwise home. */
async function resolvePostAuthDefaultPath() {
  try {
    const boats = await getBoats();
    if (boats.length === 0) return '/onboarding';
  } catch (e) {
    console.warn('[Auth] Could not check boats after auth, using home:', e?.message || e);
  }
  return '/';
}

/**
 * Store signup data for after payment
 */
export function setPendingSignup(email, password) {
  pendingSignup = { email, password };
}

/**
 * Get and clear pending signup data
 */
export function getPendingSignup() {
  const data = pendingSignup;
  pendingSignup = null;
  return data;
}

/**
 * Check if there's a pending signup
 */
export function hasPendingSignup() {
  return pendingSignup !== null;
}

/**
 * Get pending signup email without clearing (for RevenueCat logIn before purchase)
 */
export function getPendingSignupEmail() {
  return pendingSignup?.email ?? null;
}

/**
 * Create profile with subscription data in Supabase
 * GDPR: Only create profile after paid subscription confirmed
 */
async function createProfileWithSubscription(userId, email) {
  if (!supabase) return;

  try {
    const subscriptionStatus = getSubscriptionStatus();

    const profileData = {
      id: userId,
      email: email,
      subscription_plan: subscriptionStatus.plan,
      subscription_status: subscriptionStatus.active ? 'active' : 'inactive',
      subscription_expires_at: subscriptionStatus.expires_at,
      metadata: {
        created_via: Capacitor.getPlatform(),
        subscription_price: subscriptionStatus.price
      }
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (error) {
      console.error('Error creating profile:', error);
      throw error;
    }

    console.log('Profile created with subscription data');
  } catch (error) {
    console.error('Failed to create profile:', error);
    throw error;
  }
}

/**
 * Complete account creation after payment
 * Called from subscription page after successful payment
 */
export async function completeAccountCreation() {
  const signup = getPendingSignup();
  if (!signup) {
    console.error('No pending signup data');
    return { success: false, error: 'No signup data found' };
  }

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: signup.email,
      password: signup.password
    });

    if (error) {
      console.error('Supabase signUp error:', error);
      return { success: false, error: error.message };
    }

    if (data.user) {
      await createProfileWithSubscription(data.user.id, signup.email);
      // Like PetHub+: transfer RevenueCat customer to real user ID so webhook/profile stay in sync
      try {
        await logInWithAppUserId(data.user.id);
        await refreshSubscriptionStatus();
      } catch (rcErr) {
        console.warn('[Auth] RevenueCat logIn after account creation failed (non-blocking):', rcErr);
      }
      if (data.session) {
        await touchLastLoginAfterAuthSession();
      }
      fireGoogleAdsSignupConversionIfEligible(data.user);
      return { success: true, user: data.user };
    }

    return { success: true, needsVerification: true };
  } catch (err) {
    console.error('Account creation error:', err);
    return { success: false, error: 'Unexpected error creating account' };
  }
}

/**
 * Sync subscription status to existing user's profile
 */
async function syncSubscriptionToProfile(userId) {
  if (!supabase) return;

  try {
    await refreshSubscriptionStatus();
    const subscriptionStatus = getSubscriptionStatus();

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_plan: subscriptionStatus.plan,
        subscription_status: subscriptionStatus.active ? 'active' : 'inactive',
        subscription_expires_at: subscriptionStatus.expires_at,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      console.error('Error syncing subscription to profile:', error);
    }
  } catch (error) {
    console.error('Failed to sync subscription:', error);
  }
}

/** Shared store badges markup for web (Sign in panel and Create account success) */
function storeBadgesHtml() {
  return `
    <style>
      .store-buttons { display: flex; gap: 12px; }
      .store-button { width: 180px; height: 54px; display: flex; align-items: center; justify-content: center; background: transparent; }
      .store-badge { height: 40px; width: auto; display: block; }
    </style>
    <div class="store-buttons">
      <a href="${APP_STORE_URL}" class="store-button" target="_blank" rel="noopener">
        <img src="${APP_STORE_BADGE_URL}" alt="Download on the App Store" class="store-badge">
      </a>
      <a href="${GOOGLE_PLAY_URL || '#'}" class="store-button" target="_blank" rel="noopener">
        <img src="${GOOGLE_PLAY_BADGE_URL}" alt="Get it on Google Play" class="store-badge" style="height: 54px; width: auto; display: block;">
      </a>
    </div>
  `;
}

function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-fullscreen';

  const container = document.createElement('div');
  container.className = 'container';
  container.style.width = '100%';
  container.style.maxWidth = '560px';
  container.style.margin = '0 auto';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '2rem 1.5rem';
  card.style.width = '100%';
  card.style.borderRadius = '16px';

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  // Single form for both sign in and create account (no tabs).
  card.innerHTML = `
    <div class="text-center" style="margin-bottom: 1.5rem;">
      <div style="display:flex; justify-content:center; margin-bottom: 0.65rem;">
        ${renderLogoFull(220)}
      </div>
      <p class="text-muted" style="margin: 0; font-size: 1.05rem; line-height: 1.5; max-width: 22rem; margin-left: auto; margin-right: auto;">Create your free account and start tracking your boat in minutes.</p>
      <p style="margin: 0.35rem 0 0; font-size: 0.8rem; line-height: 1.45; color: var(--color-text-light);">No payment required to get started.</p>
    </div>

    <form id="auth-form">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label for="auth-email" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Email</label>
        <input type="email" id="auth-email" required autocomplete="email" placeholder="you@example.com"
               style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
      </div>
      <div class="form-group" style="margin-bottom: 0.5rem;">
        <label for="auth-password" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Password</label>
        <div style="position: relative;">
          <input type="password" id="auth-password" autocomplete="current-password" placeholder="••••••••" minlength="${PASSWORD_MIN_LENGTH}"
                 style="width: 100%; padding: 0.75rem 3.5rem 0.75rem 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
          <button type="button" id="auth-password-toggle" aria-label="Show password" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 0.85rem; color: var(--color-text-light);">Show</button>
        </div>
      </div>
      <p class="text-muted" style="margin: -0.25rem 0 0.75rem; font-size: 0.8rem;">${PASSWORD_REQUIREMENTS_TEXT}</p>
      <div class="form-group" style="margin-bottom: 1rem;">
        <label for="auth-confirm" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Confirm password <span class="text-muted" style="font-weight: 400;">(for new accounts)</span></label>
        <input type="password" id="auth-confirm" autocomplete="new-password" placeholder="••••••••" minlength="${PASSWORD_MIN_LENGTH}"
               style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
      </div>
      <div class="form-group" style="margin-bottom: 1.25rem;">
        <label for="auth-promo" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Promo code <span class="text-muted" style="font-weight: 400;">(optional)</span></label>
        <input type="text" id="auth-promo" autocomplete="off" placeholder="Enter promo code if you have one"
               style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box; text-transform: uppercase;">
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button type="button" class="btn-primary" id="signin-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem;">Sign in</button>
        <button type="button" class="btn-secondary" id="create-account-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem;">Create account</button>
      </div>
    </form>

    <div style="border-top: 1px solid #eee; margin-top: 1.5rem; padding-top: 1.5rem;">
      <button type="button" class="btn-link" id="forgot-password-btn" style="width: 100%; text-align: center; color: var(--color-primary);">Forgot password?</button>
    </div>

    <p class="text-muted" style="margin-top: 1rem; font-size: 0.9rem; line-height: 1.5;">New here? Create your free account to get started. Add a promo code if you have one, or upgrade later in the app.</p>
    ${isNative ? '' : `<div style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem;">${storeBadgesHtml()}</div>`}

    <div id="auth-message" style="display: none; margin-top: 1rem; padding: 0.75rem; border-radius: 8px;">
      <p style="margin: 0; font-size: 0.95rem;"></p>
    </div>

    ${isNative ? `
      <div style="margin-top: 1.5rem; text-align: center;">
        <button type="button" class="btn-link" id="back-btn" style="color: var(--color-text-light);">
          ← Back
        </button>
      </div>
    ` : ''}
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

/** Minimum password length and requirements (match PetHub+). */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIREMENTS_TEXT = 'Password must be at least 8 characters and include both letters and numbers.';

/**
 * Validate password for signup. Returns { valid: true } or { valid: false, message: string }.
 */
function validatePasswordForSignup(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Please enter a password.\n\n' + PASSWORD_REQUIREMENTS_TEXT };
  }
  const p = password.trim();
  if (p.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: 'Password is too short.\n\n' + PASSWORD_REQUIREMENTS_TEXT };
  }
  const hasLetter = /[a-zA-Z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: 'Password must include both letters and numbers.\n\n' + PASSWORD_REQUIREMENTS_TEXT };
  }
  return { valid: true };
}

/**
 * @param {'signin' | 'signup'} [mode] Sign-up uses different copy; sign-in errors that mention "password" must not be shown as a generic wrong-password message during signup.
 */
function friendlyAuthError(message, mode = 'signin') {
  if (!message || typeof message !== 'string') return message;
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    if (mode === 'signup') {
      return 'Could not create an account with these details. If you already registered, use Sign in. Otherwise try again or use a different email.';
    }
    return 'Wrong email or password. Please try again.';
  }
  if (m.includes('email not confirmed')) return 'Please check your email and confirm your account before signing in.';
  if (m.includes('user not found')) return 'No account found with this email.';
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) {
    return 'An account with this email already exists. Sign in or use a different email.';
  }
  if (mode === 'signin' && m.includes('password')) {
    return 'Wrong email or password. Please try again.';
  }
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Too many attempts. Please wait a moment and try again.';
  return message;
}

function showMessage(text, isError = false, isSuccess = false) {
  const messageContainer = document.getElementById('auth-message');
  if (!messageContainer) return;
  const p = messageContainer.querySelector('p');
  if (!p) return;

  p.textContent = text;

  if (isError) {
    messageContainer.style.background = '#fee2e2';
    messageContainer.style.border = '1px solid #f87171';
    p.style.color = '#dc2626';
  } else if (isSuccess) {
    messageContainer.style.background = '#dcfce7';
    messageContainer.style.border = '1px solid #4ade80';
    p.style.color = '#16a34a';
  } else {
    messageContainer.style.background = '#f0f8ff';
    messageContainer.style.border = '1px solid var(--color-primary)';
    p.style.color = 'var(--color-text)';
  }

  messageContainer.style.display = text ? 'block' : 'none';
}

async function onMount() {
  window.navigate = navigate;

  const pageFs = document.querySelector('.page-fullscreen');
  if (pageFs) pageFs.scrollTop = 0;

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  const authForm = document.getElementById('auth-form');
  const signinBtn = document.getElementById('signin-btn');
  const createAccountBtn = document.getElementById('create-account-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const backBtn = document.getElementById('back-btn');

  // Pre-fill promo from URL e.g. #/auth?code=XYZ
  const hash = window.location.hash || '';
  const query = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const codeFromUrl = params.get('code') || getAuthRedirectParams().code || '';
  const promoInput = document.getElementById('auth-promo');
  if (promoInput && codeFromUrl) promoInput.value = codeFromUrl;

  const passwordInput = document.getElementById('auth-password');
  const passwordToggle = document.getElementById('auth-password-toggle');
  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.textContent = isPassword ? 'Hide' : 'Show';
      passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function validateAuthFields() {
    const emailEl = document.getElementById('auth-email');
    const passwordEl = document.getElementById('auth-password');
    const email = emailEl?.value?.trim() || '';
    const password = passwordEl?.value || '';
    if (!email) {
      showMessage('Please enter your email address.', true);
      emailEl?.focus?.();
      return false;
    }
    if (!emailRegex.test(email)) {
      showMessage('Please enter a valid email address.', true);
      emailEl?.focus?.();
      return false;
    }
    if (!password) {
      showMessage('Please enter your password.', true);
      passwordEl?.focus?.();
      return false;
    }
    return true;
  }

  // Sign in action (used by Sign in button and, on web, by form submit)
  async function doSignIn() {
    showMessage('');
    if (!supabase) {
      showMessage('Cloud sync is not configured.', true);
      return;
    }
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!validateAuthFields()) return;
    if (signinBtn) {
      signinBtn.disabled = true;
      signinBtn.textContent = 'Signing in...';
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Sign-in error:', error);
        showMessage(friendlyAuthError(error.message) || 'Unable to sign in. Please check your credentials.', true);
        return;
      }
      if (data.user && isNative) {
        await syncSubscriptionToProfile(data.user.id);
      }
      await touchLastLoginAfterAuthSession();
      showMessage('Signed in successfully!', false, true);
      await refreshSubscriptionStatus();
      const { redirect } = getAuthRedirectParams();
      let goTo = redirect && redirect.startsWith('/') ? redirect.replace(/^#?\/?/, '/') : '/';
      if (goTo === '/') {
        goTo = await resolvePostAuthDefaultPath();
      }
      setTimeout(() => navigate(goTo), 500);
    } catch (err) {
      console.error('Unexpected sign-in error:', err);
      showMessage('Unexpected error. Please try again.', true);
    } finally {
      if (signinBtn) {
        signinBtn.disabled = false;
        signinBtn.textContent = 'Sign in';
      }
    }
  }

  // Form submit: Enter key — if "Confirm password" is filled and matches, treat as create-account intent (not sign-in).
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('auth-password')?.value ?? '';
      const confirm = document.getElementById('auth-confirm')?.value ?? '';
      if (confirm.length > 0) {
        if (password !== confirm) {
          showMessage('Passwords do not match.', true);
          return;
        }
        const pwdCheck = validatePasswordForSignup(password);
        if (!pwdCheck.valid) {
          showMessage(pwdCheck.message, true);
          return;
        }
        await handleCreateAccount();
        return;
      }
      await doSignIn();
    });
  }

  // Sign in button click
  if (signinBtn) {
    signinBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await doSignIn();
    });
  }

  // Create account button
  if (createAccountBtn) {
    createAccountBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleCreateAccount();
    });
  }

  // Forgot password
  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();

      if (!email) {
        showMessage('Please enter your email address first.', true);
        return;
      }

      if (!supabase) {
        showMessage('Password reset is not available.', true);
        return;
      }

      forgotPasswordBtn.disabled = true;
      forgotPasswordBtn.textContent = 'Sending...';

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
          showMessage(error.message || 'Unable to send reset email.', true);
        } else {
          showMessage('Password reset email sent. Check your inbox.', false, true);
        }
      } catch (err) {
        showMessage('Error sending reset email.', true);
      } finally {
        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.textContent = 'Forgot password?';
      }
    });
  }

  // Back button - go back one screen (e.g. to welcome or subscription)
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.history.back();
    });
  }

  // --- Create account (single form, same fields as sign in) ---
  const CREATE_DEBOUNCE_MS = 600;
  let lastCreateSubmit = 0;

  async function handleCreateAccount() {
    showMessage('');

    const email = (document.getElementById('auth-email')?.value ?? '').trim().toLowerCase();
    const password = document.getElementById('auth-password')?.value ?? '';
    const confirm = document.getElementById('auth-confirm')?.value ?? '';
    const promoCode = (document.getElementById('auth-promo')?.value ?? '').trim().toUpperCase().replace(/\s+/g, '');

    if (!email) {
      showMessage('Please enter your email address.', true);
      return;
    }
    if (!emailRegex.test(email)) {
      showMessage('Please enter a valid email address.', true);
      return;
    }
    const pwdCheck = validatePasswordForSignup(password);
    if (!pwdCheck.valid) {
      showMessage(pwdCheck.message, true);
      return;
    }
    if (password !== confirm) {
      showMessage('Passwords do not match.', true);
      return;
    }
    if (!supabase) {
      showMessage('Unable to create account. Please try again later.', true);
      return;
    }

    const now = Date.now();
    if (now - lastCreateSubmit < CREATE_DEBOUNCE_MS) return;
    lastCreateSubmit = now;

    createAccountBtn.disabled = true;

    if (promoCode) {
      createAccountBtn.textContent = 'Validating…';
      try {
        const { data: validateData, error: validateErr } = await supabase.functions.invoke('validate-promo', { body: { code: promoCode } });
        const errMsg = validateErr?.message || validateData?.error || 'Invalid promo code. Please check and try again.';
        if (validateErr || validateData?.valid !== true) {
          showMessage(errMsg, true);
          createAccountBtn.disabled = false;
          createAccountBtn.textContent = 'Create account';
          return;
        }
      } catch (err) {
        showMessage('Invalid promo code. Please check and try again.', true);
        createAccountBtn.disabled = false;
        createAccountBtn.textContent = 'Create account';
        return;
      }
    }

    createAccountBtn.textContent = 'Creating account…';

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        const errMsg = friendlyAuthError(signUpError.message, 'signup') || 'Could not create account. Try another email or sign in.';
        showMessage(errMsg, true);
        createAccountBtn.disabled = false;
        createAccountBtn.textContent = 'Create account';
        return;
      }
      if (!signUpData?.user) {
        showMessage('Account creation did not complete. Please try again.', true);
        createAccountBtn.disabled = false;
        createAccountBtn.textContent = 'Create account';
        return;
      }

      const userId = signUpData.user.id;
      async function upsertProfile() {
        await supabase.from('profiles').upsert(
          { id: userId, email, updated_at: new Date().toISOString() },
          { onConflict: 'id' }
        );
      }
      try {
        await upsertProfile();
      } catch (profileErr) {
        console.warn('[Auth] profiles upsert during sign-up failed, will retry', profileErr);
        await new Promise((r) => setTimeout(r, 800));
        await upsertProfile();
      }

      fireGoogleAdsSignupConversionIfEligible(signUpData.user);

      if (promoCode) {
        const { data: applyData, error: applyError } = await supabase.functions.invoke('apply-promo-after-signup', {
          body: { user_id: userId, code: promoCode },
        });
        if (applyError || applyData?.error) {
          console.warn('[Auth] apply-promo-after-signup:', applyError || applyData?.error);
          showMessage('Account created. Redeem your code in Account if access did not apply.', false, true);
        } else {
          showMessage('Account created. Redirecting…', false, true);
        }
      } else {
        showMessage('Account created. Redirecting…', false, true);
      }

      if (signUpData.session) {
        await supabase.auth.setSession({
          access_token: signUpData.session.access_token,
          refresh_token: signUpData.session.refresh_token,
        });
        await touchLastLoginAfterAuthSession();
        if (isNative) {
          try {
            await logInWithAppUserId(userId);
            await refreshSubscriptionStatus();
          } catch (rcErr) {
            console.warn('[Auth] RevenueCat logIn after account creation failed (non-blocking):', rcErr);
          }
        }
        setTimeout(async () => {
          const goTo = await resolvePostAuthDefaultPath();
          navigate(goTo);
        }, 1200);
      } else {
        showMessage('Check your email to confirm your account, then sign in.', false, true);
        createAccountBtn.disabled = false;
        createAccountBtn.textContent = 'Create account';
      }
    } catch (err) {
      console.error(err);
      showMessage(err?.message || 'Something went wrong. Please try again.', true);
      createAccountBtn.disabled = false;
      createAccountBtn.textContent = 'Create account';
    }
  }
}

function getAuthRedirectParams() {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  const query = qIndex >= 0 ? hash.slice(qIndex + 1) : '';
  const params = new URLSearchParams(query);
  return { redirect: params.get('redirect') || '', code: params.get('code') || '' };
}

export default {
  render,
  onMount
};
