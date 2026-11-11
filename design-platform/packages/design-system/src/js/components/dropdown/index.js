import { DROPDOWN_SELECTOR, Dropdown } from "./dropdown.js";

const lifecycles = new WeakMap();

function collectDropdowns(scope) {
  const roots = Array.from(scope?.querySelectorAll?.(DROPDOWN_SELECTOR) ?? []);
  if (scope?.matches?.(DROPDOWN_SELECTOR)) roots.unshift(scope);
  return roots;
}

export function refreshDropdowns(scope = globalThis.document) {
  return collectDropdowns(scope)
    .map((root) => Dropdown.getOrCreateInstance(root))
    .filter(Boolean);
}

export function showDropdown(root, options) {
  return Dropdown.getOrCreateInstance(root)?.open(options) ?? false;
}

export function hideDropdown(root, options) {
  Dropdown.getInstance(root)?.close(options);
}

export function initDropdowns(scope = globalThis.document) {
  if (!scope) return () => {};

  const existing = lifecycles.get(scope);
  if (existing) return existing;

  const roots = new Set(collectDropdowns(scope));
  for (const root of roots) Dropdown.getOrCreateInstance(root);

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const Observer = doc?.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        const pending = new Set();
        let checkRemovedRoots = false;

        for (const record of records) {
          const root = record.target.closest?.(DROPDOWN_SELECTOR);
          if (root) pending.add(root);

          if (record.type === "attributes") {
            if (record.attributeName === "data-dropdown")
              checkRemovedRoots = true;
            continue;
          }

          if (record.removedNodes.length) checkRemovedRoots = true;
          for (const node of record.addedNodes) {
            for (const added of collectDropdowns(node)) pending.add(added);
          }
        }

        if (checkRemovedRoots) {
          for (const root of roots) {
            if (scope.contains(root) && root.matches(DROPDOWN_SELECTOR))
              continue;
            Dropdown.getInstance(root)?.destroy();
            roots.delete(root);
          }
        }

        for (const root of pending) {
          if (!scope.contains(root)) continue;
          Dropdown.getOrCreateInstance(root);
          roots.add(root);
        }
      })
    : null;

  observer?.observe(scope, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "data-dropdown",
      "data-dropdown-trigger",
      "data-dropdown-menu",
      "disabled",
      "aria-disabled",
    ],
  });

  function disposeDropdowns() {
    if (lifecycles.get(scope) !== disposeDropdowns) return;

    observer?.disconnect();
    for (const root of roots) Dropdown.getInstance(root)?.destroy();
    roots.clear();
    lifecycles.delete(scope);
  }

  lifecycles.set(scope, disposeDropdowns);
  return disposeDropdowns;
}

export { Dropdown };
