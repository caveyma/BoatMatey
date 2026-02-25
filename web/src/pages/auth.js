/**
 * Auth Page - Sign In / Create Account
 * 
 * Flow (like PetHub+):
 * 1. User enters email + password
 * 2. Sign In → existing users log in directly
 * 3. Create Account → goes to subscription page → pays → account created
 * 
 * GDPR: No account created until payment confirmed
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { supabase } from '../lib/supabaseClient.js';
import { 
  hasActiveSubscription, 
  getSubscriptionStatus,
  refreshSubscriptionStatus 
} from '../lib/subscription.js';
import { logInWithAppUserId } from '../services/revenuecat.js';
import { Capacitor } from '@capacitor/core';

// App store URLs for web auth page (subscribe via mobile apps)
const APP_STORE_URL = 'https://apps.apple.com/app/boatmatey/id6758239609';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.boatmatey.app';
const APP_STORE_BADGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Available_on_the_App_Store_%28black%29_SVG.svg';
const GOOGLE_PLAY_BADGE_URL = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

// Store pending signup data (cleared after use)
let pendingSignup = null;

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


function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-fullscreen';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '2rem 1.5rem';

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  card.innerHTML = `
    <div class="text-center" style="margin-bottom: 1.5rem;">
      <div style="display:flex; justify-content:center; margin-bottom: 1rem;">
        ${renderLogoFull(220)}
      </div>
      <h2 style="margin-bottom: 0.5rem;">Create an account to get started</h2>
      <p class="text-muted">Create an account to start your free trial, or sign in if you already have one.</p>
    </div>

    <form id="auth-form">
      <div class="form-group" style="margin-bottom: 1rem;">
        <label for="auth-email" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Email</label>
        <input type="email" id="auth-email" required autocomplete="email" placeholder="you@example.com" 
               style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem;">
      </div>
      
      <div class="form-group" style="margin-bottom: 1.25rem;">
        <label for="auth-password" style="display: block; margin-bottom: 0.25rem; font-weight: 500;">Password</label>
        <div style="position: relative;">
          <input type="password" id="auth-password" required autocomplete="current-password" placeholder="••••••••"
                 style="width: 100%; padding: 0.75rem 3.5rem 0.75rem 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
          <button type="button" id="auth-password-toggle" aria-label="Show password" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 0.85rem; color: var(--color-text-light);">Show</button>
        </div>
      </div>

      ${isNative ? `
        <button type="submit" class="btn-primary" id="create-account-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem; margin-bottom: 0.75rem;">
          Create account
        </button>
        <button type="button" class="btn-secondary" id="signin-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem;">
          Sign in
        </button>
        <p class="text-muted" style="text-align: center; margin-top: 0.75rem; font-size: 0.9rem;">
          New here? Your free trial starts when you create an account.
        </p>
      ` : `
        <button type="submit" class="btn-primary" id="signin-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem;">
          Sign in
        </button>
        <div style="background: #f8f9fa; border: 1px solid #e9ecef; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
          <p style="margin: 0 0 0.75rem 0; color: var(--color-text); font-size: 0.9rem;">
            <strong>New to BoatMatey?</strong><br>
            Download the app to create an account and subscribe via the store.
          </p>
          <style>
            .store-buttons {
              display: flex;
              gap: 12px;
            }
            .store-button {
              width: 180px;
              height: 54px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: transparent;
            }
            .store-badge {
              height: 40px;
              width: auto;
              display: block;
            }
          </style>
          <div class="store-buttons">
            <a href="${APP_STORE_URL}" class="store-button" target="_blank" rel="noopener">
              <img src="${APP_STORE_BADGE_URL}" alt="Download on the App Store" class="store-badge">
            </a>
            <a href="${GOOGLE_PLAY_URL || '#'}" class="store-button" target="_blank" rel="noopener">
              <img src="${GOOGLE_PLAY_BADGE_URL}" alt="Get it on Google Play" class="store-badge" style="height: 54px; width: auto; display: block;">
            </a>
          </div>
        </div>
      `}
    </form>

    <div style="border-top: 1px solid #eee; margin-top: 1.5rem; padding-top: 1.5rem;">
      <button type="button" class="btn-link" id="forgot-password-btn" style="width: 100%; text-align: center; color: var(--color-primary);">
        Forgot password?
      </button>
    </div>

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

function friendlyAuthError(message) {
  if (!message || typeof message !== 'string') return message;
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) return 'Wrong email or password. Please try again.';
  if (m.includes('email not confirmed')) return 'Please check your email and confirm your account before signing in.';
  if (m.includes('user not found')) return 'No account found with this email.';
  if (m.includes('password')) return 'Wrong email or password. Please try again.';
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

  const isNative = Capacitor.isNativePlatform?.() ?? false;

  const authForm = document.getElementById('auth-form');
  const signinBtn = document.getElementById('signin-btn');
  const createAccountBtn = document.getElementById('create-account-btn');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  const backBtn = document.getElementById('back-btn');

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
      showMessage('Signed in successfully!', false, true);
      setTimeout(() => navigate('/'), 500);
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

  // Create account action (primary on native: validate, store pending signup, go to subscription)
  function doCreateAccount() {
    showMessage('');
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!validateAuthFields()) return;
    if (password.length < 6) {
      showMessage('Please enter a password of at least 6 characters.', true);
      return;
    }
    setPendingSignup(email, password);
    navigate('/subscription');
  }

  // Form submit: on native = Create account (primary CTA, like PetHub+); on web = Sign in
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isNative) {
        doCreateAccount();
      } else {
        await doSignIn();
      }
    });
  }

  // Sign in button (native only – secondary CTA; on web there is only submit = Sign in)
  if (signinBtn && signinBtn.type === 'button') {
    signinBtn.addEventListener('click', () => doSignIn());
  }

  // Create account button click (native only; primary is also form submit, so Enter triggers this flow)
  if (createAccountBtn) {
    createAccountBtn.addEventListener('click', (e) => {
      e.preventDefault();
      doCreateAccount();
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
}

export default {
  render,
  onMount
};
