import "./scss/main.scss";
import { initAlerts } from "./js/components/alert/index.js";
import { initForms } from "./js/components/form/index.js";
import {
  destroyCustomSelects,
  initCustomSelects,
  stopObservingCustomSelects,
} from "./js/components/custom-select/index.js";

import {
  destroyCustomDates,
  initCustomDates,
  stopObservingCustomDates,
} from "./js/components/custom-date/index.js";

import { destroyTables, initTables } from "./js/components/table/index.js";

import { initTabs } from "./js/components/tabs/index.js";

import { initAccordions } from "./js/components/accordion/index.js";

import { initDropdowns } from "./js/components/dropdown/index.js";

const disposeAlerts = initAlerts(document);
const disposeForms = initForms(document);

initCustomSelects(document);
initCustomDates(document);
initTables(document);
const disposeTabs = initTabs(document);
const disposeAccordions = initAccordions(document);
const disposeDropdowns = initDropdowns(document);

function disposeCustomSelects() {
  stopObservingCustomSelects(document);
  destroyCustomSelects(document);
}

function disposeCustomDates() {
  stopObservingCustomDates(document);
  destroyCustomDates(document);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeDropdowns();
    disposeAccordions();
    disposeTabs();
    destroyTables(document);
    disposeCustomDates();
    disposeCustomSelects();
    disposeForms();
    disposeAlerts();
  });
}
