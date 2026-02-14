/**
 * Save button loading state: disable and show "Saving…" during async save.
 * Use in form submit handlers; call with the form element and loading true/false.
 */
const SAVING_LABEL = 'Saving…';

/**
 * Set loading state on the form's primary submit button.
 * @param {HTMLFormElement|HTMLElement|null} formOrButton - Form (finds first button[type="submit"]) or the button itself
 * @param {boolean} loading
 * @param {string} [restoreLabel] - Text to restore (default: "Save" or button's data-save-label)
 */
export function setSaveButtonLoading(formOrButton, loading, restoreLabel) {
  const button = formOrButton?.tagName === 'BUTTON'
    ? formOrButton
    : formOrButton?.querySelector?.('button[type="submit"]');
  if (!button) return;
  if (loading) {
    button.dataset.saveLabel = button.textContent.trim();
    button.disabled = true;
    button.textContent = SAVING_LABEL;
  } else {
    button.disabled = false;
    button.textContent = restoreLabel || button.dataset.saveLabel || 'Save';
  }
}
