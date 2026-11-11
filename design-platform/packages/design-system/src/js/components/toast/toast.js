const icons = new Map([
  ["primary", "icon-bell"],
  ["success", "icon-check"],
  ["info", "icon-info-warning"],
  ["attention", "icon-alert-bell"],
  ["warning", "icon-info-warning"],
  ["danger", "icon-info-warning"],
]);

const managers = new WeakMap();

export function prepareToasts(doc = globalThis.document) {
  const existing = managers.get(doc);
  if (existing) return existing;

  const container = doc.createElement("div");
  container.className = "toast-container";

  const announcements = doc.createElement("div");
  announcements.className = "visually-hidden";
  const channels = new Map();

  for (const role of ["status", "alert"]) {
    const node = doc.createElement("div");
    node.setAttribute("role", role);
    node.setAttribute("aria-atomic", "true");
    announcements.append(node);
    channels.set(role, { node, messages: [], timer: null });
  }

  doc.body.append(announcements, container);

  const manager = {
    doc,
    view: doc.defaultView,
    container,
    announcements,
    channels,
    records: new Set(),
    events: new doc.defaultView.AbortController(),
  };
  managers.set(doc, manager);

  doc.addEventListener(
    "visibilitychange",
    () => {
      for (const record of manager.records) syncTimer(record);
    },
    { signal: manager.events.signal },
  );

  return manager;
}

function announce(manager, role, message) {
  if (!message) return;

  const channel = manager.channels.get(role);
  channel.messages.push(message);
  if (channel.timer !== null) return;

  channel.node.textContent = "";
  channel.timer = manager.view.setTimeout(() => {
    channel.node.textContent = channel.messages.join(" — ");
    channel.messages.length = 0;
    channel.timer = null;
  }, 60);
}

function removeToast(record, restoreFocus = true) {
  const { manager, toast, opener } = record;
  if (!manager.records.delete(record)) return;

  if (record.timer !== null) manager.view.clearTimeout(record.timer);
  record.events.abort();
  if (
    restoreFocus &&
    toast.contains(manager.doc.activeElement) &&
    opener?.isConnected
  ) {
    opener.focus({ preventScroll: true });
  }
  toast.remove();
}

function syncTimer(record) {
  if (!record.duration) return;

  const { manager, toast } = record;
  const { view, doc } = manager;
  const paused =
    record.hovered || toast.contains(doc.activeElement) || doc.hidden;

  if (paused) {
    if (record.timer !== null) {
      view.clearTimeout(record.timer);
      record.timer = null;
      record.remaining = Math.max(0, record.deadline - view.performance.now());
    }
    return;
  }

  if (record.timer !== null) return;

  record.deadline = view.performance.now() + record.remaining;
  record.timer = view.setTimeout(() => removeToast(record), record.remaining);
}

export function showToast(
  {
    type = "primary",
    title = "Notification",
    message = "",
    duration,
    closeLabel = "Close notification",
  } = {},
  doc = globalThis.document,
) {
  const normalizedType = String(type).trim().toLowerCase();
  const kind = icons.has(normalizedType) ? normalizedType : "primary";
  const defaultDuration = kind === "danger" || kind === "warning" ? 0 : 4000;
  const requestedDuration =
    duration === undefined ? defaultDuration : Number(duration);
  const timeout = Number.isFinite(requestedDuration)
    ? Math.min(2_147_483_647, Math.max(0, requestedDuration))
    : defaultDuration;
  const manager = prepareToasts(doc);
  const { view } = manager;
  const titleText = String(title ?? "").trim();
  const messageText = String(message ?? "").trim();

  const toast = doc.createElement("div");
  toast.className = `toast toast-${kind}`;

  const icon = doc.createElement("span");
  icon.className = `toast-icon has-icon ${icons.get(kind)}`;
  icon.setAttribute("aria-hidden", "true");

  const content = doc.createElement("div");
  content.className = "toast-content";
  for (const [className, text] of [
    ["toast-title", titleText],
    ["toast-message", messageText],
  ]) {
    if (!text) continue;
    const paragraph = doc.createElement("p");
    paragraph.className = className;
    paragraph.textContent = text;
    content.append(paragraph);
  }

  const close = doc.createElement("button");
  close.type = "button";
  close.className = "btn btn-icon btn-ghost toast-close has-icon icon-close-x";
  close.setAttribute("aria-label", String(closeLabel || "Close notification"));
  toast.append(icon, content, close);

  const record = {
    manager,
    toast,
    opener: doc.activeElement,
    duration: timeout,
    remaining: timeout,
    timer: null,
    deadline: 0,
    hovered: false,
    events: new view.AbortController(),
  };

  manager.records.add(record);
  manager.container.append(toast);

  const { signal } = record.events;
  close.addEventListener("click", () => removeToast(record), { signal });
  toast.addEventListener(
    "pointerenter",
    (event) => {
      if (event.pointerType === "touch") return;
      record.hovered = true;
      syncTimer(record);
    },
    { signal },
  );
  toast.addEventListener(
    "pointerleave",
    (event) => {
      if (event.pointerType === "touch") return;
      record.hovered = false;
      syncTimer(record);
    },
    { signal },
  );
  toast.addEventListener("focusin", () => syncTimer(record), { signal });
  toast.addEventListener(
    "focusout",
    () => {
      view.queueMicrotask(() => {
        if (manager.records.has(record)) syncTimer(record);
      });
    },
    { signal },
  );

  announce(
    manager,
    kind === "danger" ? "alert" : "status",
    [titleText, messageText].filter(Boolean).join(". "),
  );
  syncTimer(record);
  return toast;
}

export function disposeToasts(doc = globalThis.document) {
  const manager = managers.get(doc);
  if (!manager) return;

  manager.events.abort();
  for (const record of manager.records) removeToast(record, false);
  for (const channel of manager.channels.values()) {
    if (channel.timer !== null) manager.view.clearTimeout(channel.timer);
  }
  manager.announcements.remove();
  manager.container.remove();
  managers.delete(doc);
}
