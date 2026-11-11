const activeDialogs = new WeakMap();
let titleId = 0;

function labelDialog(modal, titleSelector) {
  if (modal.hasAttribute("aria-labelledby") || modal.hasAttribute("aria-label"))
    return;

  const title = modal.querySelector(titleSelector);
  if (!title) return;

  if (!title.id) {
    const scope = modal.getRootNode();
    let id;
    do {
      id = `dialog-title-${++titleId}`;
    } while (scope.getElementById?.(id));
    title.id = id;
  }

  modal.setAttribute("aria-labelledby", title.id);
}

function lockScroll(doc) {
  const { body, defaultView: view } = doc;
  const width = Math.max(0, view.innerWidth - doc.documentElement.clientWidth);
  const properties = ["overflow", "padding-inline-end"];
  const saved = properties.map((name) => [
    name,
    body.style.getPropertyValue(name),
    body.style.getPropertyPriority(name),
  ]);
  const padding = parseFloat(view.getComputedStyle(body).paddingInlineEnd) || 0;

  body.style.setProperty("overflow", "hidden");
  if (width)
    body.style.setProperty("padding-inline-end", `${padding + width}px`);

  return () => {
    for (const [name, value, priority] of saved) {
      if (value) body.style.setProperty(name, value, priority);
      else body.style.removeProperty(name);
    }
  };
}

function finishClose(state, restoreFocus) {
  const { modal, trigger, doc, events, unlock } = state;
  if (activeDialogs.get(doc) !== state) return;

  activeDialogs.delete(doc);
  events.abort();
  unlock?.();
  modal.classList.remove("is-open");

  if (restoreFocus && trigger?.isConnected) {
    trigger.focus({ preventScroll: true });
  }

  state.onClose(trigger);
}

function isBackdropEvent(event, modal) {
  if (event.target !== modal) return false;

  const { left, right, top, bottom } = modal.getBoundingClientRect();
  return (
    event.clientX < left ||
    event.clientX > right ||
    event.clientY < top ||
    event.clientY > bottom
  );
}

export function getActiveDialog(doc = globalThis.document) {
  return activeDialogs.get(doc)?.modal ?? null;
}

export function openDialog(
  modal,
  trigger,
  { titleSelector, initialFocusSelector, dismiss, onOpen, onClose },
) {
  if (
    modal?.localName !== "dialog" ||
    !modal.isConnected ||
    modal.open ||
    typeof modal.showModal !== "function"
  )
    return false;

  const doc = modal.ownerDocument;
  const view = doc.defaultView;
  const opener = trigger ?? modal.getRootNode().activeElement;
  const previous = getActiveDialog(doc);
  if (previous) closeDialog(previous, { restoreFocus: false });
  if (activeDialogs.has(doc)) return false;

  labelDialog(modal, titleSelector);
  modal.hidden = false;
  modal.removeAttribute("aria-hidden");

  const state = {
    modal,
    trigger: opener,
    doc,
    view,
    events: new view.AbortController(),
    onClose,
  };
  activeDialogs.set(doc, state);

  const { signal } = state.events;
  let pointerStartedOnBackdrop = false;

  modal.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      dismiss();
    },
    { signal },
  );

  modal.addEventListener(
    "close",
    () => {
      if (!modal.open) finishClose(state, true);
    },
    { signal },
  );

  modal.addEventListener(
    "pointerdown",
    (event) => {
      pointerStartedOnBackdrop =
        event.button === 0 && isBackdropEvent(event, modal);
    },
    { signal },
  );

  modal.addEventListener(
    "click",
    (event) => {
      const shouldDismiss =
        pointerStartedOnBackdrop && isBackdropEvent(event, modal);
      pointerStartedOnBackdrop = false;

      if (shouldDismiss) dismiss();
    },
    { signal },
  );

  try {
    modal.showModal();
  } catch (error) {
    state.events.abort();
    if (activeDialogs.get(doc) === state) activeDialogs.delete(doc);
    if (error.name === "InvalidStateError") return false;
    throw error;
  }

  if (activeDialogs.get(doc) !== state || !modal.open) return false;

  state.unlock = lockScroll(doc);
  modal.classList.add("is-open");
  modal.querySelector(initialFocusSelector)?.focus({ preventScroll: true });
  if (activeDialogs.get(doc) !== state || !modal.open) return false;
  onOpen(opener);
  return true;
}

export function closeDialog(
  modal = getActiveDialog(),
  { restoreFocus = true } = {},
) {
  if (modal?.localName !== "dialog") return false;

  const state = activeDialogs.get(modal.ownerDocument);
  if (state?.modal !== modal) return false;

  if (modal.open) modal.close();
  finishClose(state, restoreFocus);
  return true;
}
