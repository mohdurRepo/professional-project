import "./scss/main.scss";
import { initAlerts } from "./js/components/alert/index.js";
import { initForms } from "./js/components/form/index.js";
import {
  destroyCustomSelects,
  initCustomSelects,
  stopObservingCustomSelects,
} from "./js/components/custom-select/index.js";

const disposeAlerts = initAlerts(document);
const disposeForms = initForms(document);

initCustomSelects(document);

function disposeCustomSelects() {
  stopObservingCustomSelects(document);
  destroyCustomSelects(document);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeCustomSelects();
    disposeForms();
    disposeAlerts();
  });
}
