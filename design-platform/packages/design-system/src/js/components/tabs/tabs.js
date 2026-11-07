export const TABS_SELECTOR = ".tabs[data-tabs]";

const instances = new WeakMap();

function isEnabled(tab) {
  return !tab.matches(':disabled, .is-disabled, [aria-disabled="true"]');
}

function ensureTabId(tab, panel) {
  if (tab.id) return;

  const scope = tab.getRootNode();
  const base = `${panel.id}-tab`;
  let id = base;
  let suffix = 2;

  while (scope.getElementById?.(id)) {
    id = `${base}-${suffix++}`;
  }

  tab.id = id;
}

export class Tabs {
  static getInstance(root) {
    return instances.get(root);
  }

  static getOrCreateInstance(root) {
    return this.getInstance(root) ?? new this(root);
  }

  constructor(root) {
    this.root = root;
    this.view = root.ownerDocument.defaultView;
    this.events = new this.view.AbortController();
    this.pairs = new Map();
    this.tabs = [];
    this.panels = [];
    this.selectedTab = null;
    this.selectedPanel = null;

    const { signal } = this.events;
    root.addEventListener("click", (event) => this.handleClick(event), {
      signal,
    });
    root.addEventListener("keydown", (event) => this.handleKeydown(event), {
      signal,
    });
    root.addEventListener(
      "focusout",
      (event) => {
        if (
          this.nav?.contains(event.target) &&
          !this.nav.contains(event.relatedTarget)
        ) {
          this.setTabStop(this.selectedTab);
        }
      },
      { signal },
    );

    this.refresh();
    instances.set(root, this);
  }

  refresh({ emit = false } = {}) {
    this.nav = this.root.querySelector(":scope > .tabs-nav");
    this.tabs = Array.from(
      this.nav?.querySelectorAll(':scope > [role="tab"][data-tab-target]') ??
        [],
    );
    this.panels = Array.from(
      this.root.querySelectorAll(':scope > .tabs-content > [role="tabpanel"]'),
    );
    const availablePanels = new Map(
      this.panels.filter((panel) => panel.id).map((panel) => [panel.id, panel]),
    );
    this.pairs.clear();
    this.nav?.setAttribute("role", "tablist");

    for (const tab of this.tabs) {
      const target = tab.dataset.tabTarget.trim().replace(/^#/, "");
      const panel = availablePanels.get(target);

      if (!panel) continue;

      availablePanels.delete(target);
      ensureTabId(tab, panel);
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("aria-labelledby", tab.id);
      this.pairs.set(tab, panel);
    }

    const enabled = this.enabledTabs();
    const selected = enabled.includes(this.selectedTab)
      ? this.selectedTab
      : (enabled.find((tab) =>
          tab.matches('[aria-selected="true"], .active, .is-active'),
        ) ?? enabled[0]);

    if (selected) {
      this.activate(selected, { emit, reason: "refresh" });
    } else {
      this.selectedTab = null;
      this.selectedPanel = null;
      this.syncSelection();
    }
  }

  enabledTabs() {
    return Array.from(this.pairs.keys()).filter(isEnabled);
  }

  setTabStop(target) {
    for (const tab of this.tabs) {
      tab.tabIndex = tab === target ? 0 : -1;
    }
  }

  syncSelection() {
    for (const tab of this.tabs) {
      const selected = tab === this.selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.classList.toggle("active", selected);
      tab.classList.remove("is-active");
    }

    for (const panel of this.panels) {
      const selected = panel === this.selectedPanel;
      panel.hidden = Boolean(this.selectedPanel) && !selected;
      panel.classList.toggle("active", selected);
      panel.classList.remove("is-active");
      panel.removeAttribute("data-active");
      panel.removeAttribute("aria-hidden");
    }

    this.setTabStop(this.selectedTab);
  }

  activate(tab, { emit = true, reason = "programmatic" } = {}) {
    const panel = this.pairs.get(tab);
    if (!panel || !isEnabled(tab)) return false;

    const previousTab = this.selectedTab;
    const previousPanel = this.selectedPanel;
    this.selectedTab = tab;
    this.selectedPanel = panel;
    this.syncSelection();

    if (emit && (tab !== previousTab || panel !== previousPanel)) {
      const tabKey = (
        tab.dataset.tab ||
        tab.dataset.tabTarget ||
        panel.dataset.tab ||
        panel.id
      )
        .replace(/^#/, "")
        .trim();

      this.root.dispatchEvent(
        new this.view.CustomEvent("tabs:change", {
          bubbles: true,
          detail: Object.freeze({
            tab,
            panel,
            previousTab,
            previousPanel,
            tabKey,
            targetId: panel.id,
            reason,
          }),
        }),
      );
    }

    return true;
  }

  getEventTab(event) {
    const tab = event.target.closest?.('[role="tab"][data-tab-target]');
    return tab && tab.parentElement === this.nav ? tab : null;
  }

  handleClick(event) {
    const tab = this.getEventTab(event);
    if (!tab) return;

    event.preventDefault();
    this.activate(tab, { reason: "click" });
  }

  handleKeydown(event) {
    const tab = this.getEventTab(event);
    const enabled = this.enabledTabs();
    const index = enabled.indexOf(tab);
    if (index === -1) return;

    const vertical = this.nav.getAttribute("aria-orientation") === "vertical";
    const rtl = this.view.getComputedStyle(this.nav).direction === "rtl";
    const nextKey = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
    const previousKey = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";

    let next;
    switch (event.key) {
      case nextKey:
        next = (index + 1) % enabled.length;
        break;
      case previousKey:
        next = (index - 1 + enabled.length) % enabled.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = enabled.length - 1;
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        this.activate(tab, { reason: "keyboard" });
        return;
      default:
        return;
    }

    event.preventDefault();
    const target = enabled[next];

    if (this.root.dataset.tabsActivation === "manual") {
      this.setTabStop(target);
    } else {
      this.activate(target, { reason: "keyboard" });
    }

    target.focus({ preventScroll: true });
    this.revealTab(target);
  }

  revealTab(tab) {
    const tabRect = tab.getBoundingClientRect();
    const navRect = this.nav.getBoundingClientRect();
    const left = navRect.left + this.nav.clientLeft;
    const right = left + this.nav.clientWidth;
    const delta =
      tabRect.left < left
        ? tabRect.left - left
        : Math.max(0, tabRect.right - right);

    if (delta) this.nav.scrollBy({ left: delta, behavior: "instant" });
  }

  destroy() {
    this.events.abort();
    instances.delete(this.root);
  }
}
