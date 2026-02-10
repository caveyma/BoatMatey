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
      <h2 style="margin-bottom: 0.5rem;">Sign in to get started</h2>
      <p class="text-muted">Use your existing account to continue.</p>
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

      <button type="submit" class="btn-primary" id="signin-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem; margin-bottom: 0.75rem;">
        Sign in
      </button>

      ${isNative ? `
        <button type="button" class="btn-secondary" id="create-account-btn" style="width: 100%; padding: 0.875rem; font-size: 1rem;">
          Create account
        </button>
        <p class="text-muted" style="text-align: center; margin-top: 0.75rem; font-size: 0.9rem;">
          New here? Your free trial starts when you create an account.
        </p>
      ` : `
        <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
          <p style="margin: 0; color: #856404; font-size: 0.9rem;">
            <strong>New to BoatMatey?</strong><br>
            Download the mobile app to create an account and start your free trial.
          </p>
        </div>
      `}
    </form>

    <div style="border-top: 1px solid #eee; margin-top: 1.5rem; padding-top: 1.5rem;">
      <button type="button" class="btn-link" id="forgot-password-btn" style="width: 100%; text-align: center; color: var(--color-primary);">
        Forgot password?
      </button>
    </div>

    ${isNative ? `
      <div style="border-top: 1px solid #eee; margin-top: 1rem; padding-top: 1.25rem;">
        <p style="text-align: center; margin-bottom: 0.75rem; font-weight: 500; color: var(--color-text-light);">
          Got a promo code?
        </p>
        <div style="display: flex; gap: 0.5rem;">
          <input type="text" id="promo-code" placeholder="Enter promo code" 
                 style="flex: 1; padding: 0.625rem; border: 1px solid #ddd; border-radius: 8px; font-size: 0.95rem;">
          <button type="button" class="btn-secondary" id="apply-promo-btn" style="padding: 0.625rem 1rem;">
            Apply
          </button>
        </div>
      </div>
    ` : ''}

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
  const applyPromoBtn = document.getElementById('apply-promo-btn');
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

  // Sign In form submission
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMessage('');

      if (!supabase) {
        showMessage('Cloud sync is not configured.', true);
        return;
      }

      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;

      if (!email || !password) {
        showMessage('Please enter both email and password.', true);
        return;
      }

      if (signinBtn) {
        signinBtn.disabled = true;
        signinBtn.textContent = 'Signing in...';
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          console.error('Sign-in error:', error);
          showMessage(error.message || 'Unable to sign in. Please check your credentials.', true);
          return;
        }

        // Sync subscription on native
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
    });
  }

  // Create Account button - goes to subscription page
  if (createAccountBtn) {
    createAccountBtn.addEventListener('click', () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;

      // Validate before going to subscription
      if (!email) {
        showMessage('Please enter your email address.', true);
        return;
      }

      if (!password || password.length < 6) {
        showMessage('Please enter a password (at least 6 characters).', true);
        return;
      }

      // Basic email validation
      if (!email.includes('@') || !email.includes('.')) {
        showMessage('Please enter a valid email address.', true);
        return;
      }

      // Store credentials for after payment
      setPendingSignup(email, password);
      
      // Navigate to subscription page
      navigate('/subscription');
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

  // Promo code
  if (applyPromoBtn) {
    applyPromoBtn.addEventListener('click', () => {
      const promoCode = document.getElementById('promo-code').value.trim();
      
      if (!promoCode) {
        showMessage('Please enter a promo code.', true);
        return;
      }

      // TODO: Implement promo code validation with RevenueCat
      showMessage('Promo code feature coming soon!');
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
