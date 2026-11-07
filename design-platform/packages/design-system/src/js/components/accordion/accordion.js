export const ACCORDION_SELECTOR = ".accordion";

const instances = new WeakMap();

function isDisabled(trigger) {
  return trigger.matches(':disabled, .is-disabled, [aria-disabled="true"]');
}

function ensureId(element, prefix) {
  if (element.id) return element.id;

  const scope = element.getRootNode();
  let number = 1;
  let id = prefix;

  while (scope.getElementById?.(id)) id = `${prefix}-${number++}`;
  element.id = id;
  return id;
}

export class Accordion {
  static getInstance(root) {
    return instances.get(root);
  }

  static getOrCreateInstance(root) {
    return this.getInstance(root) ?? new this(root);
  }

  constructor(root) {
    this.root = root;
    this.view = root.ownerDocument.defaultView;
    this.entries = [];
    this.controls = new Map();
    this.events = new this.view.AbortController();

    root.addEventListener("click", (event) => this.handleClick(event), {
      signal: this.events.signal,
    });

    this.refresh();
    instances.set(root, this);
  }

  get multiple() {
    return this.root.hasAttribute("data-accordion-multiple");
  }

  refresh() {
    const items = Array.from(
      this.root.querySelectorAll(":scope > .accordion-item"),
    );
    this.entries = items.flatMap((item) => {
      const trigger = item.querySelector(
        ":scope > .accordion-heading > [data-accordion-trigger], :scope > [data-accordion-trigger]",
      );
      const panel = item.querySelector(":scope > .accordion-panel");

      if (!trigger || trigger.tagName !== "BUTTON" || !panel) return [];

      trigger.type = "button";
      const triggerId = ensureId(trigger, "accordion-trigger");
      trigger.setAttribute("aria-controls", ensureId(panel, "accordion-panel"));
      panel.setAttribute("aria-labelledby", triggerId);

      return [{ item, trigger, panel }];
    });

    let hasExpanded = false;
    for (const entry of this.entries) {
      const expanded = entry.trigger.hasAttribute("aria-expanded")
        ? entry.trigger.getAttribute("aria-expanded") === "true"
        : entry.item.classList.contains("is-open");
      const keepExpanded = expanded && (this.multiple || !hasExpanded);

      this.setExpanded(entry, keepExpanded);
      hasExpanded ||= keepExpanded;
    }

    const controls = Array.from(
      this.root.querySelectorAll("[data-accordion-expand-all]"),
    ).filter((control) => control.closest(ACCORDION_SELECTOR) === this.root);
    for (const control of controls) {
      if (!this.controls.has(control)) {
        this.controls.set(control, {
          hidden: control.hidden,
          disabled: control.disabled,
          ariaDisabled: control.getAttribute("aria-disabled"),
        });
      }
    }

    for (const control of this.controls.keys()) {
      if (!controls.includes(control)) this.controls.delete(control);
    }

    this.syncControls();
  }

  setExpanded({ item, trigger, panel }, expanded) {
    if (!expanded && panel.contains(panel.ownerDocument.activeElement)) {
      trigger.focus({ preventScroll: true });
    }

    trigger.setAttribute("aria-expanded", String(expanded));
    panel.hidden = !expanded;
    item.classList.toggle("is-open", expanded);
  }

  isExpanded(entry) {
    return entry.trigger.getAttribute("aria-expanded") === "true";
  }

  setItemExpanded(item, expanded) {
    const entry = this.entries.find((entry) => entry.item === item);
    if (!entry) return false;

    if (expanded && !this.multiple) {
      for (const other of this.entries) {
        if (other !== entry) this.setExpanded(other, false);
      }
    }

    this.setExpanded(entry, expanded);
    this.syncControls();
    return true;
  }

  collapseAll() {
    for (const entry of this.entries) this.setExpanded(entry, false);
    this.syncControls();
  }

  toggleAll() {
    if (!this.multiple) return;

    const enabled = this.entries.filter(({ trigger }) => !isDisabled(trigger));
    const expanded = !enabled.every((entry) => this.isExpanded(entry));
    for (const entry of enabled) this.setExpanded(entry, expanded);

    this.syncControls();
  }

  syncControls() {
    const enabled = this.entries.filter(({ trigger }) => !isDisabled(trigger));
    const allExpanded =
      enabled.length > 0 && enabled.every((entry) => this.isExpanded(entry));

    for (const [control, original] of this.controls) {
      control.hidden = original.hidden || !this.multiple;

      if ("disabled" in control) {
        control.disabled = original.disabled || enabled.length === 0;
      }

      control.setAttribute(
        "aria-disabled",
        String(
          original.disabled ||
            original.ariaDisabled === "true" ||
            enabled.length === 0,
        ),
      );
      control.setAttribute("aria-expanded", String(allExpanded));
      control.dataset.accordionState = allExpanded ? "expanded" : "collapsed";

      const lang =
        control.closest("[lang]")?.lang ||
        this.root.ownerDocument.documentElement.lang;
      const arabic = /^ar(?:-|$)/i.test(lang);
      const expand =
        control.dataset.accordionExpandLabel ||
        (arabic ? "توسيع الكل" : "Expand all");
      const collapse =
        control.dataset.accordionCollapseLabel ||
        (arabic ? "طي الكل" : "Collapse all");
      const label = control.querySelector("[data-accordion-expand-label]");

      if (label) label.textContent = allExpanded ? collapse : expand;

      const icon = control.querySelector("[data-accordion-expand-icon]");
      if (icon) {
        icon.classList.toggle("icon-add-plus", !allExpanded);
        icon.classList.toggle("icon-minus-line", allExpanded);
      }
    }
  }

  handleClick(event) {
    const control = event.target.closest?.("[data-accordion-expand-all]");
    if (control?.closest(ACCORDION_SELECTOR) === this.root) {
      event.preventDefault();
      if (!isDisabled(control)) this.toggleAll();
      return;
    }

    const trigger = event.target.closest?.("[data-accordion-trigger]");
    const entry = this.entries.find((entry) => entry.trigger === trigger);
    if (!entry) return;

    event.preventDefault();
    if (!isDisabled(trigger))
      this.setItemExpanded(entry.item, !this.isExpanded(entry));
  }

  destroy() {
    this.events.abort();

    for (const [control, original] of this.controls) {
      control.hidden = original.hidden;
      if ("disabled" in control) control.disabled = original.disabled;
      if (original.ariaDisabled === null)
        control.removeAttribute("aria-disabled");
      else control.setAttribute("aria-disabled", original.ariaDisabled);
    }

    this.controls.clear();
    instances.delete(this.root);
  }
}
