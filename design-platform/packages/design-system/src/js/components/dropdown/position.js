const POSITION_PROPERTIES = [
  "--dropdown-top",
  "--dropdown-left",
  "--dropdown-available-height",
  "--dropdown-trigger-width",
];

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(value, maximum));

export class DropdownPositioner {
  constructor({ root, trigger, menu, onUnavailable = () => {} }) {
    this.root = root;
    this.trigger = trigger;
    this.menu = menu;
    this.view = trigger.ownerDocument.defaultView;
    this.onUnavailable = onUnavailable;
    this.frame = null;
    this.events = null;
    this.resizeObserver = null;
    this.originalStyles = POSITION_PROPERTIES.map((name) => [
      name,
      menu.style.getPropertyValue(name),
      menu.style.getPropertyPriority(name),
    ]);
  }

  update() {
    const view = this.view;
    const visual = view.visualViewport;
    const viewportLeft = visual?.offsetLeft ?? 0;
    const viewportTop = visual?.offsetTop ?? 0;
    const viewportWidth =
      visual?.width ?? this.trigger.ownerDocument.documentElement.clientWidth;
    const viewportHeight = visual?.height ?? view.innerHeight;
    const anchor = this.trigger.getBoundingClientRect();
    const style = view.getComputedStyle(this.menu);
    const rootFontSize = parseFloat(
      view.getComputedStyle(this.trigger.ownerDocument.documentElement)
        .fontSize,
    );

    // The SCSS contract exposes spacing as rem or px values.
    const readLength = (name, fallback) => {
      const value = style.getPropertyValue(name).trim();
      const number = parseFloat(value);
      if (!Number.isFinite(number)) return fallback;
      return value.endsWith("rem") ? number * rootFontSize : number;
    };

    if (
      !anchor.width ||
      !anchor.height ||
      anchor.bottom <= viewportTop ||
      anchor.top >= viewportTop + viewportHeight ||
      anchor.right <= viewportLeft ||
      anchor.left >= viewportLeft + viewportWidth
    ) {
      this.onUnavailable();
      return false;
    }

    const gutter = readLength("--dropdown-viewport-gap", 12);
    const offset = readLength("--dropdown-offset", 8);
    const leftEdge = viewportLeft + gutter;
    const rightEdge = viewportLeft + viewportWidth - gutter;
    const topEdge = viewportTop + gutter;
    const bottomEdge = viewportTop + viewportHeight - gutter;

    this.menu.style.setProperty(
      "--dropdown-trigger-width",
      `${anchor.width}px`,
    );

    const below = Math.max(0, bottomEdge - anchor.bottom - offset);
    const above = Math.max(0, anchor.top - offset - topEdge);
    const preferredTop = this.menu.classList.contains("dropdown-menu--up");
    const naturalHeight =
      this.menu.scrollHeight +
      parseFloat(style.borderTopWidth || 0) +
      parseFloat(style.borderBottomWidth || 0);
    const preferredSpace = preferredTop ? above : below;
    const otherSpace = preferredTop ? below : above;
    const opensTop =
      naturalHeight <= preferredSpace || preferredSpace >= otherSpace
        ? preferredTop
        : !preferredTop;
    const available = opensTop ? above : below;

    this.menu.style.setProperty(
      "--dropdown-available-height",
      `${available}px`,
    );

    const panel = this.menu.getBoundingClientRect();
    const rtl = view.getComputedStyle(this.trigger).direction === "rtl";
    let left = rtl ? anchor.right - panel.width : anchor.left;

    if (this.root.classList.contains("dropdown--end")) {
      left = rtl ? anchor.left : anchor.right - panel.width;
    } else if (this.root.classList.contains("dropdown--center")) {
      left = anchor.left + (anchor.width - panel.width) / 2;
    }

    const top = opensTop
      ? anchor.top - offset - panel.height
      : anchor.bottom + offset;

    this.menu.style.setProperty(
      "--dropdown-left",
      `${clamp(left, leftEdge, rightEdge - panel.width)}px`,
    );
    this.menu.style.setProperty(
      "--dropdown-top",
      `${clamp(top, topEdge, bottomEdge - panel.height)}px`,
    );
    return true;
  }

  schedule() {
    if (!this.events || this.frame !== null) return;
    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null;
      this.update();
    });
  }

  start() {
    this.stop();
    this.events = new this.view.AbortController();
    const { signal } = this.events;
    const schedule = () => this.schedule();

    this.view.addEventListener("resize", schedule, { signal });
    this.trigger.ownerDocument.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
      signal,
    });
    this.view.visualViewport?.addEventListener("resize", schedule, { signal });
    this.view.visualViewport?.addEventListener("scroll", schedule, {
      signal,
      passive: true,
    });

    if (this.view.ResizeObserver) {
      this.resizeObserver = new this.view.ResizeObserver(schedule);
      this.resizeObserver.observe(this.trigger);
      this.resizeObserver.observe(this.menu);
    }

    this.update();
  }

  stop() {
    this.events?.abort();
    this.events = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  destroy() {
    this.stop();
    for (const [name, value, priority] of this.originalStyles) {
      if (value) this.menu.style.setProperty(name, value, priority);
      else this.menu.style.removeProperty(name);
    }
  }
}
