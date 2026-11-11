import {
  DRAWER_SELECTOR,
  closeDrawer,
  getActiveDrawer,
  openDrawer,
  toggleDrawer,
} from "./drawer.js";

const lifecycles = new WeakMap();
const openSelector = "[data-drawer-open]";
const closeSelector = "[data-drawer-close]";

export function initDrawers(scope = globalThis.document) {
  if (!scope) return () => {};

  const existing = lifecycles.get(scope);
  if (existing) return existing;

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  const view = doc.defaultView;
  const events = new view.AbortController();
  const { signal } = events;
  let openedDrawer = null;

  function syncTrigger(trigger) {
    const active = getActiveDrawer(doc);
    const expanded =
      active?.getRootNode() === trigger.getRootNode() &&
      active.dataset.drawer === trigger.dataset.drawerOpen &&
      !active.classList.contains("is-closing");

    trigger.setAttribute("aria-expanded", String(expanded));
    trigger.classList.toggle("is-active", expanded);
  }

  if (scope.matches?.(openSelector)) syncTrigger(scope);
  for (const trigger of scope.querySelectorAll(openSelector))
    syncTrigger(trigger);

  scope.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;

      const control = event
        .composedPath()
        .find((element) =>
          element.matches?.(`${openSelector}, ${closeSelector}`),
        );
      if (!control) return;

      if (control.matches(':disabled, .is-disabled, [aria-disabled="true"]')) {
        event.preventDefault();
        return;
      }

      if (control.matches(openSelector)) {
        const name = control.dataset.drawerOpen;
        const drawer = Array.from(
          control.getRootNode().querySelectorAll(DRAWER_SELECTOR),
        ).find((candidate) => candidate.dataset.drawer === name);
        if (!drawer) return;

        event.preventDefault();
        toggleDrawer(drawer, control);
        if (getActiveDrawer(doc) === drawer) openedDrawer = drawer;
        return;
      }

      const drawer = control.closest(DRAWER_SELECTOR);
      if (!drawer) return;

      event.preventDefault();
      closeDrawer(drawer);
    },
    { signal },
  );

  doc.addEventListener(
    "drawer:request-close",
    (event) => {
      const drawer = getActiveDrawer(doc);
      if (!drawer || (drawer !== openedDrawer && !scope.contains(drawer)))
        return;

      const { name, restoreFocus = true } = event.detail ?? {};
      if (name === drawer.dataset.drawer) closeDrawer(drawer, { restoreFocus });
    },
    { signal },
  );

  const observer = view.MutationObserver
    ? new view.MutationObserver((records) => {
        const drawer = getActiveDrawer(doc);
        if (drawer && !drawer.isConnected) {
          closeDrawer(drawer, { restoreFocus: false, immediate: true });
        }

        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!scope.contains(node)) continue;

            if (node.matches?.(openSelector)) syncTrigger(node);
            node.querySelectorAll?.(openSelector).forEach(syncTrigger);
          }
        }
      })
    : null;

  observer?.observe(doc, { childList: true, subtree: true });
  if (scope.nodeType === 11)
    observer?.observe(scope, { childList: true, subtree: true });

  function disposeDrawers() {
    if (lifecycles.get(scope) !== disposeDrawers) return;

    events.abort();
    observer?.disconnect();
    lifecycles.delete(scope);

    const drawer = getActiveDrawer(doc);
    if (drawer && (drawer === openedDrawer || scope.contains(drawer))) {
      closeDrawer(drawer, { immediate: true });
    }
  }

  lifecycles.set(scope, disposeDrawers);
  return disposeDrawers;
}

export { closeDrawer, openDrawer, toggleDrawer };
