const GROUP_SELECTOR = "[data-otp]";
const INPUT_SELECTOR = "input[data-otp-input]";
const mountedGroups = new WeakSet();

function normalizeDigits(value) {
  return value
    .replace(/[\u0660-\u0669\u06f0-\u06f9\uff10-\uff19]/g, (digit) => {
      const code = digit.charCodeAt(0);

      if (code >= 0xff10) return String(code - 0xff10);
      if (code >= 0x06f0) return String(code - 0x06f0);

      return String(code - 0x0660);
    })
    .replace(/[^0-9]/g, "");
}

function isEditable(input) {
  return !input.matches(":disabled") && !input.readOnly;
}

function focusCell(input) {
  if (!input || !isEditable(input)) return;

  input.focus();
  input.select();
}

function mountGroup(group, inputs, signal) {
  const view = group.ownerDocument.defaultView;
  const writing = new WeakSet();
  let completedValue = null;

  function syncCompletion(announce = true) {
    const value = inputs.map((input) => normalizeDigits(input.value));
    const complete = value.every((digit) => digit.length === 1);
    const code = complete ? value.join("") : null;
    const changed = code !== completedValue;

    group.classList.toggle("is-complete", complete);
    group.dataset.otpComplete = String(complete);
    completedValue = code;

    if (announce && complete && changed) {
      group.dispatchEvent(
        new view.CustomEvent("form:otp-complete", {
          bubbles: true,
          detail: { value: code },
        }),
      );
    }
  }

  function writeCell(input, value) {
    if (input.value === value) return;

    writing.add(input);

    try {
      input.value = value;
      input.dispatchEvent(
        new view.InputEvent("input", {
          bubbles: true,
          data: value || null,
          inputType: value ? "insertText" : "deleteContentBackward",
        }),
      );
    } finally {
      writing.delete(input);
    }
  }

  function nextCell(index) {
    return inputs.slice(index + 1).find(isEditable);
  }

  function previousCell(index) {
    return inputs.slice(0, index).reverse().find(isEditable);
  }

  function fillCells(start, digits) {
    let lastIndex = -1;

    for (
      let index = start, digitIndex = 0;
      index < inputs.length && digitIndex < digits.length;
      index += 1
    ) {
      if (!isEditable(inputs[index])) continue;

      writeCell(inputs[index], digits[digitIndex]);
      digitIndex += 1;
      lastIndex = index;
    }

    if (lastIndex !== -1) {
      const next = nextCell(lastIndex);

      if (next) {
        focusCell(next);
      } else if (lastIndex !== start) {
        focusCell(inputs[lastIndex]);
      }
    }

    syncCompletion();
  }

  function resetState() {
    for (const input of inputs) {
      input.value = normalizeDigits(input.value).slice(0, 1);
    }

    syncCompletion(false);
  }

  inputs.forEach((input, index) => {
    input.addEventListener(
      "beforeinput",
      (event) => {
        if (
          event.defaultPrevented ||
          !event.cancelable ||
          event.isComposing ||
          !isEditable(input) ||
          !event.inputType?.startsWith("insert") ||
          typeof event.data !== "string"
        ) {
          return;
        }

        event.preventDefault();

        const digits = normalizeDigits(event.data);
        if (digits) fillCells(index, digits);
      },
      { signal },
    );

    input.addEventListener(
      "input",
      (event) => {
        if (event.isComposing || writing.has(input) || !isEditable(input)) {
          return;
        }

        const digits = normalizeDigits(input.value);

        if (digits.length > 1) {
          fillCells(index, digits);
          return;
        }

        input.value = digits;

        if (digits) focusCell(nextCell(index));

        syncCompletion();
      },
      { signal },
    );

    input.addEventListener(
      "paste",
      (event) => {
        if (event.defaultPrevented || !isEditable(input)) return;

        const text = event.clipboardData?.getData("text/plain");
        if (text === undefined) return;

        event.preventDefault();

        const digits = normalizeDigits(text);
        if (digits) fillCells(index, digits);
      },
      { signal },
    );

    input.addEventListener(
      "keydown",
      (event) => {
        if (
          event.defaultPrevented ||
          event.isComposing ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          !isEditable(input)
        ) {
          return;
        }

        switch (event.key) {
          case "Backspace": {
            event.preventDefault();
            const target = input.value ? input : previousCell(index);

            if (target) {
              writeCell(target, "");
              if (target !== input) focusCell(target);
              syncCompletion();
            }

            break;
          }

          case "Delete":
            event.preventDefault();
            writeCell(input, "");
            syncCompletion();
            break;

          case "ArrowLeft":
            event.preventDefault();
            focusCell(previousCell(index));
            break;

          case "ArrowRight":
            event.preventDefault();
            focusCell(nextCell(index));
            break;

          case "Home":
            event.preventDefault();
            focusCell(inputs.find(isEditable));
            break;

          case "End":
            event.preventDefault();
            focusCell(inputs.slice().reverse().find(isEditable));
            break;
        }
      },
      { signal },
    );

    input.addEventListener(
      "focus",
      () => {
        if (isEditable(input)) input.select();
      },
      { signal },
    );
  });

  inputs[0].form?.addEventListener(
    "reset",
    (event) => {
      queueMicrotask(() => {
        if (!signal.aborted && !event.defaultPrevented) resetState();
      });
    },
    { signal },
  );

  resetState();
}

export function initOtpInputs(root = document) {
  const groups = [...root.querySelectorAll(GROUP_SELECTOR)];

  if (root.matches?.(GROUP_SELECTOR)) {
    groups.unshift(root);
  }

  const controller = new AbortController();
  const mounted = [];

  for (const group of groups) {
    if (mountedGroups.has(group)) continue;

    const inputs = [...group.querySelectorAll(INPUT_SELECTOR)].filter(
      (input) => input.closest(GROUP_SELECTOR) === group,
    );

    if (inputs.length === 0) continue;

    mountGroup(group, inputs, controller.signal);
    mountedGroups.add(group);
    mounted.push(group);
  }

  return () => {
    if (controller.signal.aborted) return;

    controller.abort();

    for (const group of mounted) {
      mountedGroups.delete(group);
    }
  };
}
