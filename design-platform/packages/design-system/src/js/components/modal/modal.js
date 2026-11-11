export const MODAL_SELECTOR = "dialog.modal";

const activeModals = new WeakMap();
let titleId = 0;

function labelModal(modal) {
  if (modal.hasAttribute("aria-labelledby") || modal.hasAttribute("aria-label"))
    return;

  const title = modal.querySelector(".modal-title");
  if (!title) return;

  if (!title.id) {
    const scope = modal.getRootNode();
    let id;
    do {
      id = `modal-title-${++titleId}`;
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

function emit(state, name) {
  const { modal, trigger, view } = state;
  modal.dispatchEvent(
    new view.CustomEvent(`modal:${name}`, {
      bubbles: true,
      detail: { modal, trigger },
    }),
  );
}

function finishClose(state, restoreFocus) {
  const { modal, trigger, doc, events, unlock } = state;
  if (activeModals.get(doc) !== state) return;

  activeModals.delete(doc);
  events.abort();
  unlock?.();
  modal.classList.remove("is-open");

  if (restoreFocus && trigger?.isConnected) {
    trigger.focus({ preventScroll: true });
  }

  emit(state, "close");
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

export function getActiveModal(doc = globalThis.document) {
  return activeModals.get(doc)?.modal ?? null;
}

export function openModal(modal, trigger = null) {
  if (
    !modal?.matches?.(MODAL_SELECTOR) ||
    !modal.isConnected ||
    modal.open ||
    typeof modal.showModal !== "function"
  )
    return false;

  const doc = modal.ownerDocument;
  const view = doc.defaultView;
  const opener = trigger ?? modal.getRootNode().activeElement;
  const previous = getActiveModal(doc);
  if (previous) closeModal(previous, { restoreFocus: false });
  if (activeModals.has(doc)) return false;

  labelModal(modal);
  modal.hidden = false;
  modal.removeAttribute("aria-hidden");

  const state = {
    modal,
    trigger: opener,
    doc,
    view,
    events: new view.AbortController(),
  };
  activeModals.set(doc, state);

  const { signal } = state.events;
  let pointerStartedOnBackdrop = false;

  modal.addEventListener(
    "cancel",
    (event) => {
      event.preventDefault();
      if (modal.dataset.modalStatic !== "true") closeModal(modal);
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

      if (shouldDismiss && modal.dataset.modalStatic !== "true")
        closeModal(modal);
    },
    { signal },
  );

  try {
    modal.showModal();
  } catch (error) {
    state.events.abort();
    if (activeModals.get(doc) === state) activeModals.delete(doc);
    if (error.name === "InvalidStateError") return false;
    throw error;
  }

  if (activeModals.get(doc) !== state || !modal.open) return false;

  state.unlock = lockScroll(doc);
  modal.classList.add("is-open");
  modal
    .querySelector("[data-modal-initial-focus]")
    ?.focus({ preventScroll: true });
  if (activeModals.get(doc) !== state || !modal.open) return false;
  emit(state, "open");
  return true;
}

export function closeModal(
  modal = getActiveModal(),
  { restoreFocus = true } = {},
) {
  if (!modal?.matches?.(MODAL_SELECTOR)) return false;

  const state = activeModals.get(modal.ownerDocument);
  if (state?.modal !== modal) return false;

  if (modal.open) modal.close();
  finishClose(state, restoreFocus);
  return true;
}
