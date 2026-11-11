import { closeDialog, getActiveDialog, openDialog } from "../dialog/dialog.js";

export const MODAL_SELECTOR = "dialog.modal";

function emit(modal, trigger, name) {
  const view = modal.ownerDocument.defaultView;
  modal.dispatchEvent(
    new view.CustomEvent(`modal:${name}`, {
      bubbles: true,
      detail: { modal, trigger },
    }),
  );
}

export function getActiveModal(doc = globalThis.document) {
  const modal = getActiveDialog(doc);
  return modal?.matches(MODAL_SELECTOR) ? modal : null;
}

export function openModal(modal, trigger = null) {
  if (!modal?.matches?.(MODAL_SELECTOR)) return false;

  return openDialog(modal, trigger, {
    titleSelector: ".modal-title",
    initialFocusSelector: "[data-modal-initial-focus]",
    dismiss: () => {
      if (modal.dataset.modalStatic !== "true") closeModal(modal);
    },
    onOpen: (opener) => emit(modal, opener, "open"),
    onClose: (opener) => emit(modal, opener, "close"),
  });
}

export function closeModal(modal = getActiveModal(), options) {
  if (!modal?.matches?.(MODAL_SELECTOR)) return false;
  return closeDialog(modal, options);
}
