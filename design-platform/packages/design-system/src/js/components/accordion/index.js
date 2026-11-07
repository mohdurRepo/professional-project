import { ACCORDION_SELECTOR, Accordion } from "./accordion.js";

const lifecycles = new WeakMap();

function collectAccordions(root) {
  const groups = Array.from(root?.querySelectorAll?.(ACCORDION_SELECTOR) ?? []);
  if (root?.matches?.(ACCORDION_SELECTOR)) groups.unshift(root);
  return groups;
}

function refreshGroup(group) {
  const existing = Accordion.getInstance(group);
  if (existing) {
    existing.refresh();
    return existing;
  }

  return Accordion.getOrCreateInstance(group);
}

export function refreshAccordions(root = globalThis.document) {
  return collectAccordions(root).map(refreshGroup);
}

export function collapseAccordions(root = globalThis.document) {
  for (const group of collectAccordions(root)) {
    refreshGroup(group).collapseAll();
  }
}

function affectsStructure(target, group) {
  if (target === group) return true;

  if (target.matches(".accordion-actions")) {
    return target.parentElement === group;
  }

  const item = target.closest(".accordion-item");
  return (
    item?.parentElement === group &&
    (target === item || target.matches(".accordion-heading"))
  );
}

function affectsState(record) {
  const target = record.target;

  if (record.attributeName === "data-accordion-multiple") return true;
  if (!target.matches("[data-accordion-trigger]")) return false;

  if (record.attributeName === "class") {
    const wasDisabled = (record.oldValue || "")
      .split(/\s+/)
      .includes("is-disabled");
    return wasDisabled !== target.classList.contains("is-disabled");
  }

  return true;
}

export function initAccordions(root = globalThis.document) {
  if (!root) return () => {};
  const existing = lifecycles.get(root);
  if (existing) return existing;

  const groups = new Set(collectAccordions(root));
  for (const group of groups) refreshGroup(group);

  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const Observer = doc?.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        const pending = new Set();

        for (const record of records) {
          const target = record.target;
          const group = target.closest?.(ACCORDION_SELECTOR);

          if (record.type === "attributes") {
            if (group && affectsState(record)) pending.add(group);
            continue;
          }

          if (group && affectsStructure(target, group)) pending.add(group);
          for (const node of record.addedNodes) {
            for (const added of collectAccordions(node)) pending.add(added);
          }
        }

        for (const group of groups) {
          if (root.contains(group)) continue;
          Accordion.getInstance(group)?.destroy();
          groups.delete(group);
        }

        for (const group of pending) {
          if (!root.contains(group)) continue;
          refreshGroup(group);
          groups.add(group);
        }
      })
    : null;

  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      "disabled",
      "aria-disabled",
      "class",
      "id",
      "data-accordion-multiple",
    ],
  });

  function disposeAccordions() {
    if (lifecycles.get(root) !== disposeAccordions) return;

    observer?.disconnect();
    for (const group of groups) Accordion.getInstance(group)?.destroy();
    groups.clear();
    lifecycles.delete(root);
  }

  lifecycles.set(root, disposeAccordions);
  return disposeAccordions;
}

export { Accordion };
