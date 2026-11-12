const HOVER_OPEN_DELAY = 120;
const HOVER_CLOSE_DELAY = 250;
const FOCUSABLE = "a[href], button:not(:disabled), [tabindex]";

export function bindDesktopNavigation(header, desktopQuery, signal) {
  const doc = header.ownerDocument;
  const view = doc.defaultView;
  const options = { signal };
  let active = null;
  let pinned = false;
  let hoverTimer;

  function cancelHover() {
    view.clearTimeout(hoverTimer);
  }

  function closeMenu({ restoreFocus = false } = {}) {
    cancelHover();

    if (!active) return;

    const { trigger, menu } = active;
    active = null;
    pinned = false;

    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;

    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function openMenu(parts, pin = false) {
    cancelHover();

    if (active !== parts) {
      closeMenu();
      active = parts;
      parts.menu.hidden = false;
      parts.trigger.setAttribute("aria-expanded", "true");
    }

    pinned = pin;
  }

  for (const item of header.querySelectorAll("[data-mega-item]")) {
    const trigger = item.querySelector("[data-mega-trigger]");
    const menu = item.querySelector("[data-mega-menu]");

    if (!trigger || !menu) continue;

    const parts = { item, trigger, menu };
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;

    item.addEventListener(
      "pointerenter",
      (event) => {
        if (event.pointerType !== "mouse" || !desktopQuery.matches) return;

        cancelHover();
        if (active === parts || pinned) return;

        hoverTimer = view.setTimeout(() => openMenu(parts), HOVER_OPEN_DELAY);
      },
      options,
    );

    item.addEventListener(
      "pointerleave",
      (event) => {
        if (event.pointerType !== "mouse") return;

        cancelHover();
        if (active !== parts || pinned || menu.contains(doc.activeElement)) {
          return;
        }

        hoverTimer = view.setTimeout(() => closeMenu(), HOVER_CLOSE_DELAY);
      },
      options,
    );

    trigger.addEventListener(
      "click",
      () => {
        if (!desktopQuery.matches) return;

        if (active === parts && pinned) {
          closeMenu();
        } else {
          openMenu(parts, true);
        }
      },
      options,
    );

    trigger.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "ArrowDown" || !desktopQuery.matches) return;

        event.preventDefault();
        openMenu(parts, true);

        const first = Array.from(menu.querySelectorAll(FOCUSABLE)).find(
          (element) => element.tabIndex >= 0 && !element.closest("[hidden]"),
        );

        first?.focus({ preventScroll: true });
      },
      options,
    );

    item.addEventListener(
      "focusout",
      (event) => {
        if (
          active === parts &&
          event.relatedTarget &&
          !item.contains(event.relatedTarget)
        ) {
          closeMenu();
        }
      },
      options,
    );
  }

  doc.addEventListener(
    "click",
    (event) => {
      if (active && !active.item.contains(event.target)) closeMenu();
    },
    options,
  );

  doc.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || !active) return;

      const restoreFocus = active.item.contains(doc.activeElement);
      if (restoreFocus) event.preventDefault();
      closeMenu({ restoreFocus });
    },
    options,
  );

  desktopQuery.addEventListener("change", () => closeMenu(), options);

  view.addEventListener(
    "pageshow",
    (event) => {
      if (event.persisted) closeMenu();
    },
    options,
  );

  signal.addEventListener("abort", () => closeMenu(), { once: true });
}
