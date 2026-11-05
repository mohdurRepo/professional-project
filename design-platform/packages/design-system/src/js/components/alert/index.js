const initializedRoots = new WeakMap();

/**
 * Hides an alert.
 *
 * When focus is inside the alert, focusTarget must be a focusable
 * element outside it. Dismissal is canceled if focus cannot move safely.
 *
 * Returns true when dismissed, otherwise false.
 */
export function dismissAlert(alert, { focusTarget = null } = {}) {
  if (!alert?.matches?.(".alert") || !alert.isConnected || alert.hidden) {
    return false;
  }

  const document = alert.ownerDocument;
  const CustomEventClass = document.defaultView.CustomEvent;

  const beforeDismiss = new CustomEventClass("ds:alert-before-dismiss", {
    bubbles: true,
    cancelable: true,
  });

  if (!alert.dispatchEvent(beforeDismiss)) {
    return false;
  }

  // Event handlers may have changed the DOM.
  if (!alert.isConnected || alert.hidden) {
    return false;
  }

  if (alert.contains(document.activeElement)) {
    if (
      !focusTarget?.isConnected ||
      typeof focusTarget.focus !== "function" ||
      focusTarget.ownerDocument !== document ||
      alert.contains(focusTarget)
    ) {
      return false;
    }

    focusTarget.focus();

    // A hidden, inert, disabled, or otherwise unfocusable destination
    // must not cause the currently focused alert to disappear.
    if (
      document.activeElement !== focusTarget ||
      alert.contains(document.activeElement)
    ) {
      return false;
    }
  }

  alert.hidden = true;

  alert.dispatchEvent(
    new CustomEventClass("ds:alert-dismissed", {
      bubbles: true,
    }),
  );

  return true;
}

/**
 * Enables dismissal within a Document, Element, or ShadowRoot.
 *
 * Repeated initialization of the same root returns its existing cleanup.
 * Delegation also handles alerts inserted after initialization.
 */
export function initAlerts(root = document) {
  if (
    typeof root?.addEventListener !== "function" ||
    typeof root?.querySelectorAll !== "function"
  ) {
    throw new TypeError(
      "initAlerts() requires a Document, Element, or ShadowRoot.",
    );
  }

  const existingCleanup = initializedRoots.get(root);

  if (existingCleanup) {
    return existingCleanup;
  }

  function handleClick(event) {
    if (event.defaultPrevented) {
      return;
    }

    const control = event.target?.closest?.("button[data-alert-dismiss]");

    if (
      !control ||
      !root.contains(control) ||
      control.matches(":disabled, [aria-disabled='true']")
    ) {
      return;
    }

    const alert = control.closest(".alert");

    if (!alert || !root.contains(alert)) {
      return;
    }

    event.preventDefault();

    const focusId = alert.getAttribute("data-alert-focus");
    const tree = alert.getRootNode();

    const focusTarget = focusId ? tree.getElementById(focusId) : null;

    dismissAlert(alert, { focusTarget });
  }

  root.addEventListener("click", handleClick);

  function cleanup() {
    root.removeEventListener("click", handleClick);
    initializedRoots.delete(root);
  }

  initializedRoots.set(root, cleanup);

  return cleanup;
}
