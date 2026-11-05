const SELECTOR = "select.form-phone__select";
const mountedSelects = new WeakSet();

function mountPhoneCountry(select, signal) {
  const field = select.closest(".form-phone");
  const flag = field?.querySelector("[data-phone-flag]");
  const code = field?.querySelector("[data-phone-code]");
  const image = field?.querySelector("img[data-phone-flag-image]");

  if (!flag || !code) return false;

  function showTextFlag() {
    if (image) image.hidden = true;
    flag.hidden = !flag.textContent;
  }

  function syncPreview() {
    const option = select.selectedOptions[0];
    const imageSrc = option?.dataset.flagSrc;

    code.textContent = option?.dataset.callingCode || "";
    flag.textContent = option?.dataset.flag || option?.value || "";

    showTextFlag();

    if (image && imageSrc) {
      image.setAttribute("src", imageSrc);
      image.hidden = false;
      flag.hidden = true;
    } else {
      image?.removeAttribute("src");
    }
  }

  image?.addEventListener("error", showTextFlag, { signal });
  select.addEventListener("change", syncPreview, { signal });

  select.form?.addEventListener(
    "reset",
    (event) => {
      queueMicrotask(() => {
        if (!signal.aborted && !event.defaultPrevented) {
          syncPreview();
        }
      });
    },
    { signal },
  );

  syncPreview();
  return true;
}

export function initPhoneCountries(root = document) {
  const selects = [...root.querySelectorAll(SELECTOR)];

  if (root.matches?.(SELECTOR)) {
    selects.unshift(root);
  }

  const controller = new AbortController();
  const mounted = [];

  for (const select of selects) {
    if (mountedSelects.has(select)) continue;

    if (mountPhoneCountry(select, controller.signal)) {
      mountedSelects.add(select);
      mounted.push(select);
    }
  }

  return () => {
    if (controller.signal.aborted) return;

    controller.abort();

    for (const select of mounted) {
      mountedSelects.delete(select);
    }
  };
}
