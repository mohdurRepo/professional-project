import { CustomDate } from "./custom-date.js";
import { SELECTORS } from "./constants.js";

const observers = new WeakMap();

function getDocument(root) {
  return root?.nodeType === 9 ? root : root?.ownerDocument;
}

function collectDates(root) {
  const elements = Array.from(
    root?.querySelectorAll?.(SELECTORS.component) ?? [],
  );
  if (root?.matches?.(SELECTORS.component)) {
    elements.unshift(root);
  }

  return elements;
}

function initializeDates(root) {
  return collectDates(root)
    .map((element) => CustomDate.getOrCreateInstance(element))
    .filter(Boolean);
}

function observeDates(doc) {
  const Observer = doc?.defaultView?.MutationObserver;
  if (!Observer || !doc.documentElement || observers.has(doc)) {
    return;
  }

  const observer = new Observer((records) => {
    const removed = new Set();
    const added = new Set();

    for (const record of records) {
      for (const node of record.removedNodes) {
        for (const element of collectDates(node)) {
          removed.add(element);
        }
      }

      for (const node of record.addedNodes) {
        if (node.isConnected && node.ownerDocument === doc) {
          for (const element of collectDates(node)) {
            added.add(element);
          }
        }
      }
    }

    for (const element of removed) {
      if (!element.isConnected || element.ownerDocument !== doc) {
        CustomDate.getInstance(element)?.destroy();
      }
    }

    for (const element of added) {
      CustomDate.getOrCreateInstance(element);
    }
  });

  observer.observe(doc.documentElement, { childList: true, subtree: true });
  observers.set(doc, observer);
}

export function initCustomDates(root = globalThis.document) {
  const instances = initializeDates(root);
  observeDates(getDocument(root));
  return instances;
}

export function refreshCustomDates(root = globalThis.document) {
  return collectDates(root)
    .map((element) => {
      const instance = CustomDate.getInstance(element);
      if (!instance) {
        return CustomDate.getOrCreateInstance(element);
      }

      instance.refresh();
      return instance;
    })
    .filter(Boolean);
}

export function destroyCustomDates(root = globalThis.document) {
  let count = 0;

  for (const element of collectDates(root)) {
    const instance = CustomDate.getInstance(element);
    if (instance) {
      instance.destroy();
      count += 1;
    }
  }

  return count;
}

export function isObservingCustomDates(root = globalThis.document) {
  return observers.has(getDocument(root));
}

export function stopObservingCustomDates(root = globalThis.document) {
  const doc = getDocument(root);
  const observer = observers.get(doc);
  if (!observer) {
    return false;
  }

  observer.disconnect();
  observers.delete(doc);
  return true;
}

export function closeCustomDate() {
  return CustomDate.closeActive();
}

export { CustomDate };
