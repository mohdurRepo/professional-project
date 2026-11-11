import { disposeToasts, prepareToasts, showToast } from "./toast.js";

const lifecycles = new WeakMap();

export function initToasts(doc = globalThis.document) {
  if (!doc?.body) return () => {};

  const existing = lifecycles.get(doc);
  if (existing) return existing;

  const events = new doc.defaultView.AbortController();
  prepareToasts(doc);

  doc.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;

      const trigger = event
        .composedPath()
        .find((element) => element.matches?.("[data-toast]"));
      if (
        !trigger ||
        trigger.matches(':disabled, .is-disabled, [aria-disabled="true"]')
      ) {
        return;
      }

      const {
        toast: type,
        toastTitle: title,
        toastMessage: message,
        toastDuration: duration,
        toastCloseLabel: closeLabel,
      } = trigger.dataset;

      showToast({ type, title, message, duration, closeLabel }, doc);
    },
    { signal: events.signal },
  );

  function dispose() {
    if (lifecycles.get(doc) !== dispose) return;

    events.abort();
    lifecycles.delete(doc);
    disposeToasts(doc);
  }

  lifecycles.set(doc, dispose);
  return dispose;
}

export { showToast };
