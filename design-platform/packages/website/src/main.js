import "./scss/main.scss";
import { initAccordions } from "../../design-system/src/js/components/accordion/index.js";
import { initDrawers } from "../../design-system/src/js/components/drawer/index.js";
import { initHeader } from "./js/shell/header/index.js";

import { initPreferences } from "./js/features/preferences/preferences.js";

const disposePreferences = initPreferences();
const disposeAccordions = initAccordions(document);
const disposeDrawers = initDrawers(document);
const disposeHeader = initHeader(document);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposePreferences();
    disposeHeader?.();
    disposeDrawers();
    disposeAccordions();
  });
}
