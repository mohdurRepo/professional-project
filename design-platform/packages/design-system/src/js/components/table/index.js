import {
  TABLE_SHELL_SELECTOR,
  TableScrollNavigation,
} from "./table-scroll-navigation.js";

function collectTableShells(root) {
  const shells = Array.from(
    root?.querySelectorAll?.(TABLE_SHELL_SELECTOR) ?? [],
  );

  if (root?.matches?.(TABLE_SHELL_SELECTOR)) {
    shells.unshift(root);
  }

  return shells;
}

export function initTables(root = globalThis.document) {
  return collectTableShells(root)
    .map((shell) => TableScrollNavigation.getOrCreateInstance(shell))
    .filter(Boolean);
}

export function destroyTables(root = globalThis.document) {
  let count = 0;

  for (const shell of collectTableShells(root)) {
    const instance = TableScrollNavigation.getInstance(shell);

    if (instance) {
      instance.destroy();
      count += 1;
    }
  }

  return count;
}

// Initialization also refreshes existing instances and rebinds replaced scrollers.
export { initTables as refreshTables, TableScrollNavigation };
