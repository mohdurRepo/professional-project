import { TABS_SELECTOR, Tabs } from "./tabs.js";

const lifecycles = new WeakMap();

function collectGroups(root) {
  const groups = Array.from(root?.querySelectorAll?.(TABS_SELECTOR) ?? []);
  if (root?.matches?.(TABS_SELECTOR)) groups.unshift(root);
  return groups;
}

function isStructureChange(target, group) {
  return (
    target === group ||
    (target.parentElement === group &&
      target.matches(".tabs-nav, .tabs-content"))
  );
}

export function refreshTabs(root = globalThis.document) {
  return collectGroups(root).map((group) => {
    const existing = Tabs.getInstance(group);
    if (!existing) return Tabs.getOrCreateInstance(group);

    existing.refresh({ emit: true });
    return existing;
  });
}

export function initTabs(root = globalThis.document) {
  if (!root) return () => {};
  const existing = lifecycles.get(root);
  if (existing) return existing;

  const groups = new Set(collectGroups(root));
  for (const group of groups) Tabs.getOrCreateInstance(group);

  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const Observer = doc?.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        const pending = new Set();

        for (const record of records) {
          const target = record.target;
          const group = target.closest?.(TABS_SELECTOR);

          if (record.type === "attributes") {
            if (group && target.matches('[role="tab"], [role="tabpanel"]')) {
              pending.add(group);
            }
            continue;
          }

          if (group && isStructureChange(target, group)) pending.add(group);
          for (const node of record.addedNodes) {
            for (const added of collectGroups(node)) pending.add(added);
          }
        }

        for (const group of groups) {
          if (root.contains(group)) continue;
          Tabs.getInstance(group)?.destroy();
          groups.delete(group);
        }

        for (const group of pending) {
          if (!root.contains(group)) continue;
          const instance = Tabs.getInstance(group);
          if (instance) instance.refresh({ emit: true });
          else Tabs.getOrCreateInstance(group);
          groups.add(group);
        }
      })
    : null;

  observer?.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["disabled", "aria-disabled", "data-tab-target", "id"],
  });

  function disposeTabs() {
    if (lifecycles.get(root) !== disposeTabs) return;

    observer?.disconnect();
    for (const group of groups) Tabs.getInstance(group)?.destroy();
    groups.clear();
    lifecycles.delete(root);
  }

  lifecycles.set(root, disposeTabs);
  return disposeTabs;
}

export { Tabs };
