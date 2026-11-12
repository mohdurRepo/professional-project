import { bindDesktopNavigation } from "./desktop-navigation.js";
import { bindMegaMenuCategories } from "./mega-menu-categories.js";
import { bindMobileNavigation } from "./mobile-navigation.js";

// Matches the design system's lg breakpoint used by header/_config.scss.
const DESKTOP_QUERY = "(min-width: 992px)";
const instances = new WeakMap();

export function initHeader(doc = document) {
  const header = doc.querySelector("[data-site-header]");

  if (!header) return;

  const existing = instances.get(header);
  if (existing) return existing;

  const controller = new AbortController();
  const { signal } = controller;
  const desktopQuery = doc.defaultView.matchMedia(DESKTOP_QUERY);

  bindMegaMenuCategories(header, signal);
  bindDesktopNavigation(header, desktopQuery, signal);
  bindMobileNavigation(doc, desktopQuery, signal);

  function disposeHeader() {
    if (signal.aborted) return;

    controller.abort();
    instances.delete(header);
  }

  instances.set(header, disposeHeader);
  return disposeHeader;
}
