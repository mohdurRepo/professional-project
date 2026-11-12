import { collapseAccordions } from "../../../../../design-system/src/js/components/accordion/index.js";
import { closeDrawer } from "../../../../../design-system/src/js/components/drawer/index.js";

export function bindMobileNavigation(doc, desktopQuery, signal) {
  const drawer = doc.querySelector('dialog[data-drawer="mobile-nav"]');

  if (!drawer) return;

  function closeMobileNavigation() {
    closeDrawer(drawer, { restoreFocus: false });
  }

  desktopQuery.addEventListener(
    "change",
    (event) => {
      if (event.matches) closeMobileNavigation();
    },
    { signal },
  );

  doc.addEventListener(
    "drawer:closed",
    (event) => {
      if (event.detail?.drawer === drawer) {
        collapseAccordions(drawer);
      }
    },
    { signal },
  );

  drawer.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.("a[href]");

      if (
        !link ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      closeMobileNavigation();
    },
    { signal },
  );
}
