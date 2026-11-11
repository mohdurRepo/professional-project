import {
  MODAL_SELECTOR,
  closeModal,
  getActiveModal,
  openModal,
} from "./modal.js";

const lifecycles = new WeakMap();

export function initModals(scope = globalThis.document) {
  if (!scope) return () => {};

  const existing = lifecycles.get(scope);
  if (existing) return existing;

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const view = doc.defaultView;
  const events = new view.AbortController();
  let openedModal = null;

  scope.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;

      const control = event
        .composedPath()
        .find((element) =>
          element.matches?.("[data-modal-open], [data-modal-close]"),
        );
      if (!control) return;

      if (control.matches(':disabled, .is-disabled, [aria-disabled="true"]')) {
        event.preventDefault();
        return;
      }

      if (control.hasAttribute("data-modal-open")) {
        const id = control.dataset.modalOpen.trim().replace(/^#/, "");
        const modal = control.getRootNode().getElementById?.(id);
        if (!modal?.matches(MODAL_SELECTOR)) return;

        event.preventDefault();
        if (openModal(modal, control)) openedModal = modal;
        return;
      }

      const modal = control.closest(MODAL_SELECTOR);
      if (!modal) return;

      event.preventDefault();
      closeModal(modal);
    },
    { signal: events.signal },
  );

  const observer = view.MutationObserver
    ? new view.MutationObserver(() => {
        const modal = getActiveModal(doc);
        if (modal && !modal.isConnected)
          closeModal(modal, { restoreFocus: false });
      })
    : null;

  observer?.observe(doc, { childList: true, subtree: true });
  if (scope.nodeType === 11) {
    observer?.observe(scope, { childList: true, subtree: true });
  }

  function disposeModals() {
    if (lifecycles.get(scope) !== disposeModals) return;

    events.abort();
    observer?.disconnect();
    lifecycles.delete(scope);

    const modal = getActiveModal(doc);
    if (modal && (modal === openedModal || scope.contains(modal))) {
      closeModal(modal);
    }
  }

  lifecycles.set(scope, disposeModals);
  return disposeModals;
}

export { closeModal, openModal };
