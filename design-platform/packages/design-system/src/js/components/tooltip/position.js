const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" };
const sides = Object.keys(opposite);

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(value, maximum));
}

function readGap(root, view) {
  const style = view.getComputedStyle(root);
  const value = (
    style.getPropertyValue("--tooltip-offset") ||
    style.getPropertyValue("--tooltip-gap")
  ).trim();
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 8;

  if (value.endsWith("rem")) {
    const rootSize = Number.parseFloat(
      view.getComputedStyle(root.ownerDocument.documentElement).fontSize,
    );
    return Math.max(0, number * rootSize);
  }

  return Math.max(0, number);
}

export function positionTooltip(root, trigger, content) {
  const doc = trigger.ownerDocument;
  const view = doc.defaultView;
  const viewport = view.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportRight =
    viewportLeft + (viewport?.width ?? doc.documentElement.clientWidth);
  const viewportBottom =
    viewportTop + (viewport?.height ?? doc.documentElement.clientHeight);
  const anchor = trigger.getBoundingClientRect();

  if (
    !anchor.width ||
    !anchor.height ||
    anchor.right <= viewportLeft ||
    anchor.left >= viewportRight ||
    anchor.bottom <= viewportTop ||
    anchor.top >= viewportBottom
  )
    return false;

  const gutter = 12;
  const gap = readGap(root, view);
  const leftEdge = viewportLeft + gutter;
  const rightEdge = viewportRight - gutter;
  const topEdge = viewportTop + gutter;
  const bottomEdge = viewportBottom - gutter;
  content.style.setProperty(
    "--tooltip-available-width",
    Math.max(0, rightEdge - leftEdge) + "px",
  );
  const { width, height } = content.getBoundingClientRect();
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;
  const rtl = view.getComputedStyle(trigger).direction === "rtl";
  const requested = root.dataset.tooltipPreferred?.trim().toLowerCase();
  let preferred = "top";

  if (requested === "start") preferred = rtl ? "right" : "left";
  else if (requested === "end") preferred = rtl ? "left" : "right";
  else if (sides.includes(requested)) preferred = requested;

  const room = {
    top: anchor.top - gap - topEdge,
    bottom: bottomEdge - anchor.bottom - gap,
    left: anchor.left - gap - leftEdge,
    right: rightEdge - anchor.right - gap,
  };

  const needed = { top: height, bottom: height, left: width, right: width };
  const order = [
    preferred,
    opposite[preferred],
    ...sides.filter(
      (side) => side !== preferred && side !== opposite[preferred],
    ),
  ];
  const side =
    order.find((side) => room[side] >= needed[side]) ??
    order.reduce((best, side) =>
      room[side] - needed[side] > room[best] - needed[best] ? side : best,
    );

  const coordinates = {
    top: [centerX - width / 2, anchor.top - gap - height],
    bottom: [centerX - width / 2, anchor.bottom + gap],
    left: [anchor.left - gap - width, centerY - height / 2],
    right: [anchor.right + gap, centerY - height / 2],
  };
  const [rawX, rawY] = coordinates[side];
  const x = clamp(rawX, leftEdge, rightEdge - width);
  const y = clamp(rawY, topEdge, bottomEdge - height);

  const arrowInset = 12;
  const arrowX = Math.min(arrowInset, content.clientWidth / 2);
  const arrowY = Math.min(arrowInset, content.clientHeight / 2);

  content.dataset.tooltipSide = side;
  content.style.setProperty("--tooltip-x", `${x}px`);
  content.style.setProperty("--tooltip-y", `${y}px`);
  content.style.setProperty(
    "--tooltip-arrow-x",
    `${clamp(centerX - x - content.clientLeft, arrowX, content.clientWidth - arrowX)}px`,
  );
  content.style.setProperty(
    "--tooltip-arrow-y",
    `${clamp(centerY - y - content.clientTop, arrowY, content.clientHeight - arrowY)}px`,
  );
  return true;
}
