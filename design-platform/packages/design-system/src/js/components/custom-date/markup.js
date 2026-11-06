import {
  ARIA,
  CLASS_NAMES,
  DATA_ATTRIBUTES,
  DEFAULTS,
  MODES,
  ROLES,
} from "./constants.js";

import { createElement, ensureElementId, getAssociatedLabel } from "./utils.js";

/* ==========================================================================
   Label Resolution
   ========================================================================== */

/**
 * Returns the direct legend associated with the range component's fieldset.
 *
 * Using a direct child prevents a nested fieldset legend from accidentally
 * becoming the accessible label for this date range.
 */
function getRangeLegend(component) {
  const fieldset = component.closest("fieldset");

  if (!fieldset) {
    return null;
  }

  return (
    Array.from(fieldset.children).find((child) => child.tagName === "LEGEND") ||
    null
  );
}

/**
 * Resolves the primary accessible label for the custom-date control.
 *
 * Single dates use the label associated with the native input.
 * Date ranges use the enclosing fieldset legend.
 */
function getComponentLabel(component, mode, startInput) {
  if (mode === MODES.range) {
    return getRangeLegend(component);
  }

  return getAssociatedLabel(startInput);
}

/* ==========================================================================
   Descriptions
   ========================================================================== */

/**
 * Collects all aria-describedby references from the native inputs.
 *
 * Duplicate IDs are removed while preserving their original order.
 */
function getDescriptionIds(...inputs) {
  const ids = inputs.filter(Boolean).flatMap((input) =>
    String(input.getAttribute(ARIA.describedBy) || "")
      .split(/\s+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );

  return [...new Set(ids)].join(" ");
}

/* ==========================================================================
   Single Value
   ========================================================================== */

function createSingleValue(documentReference, valueId) {
  return createElement(
    "span",
    {
      className: CLASS_NAMES.value,

      attributes: {
        id: valueId,
      },
    },
    documentReference,
  );
}

function createIndicator(documentReference) {
  return createElement(
    "span",
    {
      className:
        `${CLASS_NAMES.indicator} ` + "has-icon icon-calendar-scheduler",

      attributes: {
        [ARIA.hidden]: "true",
      },
    },
    documentReference,
  );
}

function createClearAction({ mode, messages, documentReference }) {
  return createElement(
    "button",
    {
      className:
        `${CLASS_NAMES.clear} ` +
        "btn btn-icon btn-ghost has-icon icon-close-x",

      attributes: {
        type: "button",

        [ARIA.label]:
          mode === MODES.range ? messages.clearRange : messages.clearDate,

        hidden: true,
      },
    },
    documentReference,
  );
}

function createTrigger({
  documentReference,
  triggerId,
  popoverId,
  className = CLASS_NAMES.trigger,
  labelledBy,
  fallbackLabel,
  input,
}) {
  return createElement(
    "button",
    {
      className,
      attributes: {
        id: triggerId,
        type: "button",
        [ARIA.controls]: popoverId,
        [ARIA.expanded]: "false",
        [ARIA.hasPopup]: "dialog",
        [ARIA.labelledBy]: labelledBy || null,
        [ARIA.label]: labelledBy ? null : fallbackLabel,
        [ARIA.describedBy]: getDescriptionIds(input) || null,
      },
    },
    documentReference,
  );
}

function createBoundary({
  boundary,
  labelsAbove,
  input,
  label,
  groupLabelId,
  documentReference,
  triggerId,
  valueId,
  popoverId,
}) {
  const labelId = `${triggerId}-label`;
  const labelElement = createElement(
    labelsAbove ? "label" : "span",
    {
      className: "custom-date__boundary-label",
      attributes: { id: labelId, for: labelsAbove ? triggerId : null },
      text: label,
    },
    documentReference,
  );
  const valueElement = createElement(
    "span",
    {
      className:
        boundary === "start" ? CLASS_NAMES.rangeStart : CLASS_NAMES.rangeEnd,
      attributes: { id: valueId },
    },
    documentReference,
  );
  const triggerElement = createTrigger({
    documentReference,
    triggerId,
    popoverId,
    className: `${CLASS_NAMES.trigger} ${CLASS_NAMES.trigger}--${boundary}`,
    labelledBy: [groupLabelId, labelId, valueId].filter(Boolean).join(" "),
    input,
  });

  if (!labelsAbove) {
    triggerElement.append(labelElement);
  }
  triggerElement.append(valueElement);

  return { triggerElement, valueElement, labelElement };
}

function createControl({
  component,
  mode,
  startInput,
  endInput,
  messages,
  documentReference,
  triggerId,
  valueId,
  popoverId,
}) {
  const isRange = mode === MODES.range;
  const labelsAbove = isRange && component.dataset.dateLabels === "above";
  const labelElement = getComponentLabel(component, mode, startInput);
  const labelId = labelElement
    ? ensureElementId(labelElement, "custom-date-label")
    : "";
  const controlElement = createElement(
    "div",
    {
      className: isRange
        ? `${CLASS_NAMES.control} ${CLASS_NAMES.control}--range`
        : CLASS_NAMES.control,
    },
    documentReference,
  );

  let triggerElement;
  let valueElement = null;
  let startValueElement = null;
  let endValueElement = null;
  let endTriggerElement = null;
  let boundaryLabelsElement = null;
  let startBoundaryLabelElement = null;
  let endBoundaryLabelElement = null;

  if (isRange) {
    const boundaryOptions = {
      labelsAbove,
      groupLabelId: labelId,
      documentReference,
      popoverId,
    };
    const start = createBoundary({
      ...boundaryOptions,
      boundary: "start",
      input: startInput,
      label: messages.startDate,
      triggerId,
      valueId: `${valueId}-start`,
    });
    const end = createBoundary({
      ...boundaryOptions,
      boundary: "end",
      input: endInput,
      label: messages.endDate,
      triggerId: `${triggerId}-end`,
      valueId: `${valueId}-end`,
    });

    triggerElement = start.triggerElement;
    endTriggerElement = end.triggerElement;
    startValueElement = start.valueElement;
    endValueElement = end.valueElement;
    startBoundaryLabelElement = start.labelElement;
    endBoundaryLabelElement = end.labelElement;

    if (labelsAbove) {
      controlElement.classList.add("custom-date__control--labels-above");
      boundaryLabelsElement = createElement(
        "div",
        { className: "custom-date__boundary-labels" },
        documentReference,
      );
      boundaryLabelsElement.append(
        startBoundaryLabelElement,
        endBoundaryLabelElement,
      );
    }

    controlElement.append(triggerElement, endTriggerElement);
  } else {
    valueElement = createSingleValue(documentReference, valueId);
    triggerElement = createTrigger({
      documentReference,
      triggerId,
      popoverId,
      labelledBy: labelId ? `${labelId} ${valueId}` : "",
      fallbackLabel: messages.calendarDialog,
      input: startInput,
    });
    triggerElement.append(valueElement);
    controlElement.append(triggerElement);
  }

  const indicatorElement = createIndicator(documentReference);
  controlElement.append(indicatorElement);

  const clearElement = component.hasAttribute(DATA_ATTRIBUTES.clearable)
    ? createClearAction({ mode, messages, documentReference })
    : null;
  if (clearElement) {
    controlElement.append(clearElement);
  }

  return {
    controlElement,
    triggerElement,
    endTriggerElement,
    boundaryLabelsElement,
    startBoundaryLabelElement,
    endBoundaryLabelElement,
    valueElement,
    startValueElement,
    endValueElement,
    indicatorElement,
    clearElement,
    labelElement,
    labelId,
  };
}
function createCalendarRegion(documentReference) {
  return createElement(
    "div",
    {
      className: CLASS_NAMES.calendars,
    },
    documentReference,
  );
}

/* ==========================================================================
   Selection Summary
   ========================================================================== */

/**
 * The summary remains available to assistive technology.
 *
 * `_popover.scss` visually hides this element, so it does not appear in the
 * footer while still providing selection context to screen-reader users.
 */
function createSelectionSummary({ messages, documentReference }) {
  const summaryElement = createElement(
    "div",
    {
      className: CLASS_NAMES.selectionSummary,
    },
    documentReference,
  );

  const labelElement = createElement(
    "span",
    {
      className: CLASS_NAMES.selectionSummaryLabel,

      text: messages.selectedRange,
    },
    documentReference,
  );

  const valueElement = createElement(
    "span",
    {
      className:
        `${CLASS_NAMES.selectionSummaryValue} ` + CLASS_NAMES.placeholder,

      text: messages.noRangeSelected,
    },
    documentReference,
  );

  summaryElement.append(labelElement, valueElement);

  return {
    summaryElement,

    summaryLabelElement: labelElement,

    summaryValueElement: valueElement,
  };
}

/* ==========================================================================
   Presets Region
   ========================================================================== */

function createPresetsRegion({ mode, messages, documentReference }) {
  if (mode !== MODES.range) {
    return {
      presetsElement: null,
      presetsLabelElement: null,
    };
  }

  /*
   * Presets start hidden. presets.js owns whether there are usable presets and
   * reveals the region when appropriate.
   */
  const presetsElement = createElement(
    "div",
    {
      className: CLASS_NAMES.presets,

      attributes: {
        hidden: true,
      },
    },
    documentReference,
  );

  const presetsLabelElement = createElement(
    "span",
    {
      className: CLASS_NAMES.presetsLabel,

      text: messages.presetsLabel,
    },
    documentReference,
  );

  presetsElement.append(presetsLabelElement);

  return {
    presetsElement,
    presetsLabelElement,
  };
}

/* ==========================================================================
   Footer Action
   ========================================================================== */

function createFooterAction({ className, label, documentReference }) {
  return createElement(
    "button",
    {
      className: `${CLASS_NAMES.action} ${className}`,

      attributes: {
        type: "button",
      },

      text: label,
    },
    documentReference,
  );
}

/* ==========================================================================
   Footer Actions
   ========================================================================== */

function createFooterActions({ mode, messages, documentReference }) {
  const actionsElement = createElement(
    "div",
    {
      className: CLASS_NAMES.actions,
    },
    documentReference,
  );

  const todayElement = createFooterAction({
    className: CLASS_NAMES.actionToday,

    label: messages.today,

    documentReference,
  });

  const clearElement = createFooterAction({
    className: CLASS_NAMES.actionClear,

    label: messages.clear,

    documentReference,
  });

  const cancelElement = createFooterAction({
    className: CLASS_NAMES.actionCancel,

    label: messages.cancel,

    documentReference,
  });

  const applyElement =
    mode === MODES.range
      ? createFooterAction({
          className: CLASS_NAMES.actionApply,

          label: messages.apply,

          documentReference,
        })
      : null;

  actionsElement.append(todayElement, clearElement, cancelElement);

  if (applyElement) {
    actionsElement.append(applyElement);
  }

  return {
    actionsElement,

    todayActionElement: todayElement,

    clearActionElement: clearElement,

    cancelActionElement: cancelElement,

    applyActionElement: applyElement,
  };
}

/* ==========================================================================
   Popover Footer
   ========================================================================== */

function createFooter({ mode, messages, documentReference }) {
  const footerElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverFooter,
    },
    documentReference,
  );

  const summary =
    mode === MODES.range
      ? createSelectionSummary({
          messages,
          documentReference,
        })
      : {
          summaryElement: null,
          summaryLabelElement: null,
          summaryValueElement: null,
        };

  const presets = createPresetsRegion({
    mode,
    messages,
    documentReference,
  });

  const actions = createFooterActions({
    mode,
    messages,
    documentReference,
  });

  if (summary.summaryElement) {
    footerElement.append(summary.summaryElement);
  }

  if (presets.presetsElement) {
    footerElement.append(presets.presetsElement);
  }

  footerElement.append(actions.actionsElement);

  return {
    footerElement,

    ...summary,
    ...presets,
    ...actions,
  };
}

/* ==========================================================================
   Live Status
   ========================================================================== */

/**
 * Announces date-selection changes to assistive technologies.
 *
 * The status element itself remains visually hidden through the component
 * stylesheet.
 *
 * aria-live="polite"
 *   Allows the current announcement to finish before the new message.
 *
 * aria-atomic="true"
 *   Causes the complete status message to be announced whenever it changes.
 */
function createStatus({ documentReference, statusId }) {
  return createElement(
    "div",
    {
      className: CLASS_NAMES.status,

      attributes: {
        id: statusId,

        role: ROLES.status,

        [ARIA.live]: "polite",

        [ARIA.atomic]: "true",
      },
    },
    documentReference,
  );
}

/* ==========================================================================
   Popover
   ========================================================================== */

/**
 * `popover="manual"` keeps lifecycle ownership inside CustomDate.
 *
 * Automatic light-dismiss is intentionally avoided because range selection
 * can require several interactions and should remain open until the component
 * explicitly closes it.
 */
function createPopover({
  mode,
  messages,
  documentReference,
  popoverId,
  statusId,
}) {
  const popoverElement = createElement(
    "div",
    {
      className:
        mode === MODES.range
          ? `${CLASS_NAMES.popover} ${CLASS_NAMES.popover}--range`
          : CLASS_NAMES.popover,

      attributes: {
        id: popoverId,

        popover: "manual",

        role: ROLES.dialog,

        [ARIA.modal]: "false",

        [ARIA.label]:
          mode === MODES.range ? messages.rangeDialog : messages.calendarDialog,

        tabindex: "-1",
      },
    },
    documentReference,
  );

  const shellElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverShell,
    },
    documentReference,
  );

  const mainElement = createElement(
    "div",
    {
      className: CLASS_NAMES.popoverMain,
    },
    documentReference,
  );

  const calendarsElement = createCalendarRegion(documentReference);

  mainElement.append(calendarsElement);

  const footer = createFooter({
    mode,
    messages,
    documentReference,
  });

  const statusElement = createStatus({
    documentReference,
    statusId,
  });

  shellElement.append(mainElement, footer.footerElement, statusElement);

  popoverElement.append(shellElement);

  return {
    popoverElement,
    shellElement,
    mainElement,
    calendarsElement,
    statusElement,

    ...footer,
  };
}

/* ==========================================================================
   Complete Interface
   ========================================================================== */

/**
 * Builds the complete enhanced custom-date interface.
 *
 * This function only creates detached markup. CustomDate owns insertion,
 * event registration, state synchronization, and destruction.
 */
export function createCustomDateMarkup({
  component,
  mode,
  startInput,
  endInput = null,
  messages,
}) {
  const documentReference = component.ownerDocument;

  /*
   * The native start input provides the stable prefix for every generated
   * interface ID.
   */
  const nativeId = ensureElementId(startInput, "custom-date-native");

  if (endInput) {
    ensureElementId(endInput, "custom-date-native-end");
  }

  const idPrefix = `${nativeId}-custom-date`;

  const triggerId = `${idPrefix}-trigger`;

  const valueId = `${idPrefix}-value`;

  const popoverId = `${idPrefix}-popover`;

  const statusId = `${idPrefix}-status`;

  const interfaceElement = createElement(
    "div",
    {
      className: CLASS_NAMES.interface,
    },
    documentReference,
  );

  const control = createControl({
    component,
    mode,
    startInput,
    endInput,
    messages,
    documentReference,
    triggerId,
    valueId,
    popoverId,
  });

  const popover = createPopover({
    mode,
    messages,
    documentReference,
    popoverId,
    statusId,
  });

  if (control.boundaryLabelsElement) {
    interfaceElement.append(control.boundaryLabelsElement);
  }
  interfaceElement.append(control.controlElement, popover.popoverElement);

  return {
    interfaceElement,

    ...control,
    ...popover,

    triggerId,
    valueId,
    popoverId,
    statusId,
  };
}
