const SELECTOR = "button[data-copy-target]";
const DEFAULT_FEEDBACK_DURATION = 2000;
const mountedActions = new WeakSet();

const messages = {
  en: { idle: "Copy", success: "Copied", error: "Copy failed" },
  ar: { idle: "نسخ", success: "تم النسخ", error: "تعذر النسخ" },
};

function findById(action, id) {
  return id ? action.getRootNode().getElementById?.(id) : null;
}

function setState(action, state) {
  const language =
    action.closest("[lang]")?.getAttribute("lang") ||
    action.ownerDocument.documentElement.lang;

  const defaults = /^ar(?:-|$)/i.test(language) ? messages.ar : messages.en;
  const overrides = {
    idle: action.dataset.copyDefaultLabel,
    success: action.dataset.copySuccessLabel,
    error: action.dataset.copyErrorLabel,
  };
  const text = overrides[state] || defaults[state];

  const label =
    action.querySelector("[data-copy-label]") ||
    [...action.children]
      .reverse()
      .find((child) => child.getAttribute("aria-hidden") !== "true");

  if (label) {
    label.textContent = text;
  } else if (!action.firstElementChild) {
    action.textContent = text;
  }

  action.setAttribute("aria-label", text);
  action.dataset.copyState = state;
  action.classList.toggle("is-copied", state === "success");
  action.classList.toggle("has-error", state === "error");

  return text;
}

function mountCopyAction(action) {
  const controller = new AbortController();
  const { signal } = controller;
  let pending = false;
  let feedbackTimer;

  mountedActions.add(action);
  setState(action, "idle");

  async function handleClick(event) {
    if (event.defaultPrevented) return;
    event.preventDefault();

    if (pending || action.matches(':disabled, [aria-disabled="true"]')) {
      return;
    }

    const target = findById(action, action.dataset.copyTarget.trim());
    const status = findById(action, action.dataset.copyStatus?.trim());

    clearTimeout(feedbackTimer);

    if (status) status.textContent = "";

    pending = true;
    action.setAttribute("aria-busy", "true");

    let state = "error";

    try {
      const clipboard = action.ownerDocument.defaultView?.navigator.clipboard;

      if (target && clipboard) {
        const text =
          typeof target.value === "string"
            ? target.value
            : target.textContent.trim();

        await clipboard.writeText(text);
        state = "success";
      }
    } catch {
      // Report a failed write through the same feedback as a missing target.
    }

    if (signal.aborted) return;

    pending = false;
    action.removeAttribute("aria-busy");

    const feedback = setState(action, state);

    if (status) status.textContent = feedback;

    const configuredDuration = Number(action.dataset.copyFeedbackDuration);
    const duration =
      Number.isFinite(configuredDuration) && configuredDuration >= 0
        ? configuredDuration
        : DEFAULT_FEEDBACK_DURATION;

    feedbackTimer = setTimeout(() => setState(action, "idle"), duration);
  }

  action.addEventListener("click", handleClick, { signal });

  return () => {
    if (signal.aborted) return;

    controller.abort();
    clearTimeout(feedbackTimer);
    action.removeAttribute("aria-busy");
    setState(action, "idle");
    mountedActions.delete(action);
  };
}

export function initClipboardActions(root = document) {
  const actions = [...root.querySelectorAll(SELECTOR)];

  if (root.matches?.(SELECTOR)) {
    actions.unshift(root);
  }

  const disposers = [];

  for (const action of actions) {
    if (!mountedActions.has(action)) {
      disposers.push(mountCopyAction(action));
    }
  }

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
