const SELECTOR = "button[data-password-toggle]";
const initialized = new WeakSet();

const labels = {
  en: {
    show: "Show",
    hide: "Hide",
    showAccessible: "Show password",
    hideAccessible: "Hide password",
  },
  ar: {
    show: "إظهار",
    hide: "إخفاء",
    showAccessible: "إظهار كلمة المرور",
    hideAccessible: "إخفاء كلمة المرور",
  },
};

function getInput(button) {
  const id = button.getAttribute("aria-controls")?.trim();
  const input = id && button.getRootNode().getElementById?.(id);

  if (input?.matches('input[type="password"]')) {
    return input;
  }

  // Recognize the visible state used by existing markup and reinitialization.
  if (
    input?.matches('input[type="text"]') &&
    (button.classList.contains("is-active") ||
      button.getAttribute("aria-pressed") === "true")
  ) {
    return input;
  }

  return null;
}

function updateVisibility(button, input, visible) {
  const language =
    button.closest("[lang]")?.getAttribute("lang") ||
    button.ownerDocument.documentElement.lang;

  const defaults = /^ar(?:-|$)/i.test(language) ? labels.ar : labels.en;

  const text = visible
    ? button.dataset.passwordHideLabel || defaults.hide
    : button.dataset.passwordShowLabel || defaults.show;

  const accessibleName = visible
    ? button.dataset.passwordHideAriaLabel || defaults.hideAccessible
    : button.dataset.passwordShowAriaLabel || defaults.showAccessible;

  input.type = visible ? "text" : "password";
  button.classList.toggle("is-active", visible);
  button.setAttribute("aria-label", accessibleName);

  const label = button.querySelector("[data-password-toggle-label]");

  if (label) {
    label.textContent = text;
  } else if (!button.firstElementChild) {
    button.textContent = text;
  }
}

export function initPasswordToggles(root = document) {
  const buttons = [...root.querySelectorAll(SELECTOR)];

  if (root.matches?.(SELECTOR)) {
    buttons.unshift(root);
  }

  const controller = new AbortController();
  const { signal } = controller;
  const mounted = [];

  for (const button of buttons) {
    if (initialized.has(button)) continue;

    const input = getInput(button);
    if (!input) continue;

    initialized.add(button);
    mounted.push(button);

    // The button's label describes the action available now.
    updateVisibility(button, input, input.type === "text");
    button.removeAttribute("aria-pressed");

    button.addEventListener(
      "click",
      (event) => {
        if (event.defaultPrevented) return;

        event.preventDefault();

        if (
          button.getAttribute("aria-disabled") === "true" ||
          input.matches(":disabled")
        ) {
          return;
        }

        updateVisibility(button, input, input.type === "password");
      },
      { signal },
    );

    input.form?.addEventListener(
      "reset",
      (event) => {
        queueMicrotask(() => {
          if (!signal.aborted && !event.defaultPrevented) {
            updateVisibility(button, input, false);
          }
        });
      },
      { signal },
    );
  }

  return () => {
    if (signal.aborted) return;

    controller.abort();

    for (const button of mounted) {
      initialized.delete(button);
    }
  };
}
