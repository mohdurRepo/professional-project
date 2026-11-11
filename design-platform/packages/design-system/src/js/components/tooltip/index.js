import { TOOLTIP_SELECTOR, Tooltip } from "./tooltip.js";

const lifecycles = new WeakMap();

function collectTooltips(scope) {
  const roots = Array.from(scope?.querySelectorAll?.(TOOLTIP_SELECTOR) ?? []);
  if (scope?.matches?.(TOOLTIP_SELECTOR)) roots.unshift(scope);
  return roots;
}

export function refreshTooltips(scope = globalThis.document) {
  return collectTooltips(scope)
    .map((root) => Tooltip.getOrCreateInstance(root))
    .filter(Boolean);
}

export function initTooltips(scope = globalThis.document) {
  if (!scope) return () => {};

  const existing = lifecycles.get(scope);
  if (existing) return existing;

  const roots = new Set(collectTooltips(scope));
  for (const root of roots) Tooltip.getOrCreateInstance(root);

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const Observer = doc?.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        const pending = new Set();
        let checkRemovedRoots = false;

        for (const record of records) {
          if (record.target.matches?.(TOOLTIP_SELECTOR))
            pending.add(record.target);
          if (record.removedNodes.length) checkRemovedRoots = true;

          for (const node of record.addedNodes) {
            for (const root of collectTooltips(node)) pending.add(root);
          }
        }

        if (checkRemovedRoots) {
          for (const root of roots) {
            if (scope.contains(root)) continue;

            Tooltip.getInstance(root)?.destroy();
            roots.delete(root);
          }
        }

        for (const root of pending) {
          if (!scope.contains(root)) continue;

          Tooltip.getOrCreateInstance(root);
          roots.add(root);
        }
      })
    : null;

  observer?.observe(scope, { childList: true, subtree: true });

  function disposeTooltips() {
    if (lifecycles.get(scope) !== disposeTooltips) return;

    observer?.disconnect();
    for (const root of roots) Tooltip.getInstance(root)?.destroy();
    roots.clear();
    lifecycles.delete(scope);
  }

  lifecycles.set(scope, disposeTooltips);
  return disposeTooltips;
}

export { Tooltip };
