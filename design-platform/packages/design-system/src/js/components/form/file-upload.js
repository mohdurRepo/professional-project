const INPUT_SELECTOR = '.form-file-input[type="file"]';
const REMOVE_SELECTOR = "button[data-file-remove]";
const mountedInputs = new WeakSet();
const mountedRemoveActions = new WeakSet();

const messages = {
  en: {
    empty: "No file selected",
    selected: (count) => `${count} files selected`,
    remove: (name) => `Remove ${name}`,
  },
  ar: {
    empty: "لم يتم اختيار ملف",
    selected: (count) => `تم اختيار ${count} ملفات`,
    remove: (name) => `إزالة ${name}`,
  },
};

function selectElements(root, selector) {
  const elements = [...root.querySelectorAll(selector)];

  if (root.matches?.(selector)) {
    elements.unshift(root);
  }

  return elements;
}

function getFileList(input) {
  const id = input.dataset.fileList?.trim();
  const list = id
    ? input.getRootNode().getElementById?.(id)
    : input
        .closest(".form-group")
        ?.querySelector("[data-file-list]:not(input)");

  return list?.matches("[data-file-list]:not(input)") ? list : null;
}

function formatSize(bytes, locale) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }

  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: unit > 0 && size < 10 ? 1 : 0,
  }).format(size);

  return `${number} ${units[unit]}`;
}

function createFileItem(input, file, index, labels, locale) {
  const doc = input.ownerDocument;
  const item = doc.createElement("li");
  const icon = doc.createElement("span");
  const name = doc.createElement("bdi");
  const size = doc.createElement("span");
  const remove = doc.createElement("button");

  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  item.className = "form-file-item";

  icon.className = `has-icon ${isPdf ? "icon-pdf-file" : "icon-file-download"}`;
  icon.setAttribute("aria-hidden", "true");

  name.className = "form-file-name";
  name.textContent = file.name;

  size.className = "form-file-size";
  size.textContent = formatSize(file.size, locale);

  remove.className = "form-file-remove has-icon icon-close-x";
  remove.type = "button";
  remove.disabled = input.matches(":disabled");
  remove.dataset.fileRemove = "";
  remove.dataset.fileIndex = String(index);
  remove.setAttribute("aria-label", labels.remove(file.name));

  item.append(icon, name, size, remove);
  return item;
}

function replaceFiles(input, files) {
  const view = input.ownerDocument.defaultView;

  try {
    if (files.length === 0) {
      input.value = "";
    } else {
      const transfer = new view.DataTransfer();
      const selection = input.multiple ? files : files.slice(0, 1);

      for (const file of selection) {
        transfer.items.add(file);
      }

      input.files = transfer.files;
    }
  } catch {
    return false;
  }

  input.dispatchEvent(new view.Event("change", { bubbles: true }));
  return true;
}

function mountFileInput(input, wrapper, signal) {
  const name = wrapper.querySelector("[data-file-name]");
  const dropzone = wrapper.querySelector(".form-dropzone");
  const list = getFileList(input);

  const language =
    input.closest("[lang]")?.getAttribute("lang") ||
    input.ownerDocument.documentElement.lang;
  const isArabic = /^ar(?:-|$)/i.test(language);
  const labels = isArabic ? messages.ar : messages.en;
  const locale = isArabic ? "ar-SA-u-nu-latn" : "en-GB";

  let dragDepth = 0;

  function render() {
    const files = Array.from(input.files);

    if (name) {
      if (files.length === 0) {
        name.textContent = input.dataset.fileEmptyLabel || labels.empty;
      } else if (files.length === 1) {
        name.textContent = files[0].name;
      } else {
        name.textContent =
          input.dataset.fileSelectedLabel || labels.selected(files.length);
      }
    }

    if (list) {
      list.replaceChildren(
        ...files.map((file, index) =>
          createFileItem(input, file, index, labels, locale),
        ),
      );

      if (list.hasAttribute("data-file-list-hide-empty")) {
        list.hidden = files.length === 0;
      }
    }
  }

  function setDragState(active) {
    wrapper.classList.toggle("is-dragover", active);

    if (dropzone) {
      dropzone.classList.toggle("is-dragover", active);
      dropzone.dataset.dragActive = String(active);
    }
  }

  function clearDragState() {
    dragDepth = 0;
    setDragState(false);
  }

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  input.addEventListener("change", render, { signal });

  input.form?.addEventListener(
    "reset",
    (event) => {
      queueMicrotask(() => {
        if (!signal.aborted && !event.defaultPrevented) {
          clearDragState();
          render();
        }
      });
    },
    { signal },
  );

  list?.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.(REMOVE_SELECTOR);

      if (!button || !list.contains(button) || input.matches(":disabled")) {
        return;
      }

      const files = Array.from(input.files);
      const index = Number(button.dataset.fileIndex);

      if (!Number.isInteger(index) || index < 0 || index >= files.length) {
        return;
      }

      const wasFocused = button.getRootNode().activeElement === button;
      files.splice(index, 1);

      if (replaceFiles(input, files) && wasFocused) {
        const remaining = list.querySelectorAll(REMOVE_SELECTOR);
        const next = remaining[Math.min(index, remaining.length - 1)] || input;

        next.focus();
      }
    },
    { signal },
  );

  dropzone?.addEventListener(
    "dragenter",
    (event) => {
      if (!isFileDrag(event) || input.matches(":disabled")) return;

      event.preventDefault();
      dragDepth += 1;
      setDragState(true);
    },
    { signal },
  );

  dropzone?.addEventListener(
    "dragover",
    (event) => {
      if (!isFileDrag(event)) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = input.matches(":disabled")
        ? "none"
        : "copy";
    },
    { signal },
  );

  dropzone?.addEventListener(
    "dragleave",
    () => {
      dragDepth = Math.max(0, dragDepth - 1);

      if (dragDepth === 0) setDragState(false);
    },
    { signal },
  );

  dropzone?.addEventListener(
    "drop",
    (event) => {
      if (!isFileDrag(event)) return;

      event.preventDefault();
      clearDragState();

      if (input.matches(":disabled")) return;

      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) replaceFiles(input, files);
    },
    { signal },
  );

  dropzone?.addEventListener("dragend", clearDragState, { signal });
  signal.addEventListener("abort", clearDragState, { once: true });

  render();
}

export function initFileUploads(root = document) {
  const controller = new AbortController();
  const { signal } = controller;
  const inputs = [];
  const removeActions = [];

  for (const input of selectElements(root, INPUT_SELECTOR)) {
    const wrapper = input.closest(".form-file");

    if (!wrapper || mountedInputs.has(input)) continue;

    mountFileInput(input, wrapper, signal);
    mountedInputs.add(input);
    inputs.push(input);
  }

  for (const button of selectElements(root, REMOVE_SELECTOR)) {
    const item = button.closest(".form-file-item");

    if (
      !item ||
      button.closest("[data-file-list]") ||
      mountedRemoveActions.has(button)
    ) {
      continue;
    }

    // Preserve the existing behavior for standalone rows.
    button.addEventListener("click", () => item.remove(), { signal });
    mountedRemoveActions.add(button);
    removeActions.push(button);
  }

  return () => {
    if (signal.aborted) return;

    controller.abort();

    for (const input of inputs) mountedInputs.delete(input);
    for (const button of removeActions) mountedRemoveActions.delete(button);
  };
}
