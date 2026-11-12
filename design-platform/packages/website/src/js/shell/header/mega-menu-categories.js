const CATEGORY = "[data-mega-tab]";
const HOVER_DELAY = 150;

export function bindMegaMenuCategories(header, signal) {
  const view = header.ownerDocument.defaultView;
  const options = { signal };

  for (const menu of header.querySelectorAll("[data-mega-menu]")) {
    const rail = menu.querySelector("[data-mega-tabs], [role='tablist']");

    if (!rail) continue;

    const panels = new Map(
      Array.from(menu.querySelectorAll("[data-mega-panel][id]"), (panel) => [
        panel.id,
        panel,
      ]),
    );

    const entries = Array.from(rail.querySelectorAll(CATEGORY))
      .map((control) => ({
        control,
        panel: panels.get(control.getAttribute("aria-controls")),
      }))
      .filter(({ panel }) => panel);

    if (!entries.length) continue;

    const isTabList = rail.getAttribute("role") === "tablist";
    let active;
    let hoverTimer;

    function cancelHover() {
      view.clearTimeout(hoverTimer);
    }

    function activate(entry) {
      cancelHover();
      active = entry;

      for (const { control, panel } of entries) {
        const selected = control === entry.control;

        control.classList.toggle("is-active", selected);
        panel.hidden = !selected;

        if (isTabList) {
          control.tabIndex = selected ? 0 : -1;
          control.setAttribute("aria-selected", String(selected));
        }
      }
    }

    const initial = entries.find(({ control }) =>
      control.matches(
        '[aria-selected="true"], [aria-current="page"], .is-active',
      ),
    );

    activate(initial ?? entries[0]);

    for (const entry of entries) {
      const { control } = entry;

      control.addEventListener("focus", () => activate(entry), options);

      control.addEventListener(
        "pointerenter",
        (event) => {
          if (event.pointerType !== "mouse") return;

          const focused = header.ownerDocument.activeElement;
          const focusIsInPanel = active.panel.contains(focused);
          const focusIsOnTab = isTabList && rail.contains(focused);

          if (focusIsInPanel || focusIsOnTab) return;

          cancelHover();
          hoverTimer = view.setTimeout(() => {
            if (!menu.hidden) activate(entry);
          }, HOVER_DELAY);
        },
        options,
      );

      control.addEventListener("pointerleave", cancelHover, options);

      if (control.matches("button")) {
        control.addEventListener("click", () => activate(entry), options);
      }
    }

    rail.addEventListener(
      "keydown",
      (event) => {
        const index = entries.findIndex(
          ({ control }) => control === event.target,
        );

        if (index === -1) return;

        const last = entries.length - 1;
        let next;

        switch (event.key) {
          case "ArrowDown":
            next = index === last ? 0 : index + 1;
            break;
          case "ArrowUp":
            next = index === 0 ? last : index - 1;
            break;
          case "Home":
            next = 0;
            break;
          case "End":
            next = last;
            break;
          default:
            return;
        }

        event.preventDefault();
        entries[next].control.focus({ preventScroll: true });
      },
      options,
    );

    signal.addEventListener("abort", cancelHover, { once: true });
  }
}
