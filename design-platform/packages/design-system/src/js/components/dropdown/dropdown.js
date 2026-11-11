import { DropdownPositioner } from "./position.js";

export const DROPDOWN_SELECTOR = "[data-dropdown]";
const instances = new WeakMap();
const activeMenus = new WeakMap();
const itemSelector = 'button[role="menuitem"], a[href][role="menuitem"]';
const isDisabled = (element) =>
  element.matches(':disabled, .is-disabled, [aria-disabled="true"]');

let nextId = 0;

function ensureId(element, prefix) {
  const scope = element.getRootNode();
  if (!element.id) {
    let id;
    do {
      id = `${prefix}-${++nextId}`;
    } while (scope.getElementById?.(id));
    element.id = id;
  }
  return element.id;
}

export class Dropdown {
  static getInstance(root) {
    return instances.get(root);
  }

  static getOrCreateInstance(root) {
    const owned = (selector) =>
      Array.from(root.querySelectorAll(selector)).find(
        (element) => element.closest(DROPDOWN_SELECTOR) === root,
      );
    const trigger = owned("button[data-dropdown-trigger]");
    const menu = owned("[data-dropdown-menu]");
    const existing = instances.get(root);

    if (existing && existing.trigger === trigger && existing.menu === menu) {
      existing.refresh();
      return existing;
    }

    existing?.destroy();
    return trigger && menu ? new Dropdown(root, trigger, menu) : null;
  }

  constructor(root, trigger, menu) {
    this.root = root;
    this.trigger = trigger;
    this.menu = menu;
    this.doc = root.ownerDocument;
    this.view = this.doc.defaultView;
    this.events = new this.view.AbortController();
    this.originalPopover = menu.getAttribute("popover");
    this.usePopover = typeof menu.showPopover === "function";
    this.isOpen = false;
    this.positioner = new DropdownPositioner({
      root,
      trigger,
      menu,
      onUnavailable: () => this.close({ restoreFocus: this.menuHasFocus() }),
    });

    trigger.type = "button";
    trigger.setAttribute("aria-haspopup", "menu");
    trigger.setAttribute("aria-controls", ensureId(menu, "dropdown-menu"));
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-labelledby", ensureId(trigger, "dropdown-trigger"));
    if (this.usePopover) menu.setAttribute("popover", "manual");
    this.syncState(false);
    this.refresh();

    const { signal } = this.events;
    trigger.addEventListener(
      "click",
      () => {
        if (this.isOpen) this.close({ restoreFocus: true });
        else this.open();
      },
      { signal },
    );

    root.addEventListener("keydown", (event) => this.handleKeydown(event), {
      signal,
    });
    menu.addEventListener("click", (event) => this.handleAction(event), {
      capture: true,
      signal,
    });

    instances.set(root, this);
  }

  get items() {
    return Array.from(this.menu.querySelectorAll(itemSelector)).filter(
      (item) => item.closest(DROPDOWN_SELECTOR) === this.root,
    );
  }

  refresh() {
    for (const item of this.items) item.tabIndex = -1;
    if (isDisabled(this.trigger)) this.close();
    else if (this.isOpen) this.positioner.schedule();
  }

  menuHasFocus() {
    return this.menu.contains(this.menu.getRootNode().activeElement);
  }

  syncState(expanded) {
    this.trigger.setAttribute("aria-expanded", String(expanded));
    this.menu.hidden = !expanded;
    this.root.classList.toggle("is-open", expanded);
    this.menu.classList.toggle("is-open", expanded);
    if (expanded) this.menu.dataset.open = "true";
    else delete this.menu.dataset.open;
  }

  open({ focus = "first" } = {}) {
    if (!this.root.isConnected || isDisabled(this.trigger)) return false;

    this.refresh();
    const items = this.items.filter((item) => {
      const hiddenAncestor = item.closest("[hidden]");
      return (
        !item.matches(":disabled") &&
        (!hiddenAncestor ||
          hiddenAncestor === this.menu ||
          !this.menu.contains(hiddenAncestor))
      );
    });
    if (!items.length) return false;

    if (!this.isOpen) {
      activeMenus.get(this.doc)?.close();
      this.isOpen = true;
      activeMenus.set(this.doc, this);
      this.menu.classList.add("is-measuring");
      this.syncState(true);
      if (this.usePopover) this.menu.showPopover();
      this.positioner.start();
      this.menu.classList.remove("is-measuring");
      if (!this.isOpen) return false;

      this.openEvents = new this.view.AbortController();
      const { signal } = this.openEvents;
      this.doc.addEventListener(
        "pointerdown",
        (event) => {
          if (!event.composedPath().includes(this.root)) this.close();
        },
        { capture: true, signal },
      );
      this.root.addEventListener(
        "focusout",
        () => {
          this.view.queueMicrotask(() => {
            if (
              !this.menuHasFocus() &&
              this.menu.getRootNode().activeElement !== this.trigger
            ) {
              this.close();
            }
          });
        },
        { signal },
      );

      this.emit("open");
    }

    if (this.isOpen && focus) {
      (focus === "last" ? items.at(-1) : items[0]).focus();
    }
    return this.isOpen;
  }

  close({ restoreFocus = false, emit = true } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.openEvents?.abort();
    this.positioner.stop();
    if (activeMenus.get(this.doc) === this) activeMenus.delete(this.doc);

    if (restoreFocus && this.trigger.isConnected && !isDisabled(this.trigger)) {
      this.trigger.focus({ preventScroll: true });
    }
    if (this.usePopover && this.menu.matches(":popover-open"))
      this.menu.hidePopover();
    this.syncState(false);
    if (emit) this.emit("close");
  }

  emit(state) {
    this.root.dispatchEvent(
      new this.view.CustomEvent(`dropdown:${state}`, {
        bubbles: true,
        detail: { trigger: this.trigger, menu: this.menu },
      }),
    );
  }

  handleAction(event) {
    const item = event.target.closest?.(itemSelector);
    if (!item || !this.items.includes(item)) return;

    if (isDisabled(item)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    this.view.queueMicrotask(() => {
      this.close({ restoreFocus: this.menuHasFocus() });
    });
  }

  handleKeydown(event) {
    if (
      event.defaultPrevented ||
      event.target.closest?.(DROPDOWN_SELECTOR) !== this.root
    )
      return;

    const { key } = event;
    if (key === "Escape" && this.isOpen) {
      event.preventDefault();
      event.stopPropagation();
      this.close({ restoreFocus: true });
      return;
    }

    if (event.target === this.trigger) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        this.open({ focus: key === "ArrowUp" ? "last" : "first" });
      }
      return;
    }

    if (!this.isOpen) return;
    const items = this.items.filter(
      (item) => !item.matches(":disabled") && item.getClientRects().length,
    );
    const item = event.target.closest?.(itemSelector);
    const index = items.indexOf(item);
    if (index < 0) return;

    if (key === "Tab") {
      // Start native Tab navigation from the trigger before hiding the menu.
      this.close({ restoreFocus: true });
      return;
    }
    if (key === " " && item.tagName === "A") {
      event.preventDefault();
      item.click();
      return;
    }

    let next;
    switch (key) {
      case "ArrowDown":
        next = (index + 1) % items.length;
        break;
      case "ArrowUp":
        next = (index - 1 + items.length) % items.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    items[next].focus();
  }

  destroy() {
    this.events.abort();
    this.close({ emit: false });
    this.positioner.destroy();
    if (this.originalPopover === null) this.menu.removeAttribute("popover");
    else this.menu.setAttribute("popover", this.originalPopover);
    instances.delete(this.root);
  }
}
