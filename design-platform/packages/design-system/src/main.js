import "./scss/main.scss";
import { initAlerts } from "./js/components/alert/index.js";
import { initForms } from "./js/components/form/index.js";

const disposeAlerts = initAlerts(document);
const disposeForms = initForms(document);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeForms();
    disposeAlerts();
  });
}
