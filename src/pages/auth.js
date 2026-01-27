/**
 * Auth / Onboarding Page
 * Email + password sign-in / sign-up with BoatMatey logo
 */

import { navigate } from '../router.js';
import { renderLogoFull } from '../components/logo.js';
import { supabase } from '../lib/supabaseClient.js';

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
      <p class="text-muted">Sign in or create a BoatMatey cloud account to sync your boats across devices.</p>
    </div>

    <div class="form-group" id="auth-status" style="display: ${supabase ? 'none' : 'block'};">
      <p class="text-muted">
        Cloud sync is not configured yet. You can continue using BoatMatey locally without signing in.
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
        <button type="button" class="btn-secondary" id="auth-skip-btn">Continue without account</button>
        <button type="submit" class="btn-primary" id="signin-submit-btn">Sign In</button>
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

function onMount() {
  window.navigate = navigate;

  const signinToggle = document.getElementById('auth-toggle-signin');
  const signupToggle = document.getElementById('auth-toggle-signup');
  const skipBtn = document.getElementById('auth-skip-btn');
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

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      navigate('/');
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error('Supabase signIn error:', error);
          showMessage(error.message || 'Unable to sign in. Please check your credentials.', true);
          return;
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
        const { error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) {
          console.error('Supabase signUp error:', error);
          showMessage(error.message || 'Unable to create account. Please try again.', true);
          return;
        }

        showMessage('Account created. Check your email for verification (if required), then sign in.', false);
        setMode('signin');
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

