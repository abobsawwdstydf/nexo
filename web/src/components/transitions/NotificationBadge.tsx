import { useState } from "react";

const __TRANSITION_STYLES = `
:root {
  --badge-slide-dur: 260ms;
  --badge-pop-dur: 500ms;
  --badge-pop-close-dur: 180ms;
  --badge-fade-dur: 400ms;
  --badge-fade-close-dur: 180ms;
  --badge-blur: 2px;
  --badge-offset-x: -8.2px;
  --badge-offset-y: 12.4px;
  --badge-slide-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --badge-pop-ease: cubic-bezier(0.34, 1.36, 0.64, 1);
  --badge-close-ease: cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes t-badge-slide-in {
  from { transform: translate(var(--badge-offset-x), var(--badge-offset-y)); }
  to   { transform: translate(0, 0); }
}

.t-badge {
  position: absolute;
  pointer-events: none;
  will-change: transform;
}
.t-badge[data-open="true"] {
  animation: t-badge-slide-in var(--badge-slide-dur) var(--badge-slide-ease);
}

.t-badge-dot {
  display: block;
  transform-origin: center;
  transform: scale(1);
  opacity: 1;
  filter: blur(0);
  transition:
    transform var(--badge-pop-dur)  var(--badge-pop-ease),
    opacity   var(--badge-fade-dur) var(--badge-pop-ease),
    filter    var(--badge-pop-dur)  var(--badge-pop-ease);
  will-change: transform, opacity, filter;
}
.t-badge[data-open="false"] .t-badge-dot {
  transform: scale(0);
  opacity: 0;
  filter: blur(var(--badge-blur));
  transition:
    transform var(--badge-pop-close-dur)  var(--badge-close-ease),
    opacity   var(--badge-fade-close-dur) var(--badge-close-ease),
    filter    var(--badge-pop-close-dur)  var(--badge-close-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-badge, .t-badge-dot { animation: none !important; transition: none !important; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("transitions-p1")) {
  const __style = document.createElement("style");
  __style.id = "transitions-p1";
  __style.textContent = __TRANSITION_STYLES;
  document.head.appendChild(__style);
}

interface NotificationBadgeProps {
  count: number;
  className?: string;
  style?: React.CSSProperties;
}

export function NotificationBadge({ count, className = '', style }: NotificationBadgeProps) {
  const [open, setOpen] = useState(true);
  const isOpen = count > 0 && open;

  return (
    <span className={`t-badge ${className}`} data-open={isOpen} style={style}>
      <span className="t-badge-dot">
        {count > 99 ? '99+' : count}
      </span>
    </span>
  );
}
