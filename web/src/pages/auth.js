/**
 * Auth / Onboarding Page
 * Email + password sign-in / sign-up with BoatMatey logo
 * Requires active subscription before account creation (GDPR compliance)
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { supabase } from '../lib/supabaseClient.js';
import { 
  hasActiveSubscription, 
  getSubscriptionStatus,
  refreshSubscriptionStatus 
} from '../lib/subscription.js';
import { Capacitor } from '@capacitor/core';

/**
 * Create profile with subscription data in Supabase
 * This ensures GDPR compliance - only create profile after paid subscription
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
 * Sync current subscription status to user's profile in Supabase
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
    } else {
      console.log('Subscription synced to profile');
    }
  } catch (error) {
    console.error('Failed to sync subscription:', error);
  }
}


function render() {
  const wrapper = document.createElement('div');
  wrapper.className = 'page-content';

  const container = document.createElement('div');
  container.className = 'container';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.maxWidth = '480px';
  card.style.margin = '0 auto';

  card.innerHTML = `
    <div class="text-center mb-md">
      <div style="display:flex; justify-content:center; margin-bottom: 1rem;">
        ${renderLogoFull(160)}
      </div>
      <h2>Welcome aboard</h2>
      <p class="text-muted">Sign in or create your BoatMatey account to get started.</p>
    </div>

    <div class="form-group" id="auth-status" style="display: ${supabase ? 'none' : 'block'};">
      <p class="text-muted">
        Cloud sync is not configured yet. Please contact support.
      </p>
    </div>

    <div class="form-group" style="display:flex; gap: 0.5rem; margin-bottom: 1.5rem;">
      <button type="button" class="btn-primary" id="auth-toggle-signin" style="flex:1;">
        Sign In
      </button>
      <button type="button" class="btn-secondary" id="auth-toggle-signup" style="flex:1;">
        Create Account
      </button>
    </div>

    <form id="auth-form-signin">
      <div class="form-group">
        <label for="signin-email">Email</label>
        <input type="email" id="signin-email" required autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="signin-password">Password</label>
        <input type="password" id="signin-password" required autocomplete="current-password" placeholder="••••••••">
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" id="signin-submit-btn" style="width: 100%;">Sign In</button>
      </div>
      <p class="form-help">Forgot your password? Use the Supabase reset link from your email (full reset UI coming soon).</p>
    </form>

    <form id="auth-form-signup" style="display:none;">
      <div class="form-group">
        <label for="signup-email">Email</label>
        <input type="email" id="signup-email" required autocomplete="email" placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label for="signup-password">Password</label>
        <input type="password" id="signup-password" required autocomplete="new-password" placeholder="Create a password">
      </div>
      <div class="form-group">
        <label for="signup-password-confirm">Confirm Password</label>
        <input type="password" id="signup-password-confirm" required autocomplete="new-password" placeholder="Repeat your password">
      </div>
      <div class="form-actions">
        <button type="button" class="btn-secondary" id="auth-cancel-signup-btn">Cancel</button>
        <button type="submit" class="btn-primary" id="signup-submit-btn">Create Account</button>
      </div>
      <p class="form-help">We’ll send a verification email if your project is configured to require it.</p>
    </form>

    <div id="auth-message" class="mt-md" style="display:none;">
      <p class="text-muted"></p>
    </div>
  `;

  container.appendChild(card);
  wrapper.appendChild(container);

  return wrapper;
}

function setMode(mode) {
  const signinForm = document.getElementById('auth-form-signin');
  const signupForm = document.getElementById('auth-form-signup');
  const signinToggle = document.getElementById('auth-toggle-signin');
  const signupToggle = document.getElementById('auth-toggle-signup');

  if (!signinForm || !signupForm || !signinToggle || !signupToggle) return;

  if (mode === 'signup') {
    signupForm.style.display = 'block';
    signinForm.style.display = 'none';
    signupToggle.classList.remove('btn-secondary');
    signupToggle.classList.add('btn-primary');
    signinToggle.classList.remove('btn-primary');
    signinToggle.classList.add('btn-secondary');
  } else {
    signinForm.style.display = 'block';
    signupForm.style.display = 'none';
    signinToggle.classList.remove('btn-secondary');
    signinToggle.classList.add('btn-primary');
    signupToggle.classList.remove('btn-primary');
    signupToggle.classList.add('btn-secondary');
  }
}

function showMessage(text, isError = false) {
  const messageContainer = document.getElementById('auth-message');
  if (!messageContainer) return;
  const p = messageContainer.querySelector('p');
  if (!p) return;

  p.textContent = text;
  p.style.color = isError ? 'var(--color-error)' : 'var(--color-text-light)';
  messageContainer.style.display = text ? 'block' : 'none';
}

async function onMount() {
  window.navigate = navigate;

  // Check subscription status on native platforms
  const isNative = Capacitor.isNativePlatform?.() ?? false;
  if (isNative && supabase) {
    await refreshSubscriptionStatus();
    const hasActive = hasActiveSubscription();
    
    if (!hasActive) {
      // No active subscription - redirect back to subscription page
      showMessage('Active subscription required to create an account.', true);
      setTimeout(() => {
        navigate('/subscription');
      }, 2000);
      return;
    }
  }

  const signinToggle = document.getElementById('auth-toggle-signin');
  const signupToggle = document.getElementById('auth-toggle-signup');
  const cancelSignupBtn = document.getElementById('auth-cancel-signup-btn');
  const signinForm = document.getElementById('auth-form-signin');
  const signupForm = document.getElementById('auth-form-signup');
  const signinSubmitBtn = document.getElementById('signin-submit-btn');
  const signupSubmitBtn = document.getElementById('signup-submit-btn');

  if (signinToggle) {
    signinToggle.addEventListener('click', () => {
      setMode('signin');
      showMessage('');
    });
  }

  if (signupToggle) {
    signupToggle.addEventListener('click', () => {
      setMode('signup');
      showMessage('');
    });
  }

  if (cancelSignupBtn) {
    cancelSignupBtn.addEventListener('click', () => {
      setMode('signin');
      showMessage('');
    });
  }

  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMessage('');

      if (!supabase) {
        showMessage('Supabase is not configured. You can continue using BoatMatey locally without signing in.', true);
        return;
      }

      const email = /** @type {HTMLInputElement} */ (document.getElementById('signin-email')).value.trim();
      const password = /** @type {HTMLInputElement} */ (document.getElementById('signin-password')).value;

      if (!email || !password) {
        showMessage('Please enter both email and password.', true);
        return;
      }

      if (signinSubmitBtn) {
        signinSubmitBtn.disabled = true;
        signinSubmitBtn.textContent = 'Signing in...';
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error('Supabase signIn error:', error);
          showMessage(error.message || 'Unable to sign in. Please check your credentials.', true);
          return;
        }

        // Sync subscription status with profile
        if (data.user && isNative) {
          await syncSubscriptionToProfile(data.user.id);
        }

        navigate('/');
      } catch (err) {
        console.error('Sign-in unexpected error:', err);
        showMessage('Unexpected error while signing in.', true);
      } finally {
        if (signinSubmitBtn) {
          signinSubmitBtn.disabled = false;
          signinSubmitBtn.textContent = 'Sign In';
        }
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showMessage('');

      if (!supabase) {
        showMessage('Supabase is not configured. You can continue using BoatMatey locally without creating an account.', true);
        return;
      }

      // On native platforms, verify subscription before allowing signup
      if (isNative) {
        await refreshSubscriptionStatus();
        const hasActive = hasActiveSubscription();
        
        if (!hasActive) {
          showMessage('Active subscription required to create an account. Please subscribe first.', true);
          setTimeout(() => {
            navigate('/subscription');
          }, 2000);
          return;
        }
      }

      const email = /** @type {HTMLInputElement} */ (document.getElementById('signup-email')).value.trim();
      const password = /** @type {HTMLInputElement} */ (document.getElementById('signup-password')).value;
      const confirmPassword = /** @type {HTMLInputElement} */ (document.getElementById('signup-password-confirm')).value;

      if (!email || !password || !confirmPassword) {
        showMessage('Please complete all fields.', true);
        return;
      }

      if (password !== confirmPassword) {
        showMessage('Passwords do not match.', true);
        return;
      }

      if (signupSubmitBtn) {
        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = 'Creating account...';
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) {
          console.error('Supabase signUp error:', error);
          showMessage(error.message || 'Unable to create account. Please try again.', true);
          return;
        }

        // Create profile with subscription data (GDPR compliant - only after paid subscription)
        if (data.user) {
          await createProfileWithSubscription(data.user.id, email);
          showMessage('Account created successfully! Signing you in...', false);
          
          // Auto sign-in after successful signup
          setTimeout(() => {
            navigate('/');
          }, 1500);
        } else {
          showMessage('Account created. Check your email for verification (if required), then sign in.', false);
          setMode('signin');
        }
      } catch (err) {
        console.error('Sign-up unexpected error:', err);
        showMessage('Unexpected error while creating your account.', true);
      } finally {
        if (signupSubmitBtn) {
          signupSubmitBtn.disabled = false;
          signupSubmitBtn.textContent = 'Create Account';
        }
      }
    });
  }

  // Default to sign-in mode
  setMode('signin');
}

export default {
  render,
  onMount
};

