export const TABLE_SHELL_SELECTOR = "[data-table-shell]";

const instances = new WeakMap();
const threshold = 2;
const labels = {
  en: { start: "Jump to first columns", end: "Jump to last columns" },
  ar: {
    start: "الانتقال إلى الأعمدة الأولى",
    end: "الانتقال إلى الأعمدة الأخيرة",
  },
};

export class TableScrollNavigation {
  static getInstance(shell) {
    return instances.get(shell) ?? null;
  }

  static getOrCreateInstance(shell) {
    const existing = this.getInstance(shell);
    const scroller = shell.querySelector("[data-table-scroll]");
    const jump = shell.querySelector(":scope > [data-table-scroll-jump]");

    if (existing?.scroller === scroller && existing.jump === jump) {
      existing.refresh();
      return existing;
    }

    existing?.destroy();
    return scroller && jump ? new this(shell, scroller, jump) : null;
  }

  constructor(shell, scroller, jump) {
    this.element = shell;
    this.scroller = scroller;
    this.jump = jump;
    this.view = shell.ownerDocument.defaultView;
    this.direction = "end";
    this.frame = null;
    this.events = new this.view.AbortController();

    const { signal } = this.events;
    scroller.addEventListener("scroll", () => this.scheduleRefresh(), {
      passive: true,
      signal,
    });
    jump.addEventListener("click", () => this.scrollToEdge(), { signal });
    this.view.addEventListener("resize", () => this.scheduleRefresh(), {
      signal,
    });

    this.resizeObserver = this.view.ResizeObserver
      ? new this.view.ResizeObserver(() => this.scheduleRefresh())
      : null;

    this.contentObserver = this.view.MutationObserver
      ? new this.view.MutationObserver(() => {
          this.observeSize();
          this.scheduleRefresh();
        })
      : null;

    this.observeSize();
    this.contentObserver?.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    instances.set(shell, this);
    this.refresh();
  }

  observeSize() {
    if (!this.resizeObserver) return;

    this.resizeObserver.disconnect();
    this.resizeObserver.observe(this.scroller);
    for (const child of this.scroller.children) {
      this.resizeObserver.observe(child);
    }
  }

  scheduleRefresh() {
    if (this.frame !== null) return;

    this.frame = this.view.requestAnimationFrame(() => {
      this.frame = null;
      this.refresh();
    });
  }

  get maxScroll() {
    return Math.max(0, this.scroller.scrollWidth - this.scroller.clientWidth);
  }

  get inlineSign() {
    return this.view.getComputedStyle(this.scroller).direction === "rtl"
      ? -1
      : 1;
  }

  refresh() {
    const max = this.maxScroll;
    if (!this.scroller.clientWidth || max <= threshold) {
      this.direction = "end";
      this.jump.hidden = true;
      this.element.removeAttribute("data-table-overflow");
      return;
    }

    const position = this.scroller.scrollLeft * this.inlineSign;
    const tolerance = Math.min(threshold, max / 3);
    const atStart = position <= tolerance;
    const atEnd = position >= max - tolerance;

    if (atEnd) this.direction = "start";
    if (atStart) this.direction = "end";

    const lang =
      this.jump.closest("[lang]")?.lang ||
      this.element.ownerDocument.documentElement.lang;
    const messages = /^ar(?:-|$)/i.test(lang) ? labels.ar : labels.en;
    this.jump.setAttribute("data-table-scroll-direction", this.direction);
    this.jump.setAttribute("aria-label", messages[this.direction]);
    this.element.setAttribute(
      "data-table-overflow",
      atStart ? "end" : atEnd ? "start" : "both",
    );
    this.jump.hidden = false;
  }

  scrollToEdge() {
    const left =
      this.direction === "end" ? this.maxScroll * this.inlineSign : 0;
    this.scroller.scrollTo({ left, behavior: "instant" });
    this.refresh();
  }

  destroy() {
    this.events.abort();
    this.resizeObserver?.disconnect();
    this.contentObserver?.disconnect();
    if (this.frame !== null) this.view.cancelAnimationFrame(this.frame);

    this.element.removeAttribute("data-table-overflow");
    this.jump.removeAttribute("data-table-scroll-direction");
    this.jump.hidden = true;
    instances.delete(this.element);
  }
}
