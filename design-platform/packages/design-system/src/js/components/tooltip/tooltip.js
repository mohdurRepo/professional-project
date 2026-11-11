import { positionTooltip } from "./position.js";

export const TOOLTIP_SELECTOR = ".tooltip";
const instances = new WeakMap();
let nextId = 0;

export class Tooltip {
  static getInstance(root) {
    return instances.get(root);
  }

  static getOrCreateInstance(root) {
    const content = root.querySelector(":scope > .tooltip__content");
    const trigger = Array.from(root.children).find(
      (child) => child !== content,
    );
    const existing = instances.get(root);

    if (
      existing &&
      existing.content === content &&
      existing.trigger === trigger
    )
      return existing;

    existing?.destroy();
    return content && trigger ? new Tooltip(root, trigger, content) : null;
  }

  constructor(root, trigger, content) {
    this.root = root;
    this.trigger = trigger;
    this.content = content;
    this.doc = root.ownerDocument;
    this.view = this.doc.defaultView;
    this.events = new this.view.AbortController();
    this.openEvents = null;
    this.frame = null;
    this.closeTimer = null;
    this.overTrigger = false;
    this.overContent = false;
    this.focused = trigger.contains(trigger.getRootNode().activeElement);
    this.dismissed = false;
    this.touchOpen = false;

    const scope = content.getRootNode();
    if (!content.id) {
      let id;
      do {
        id = `tooltip-${++nextId}`;
      } while (scope.getElementById?.(id));
      content.id = id;
    }

    this.descriptionId = content.id;
    const descriptions = this.getDescriptions();
    this.addedDescription = !descriptions.includes(this.descriptionId);
    if (this.addedDescription) {
      trigger.setAttribute(
        "aria-describedby",
        [...descriptions, this.descriptionId].join(" "),
      );
    }

    this.originalRole = content.getAttribute("role");
    this.originalPopover = content.getAttribute("popover");
    this.usePopover = typeof content.showPopover === "function";
    content.setAttribute("role", "tooltip");
    if (this.usePopover) content.setAttribute("popover", "manual");
    content.hidden = true;

    const { signal } = this.events;
    for (const [element, property] of [
      [trigger, "overTrigger"],
      [content, "overContent"],
    ]) {
      element.addEventListener(
        "pointerenter",
        (event) => {
          if (event.pointerType === "touch") return;
          this[property] = true;
          this.syncVisibility();
        },
        { signal },
      );
      element.addEventListener(
        "pointerleave",
        (event) => {
          if (event.pointerType === "touch") return;
          this[property] = false;
          this.syncVisibility();
        },
        { signal },
      );
    }

    trigger.addEventListener(
      "focusin",
      () => {
        this.focused = true;
        this.syncVisibility();
      },
      { signal },
    );
    trigger.addEventListener(
      "focusout",
      (event) => {
        this.focused = trigger.contains(event.relatedTarget);
        this.syncVisibility();
      },
      { signal },
    );

    if (root.hasAttribute("data-tooltip-touch")) {
      trigger.addEventListener(
        "click",
        (event) => {
          if (event.pointerType !== "touch") return;

          if (this.touchOpen) {
            this.dismiss();
          } else {
            this.touchOpen = true;
            this.dismissed = false;
            this.syncVisibility();
          }
        },
        { signal },
      );
    }

    instances.set(root, this);
    this.syncVisibility();
  }

  getDescriptions() {
    return (
      this.trigger
        .getAttribute("aria-describedby")
        ?.split(/\s+/)
        .filter(Boolean) ?? []
    );
  }

  syncVisibility() {
    this.view.clearTimeout(this.closeTimer);
    this.closeTimer = null;

    if (
      this.overTrigger ||
      this.overContent ||
      this.focused ||
      this.touchOpen
    ) {
      if (!this.dismissed) this.open();
      return;
    }

    this.closeTimer = this.view.setTimeout(() => {
      this.dismissed = false;
      this.close();
    }, 250);
  }

  open() {
    if (this.openEvents || !this.root.isConnected) return;

    const { content } = this;
    content.classList.add("is-measuring");
    content.hidden = false;

    if (this.usePopover) content.showPopover();
    const positioned = positionTooltip(this.root, this.trigger, content);
    content.classList.remove("is-measuring");

    if (!positioned) {
      this.close();
      return;
    }

    this.openEvents = new this.view.AbortController();
    const { signal } = this.openEvents;
    const schedule = () => this.schedulePosition();

    this.doc.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        this.dismiss();
      },
      { capture: true, signal },
    );

    this.doc.addEventListener(
      "pointerdown",
      (event) => {
        if (this.touchOpen && !event.composedPath().includes(this.root)) {
          this.dismiss();
        }
      },
      { capture: true, signal },
    );

    this.view.addEventListener("resize", schedule, { signal });
    this.doc.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
      signal,
    });
    this.view.visualViewport?.addEventListener("resize", schedule, { signal });
    this.view.visualViewport?.addEventListener("scroll", schedule, {
      passive: true,
      signal,
    });

    if (this.view.ResizeObserver) {
      this.resizeObserver = new this.view.ResizeObserver(schedule);
      this.resizeObserver.observe(this.trigger);
      this.resizeObserver.observe(content);
    }
  }

  schedulePosition() {
    if (!this.openEvents || this.frame !== null) return;

    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null;
      if (!positionTooltip(this.root, this.trigger, this.content)) this.close();
    });
  }

  dismiss() {
    this.touchOpen = false;
    this.dismissed = this.overTrigger || this.focused;
    this.close();
  }

  close() {
    this.openEvents?.abort();
    this.openEvents = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.overContent = false;

    if (this.usePopover && this.content.matches(":popover-open"))
      this.content.hidePopover();
    this.content.hidden = true;
  }

  destroy() {
    this.events.abort();
    this.view.clearTimeout(this.closeTimer);
    this.close();

    if (this.addedDescription) {
      const descriptions = this.getDescriptions().filter(
        (id) => id !== this.descriptionId,
      );
      if (descriptions.length)
        this.trigger.setAttribute("aria-describedby", descriptions.join(" "));
      else this.trigger.removeAttribute("aria-describedby");
    }

    if (this.originalRole === null) this.content.removeAttribute("role");
    else this.content.setAttribute("role", this.originalRole);
    if (this.originalPopover === null) this.content.removeAttribute("popover");
    else this.content.setAttribute("popover", this.originalPopover);

    instances.delete(this.root);
  }
}
