import { closeDialog, getActiveDialog, openDialog } from "../dialog/dialog.js";

export const DRAWER_SELECTOR = "dialog.drawer[data-drawer]";
const animations = new WeakMap();

function resolveDrawer(name, scope = globalThis.document) {
  if (typeof name !== "string") return name;
  return Array.from(scope?.querySelectorAll(DRAWER_SELECTOR) ?? []).find(
    (drawer) => drawer.dataset.drawer === name,
  );
}

function setTriggerState(drawer, expanded) {
  const name = drawer.dataset.drawer;
  for (const trigger of drawer
    .getRootNode()
    .querySelectorAll("[data-drawer-open]")) {
    if (trigger.dataset.drawerOpen !== name) continue;
    trigger.setAttribute("aria-expanded", String(expanded));
    trigger.classList.toggle("is-active", expanded);
  }
}

function emit(drawer, event) {
  const doc = drawer.ownerDocument;
  doc.dispatchEvent(
    new doc.defaultView.CustomEvent(`drawer:${event}`, {
      detail: { drawer, name: drawer.dataset.drawer },
    }),
  );
}

function respectMotionPreference(drawer, animation) {
  const doc = drawer.ownerDocument;
  const view = doc.defaultView;
  const events = new view.AbortController();
  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");

  function finishIfReduced() {
    if (
      reducedMotion.matches ||
      doc.documentElement.dataset.motionPreference === "reduce"
    ) {
      animation.finish();
    }
  }

  reducedMotion.addEventListener("change", finishIfReduced, {
    signal: events.signal,
  });
  const observer = new view.MutationObserver(finishIfReduced);
  observer.observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion-preference"],
  });

  function dispose() {
    events.abort();
    observer.disconnect();
  }

  animation.finished.then(dispose, dispose);
  finishIfReduced();
}

function playSlide(drawer, closing) {
  const view = drawer.ownerDocument.defaultView;
  const style = view.getComputedStyle(drawer);
  const token = style.getPropertyValue("--transition-normal").trim();
  const duration = token.endsWith("ms")
    ? parseFloat(token)
    : parseFloat(token) * 1000;
  const start = drawer.classList.contains("drawer-start");
  const rtl = style.direction === "rtl";
  const offscreen = `translateX(${start === rtl ? "100%" : "-100%"})`;
  const current = style.transform;
  animations.get(drawer)?.cancel();
  animations.delete(drawer);
  if (!(duration > 0) || !drawer.animate) return null;

  const animation = drawer.animate(
    closing
      ? [{ transform: current }, { transform: offscreen }]
      : [{ transform: offscreen }, { transform: "translateX(0)" }],
    { duration, easing: closing ? "ease-in" : "ease-out" },
  );
  animations.set(drawer, animation);
  respectMotionPreference(drawer, animation);
  return animation;
}

export function getActiveDrawer(doc = globalThis.document) {
  const drawer = getActiveDialog(doc);
  return drawer?.matches(DRAWER_SELECTOR) ? drawer : null;
}

export function openDrawer(name, trigger = null) {
  const drawer = resolveDrawer(name, trigger?.getRootNode());
  if (!drawer?.matches?.(DRAWER_SELECTOR)) return false;
  if (getActiveDrawer(drawer.ownerDocument) === drawer) return true;

  return openDialog(drawer, trigger, {
    titleSelector: ".drawer-title",
    initialFocusSelector: "[data-drawer-initial-focus]",
    dismiss: () => {
      if (drawer.dataset.drawerStatic !== "true") closeDrawer(drawer);
    },
    onOpen: () => {
      setTriggerState(drawer, true);
      playSlide(drawer, false);
      emit(drawer, "open");
    },
    onClose: () => {
      animations.get(drawer)?.cancel();
      animations.delete(drawer);
      const wasClosing = drawer.classList.contains("is-closing");
      drawer.classList.remove("is-closing");
      setTriggerState(drawer, false);
      if (!wasClosing) emit(drawer, "close");
      emit(drawer, "closed");
    },
  });
}

export function closeDrawer(
  name = getActiveDrawer(),
  { restoreFocus = true, immediate = false } = {},
) {
  const drawer = resolveDrawer(name);
  if (
    !drawer?.matches?.(DRAWER_SELECTOR) ||
    getActiveDrawer(drawer.ownerDocument) !== drawer
  )
    return false;
  if (immediate) return closeDialog(drawer, { restoreFocus });
  if (drawer.classList.contains("is-closing")) return false;

  drawer.classList.add("is-closing");
  setTriggerState(drawer, false);
  emit(drawer, "close");
  if (getActiveDrawer(drawer.ownerDocument) !== drawer) return true;

  const animation = playSlide(drawer, true);
  if (!animation) return closeDialog(drawer, { restoreFocus });

  function finishClose() {
    if (animations.get(drawer) === animation)
      closeDialog(drawer, { restoreFocus });
  }

  animation.finished.then(finishClose, finishClose);
  return true;
}

export function toggleDrawer(name, trigger = null) {
  const drawer = resolveDrawer(name, trigger?.getRootNode());
  if (!drawer) return false;

  return getActiveDrawer(drawer.ownerDocument) === drawer
    ? closeDrawer(drawer)
    : openDrawer(drawer, trigger);
}
