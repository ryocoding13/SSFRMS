import React, { useEffect, useRef } from "react";
import { statuses } from "../domain";
const paths = {
  box: "M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2",
  card: "M3 5h18v14H3zM3 10h18M6 15h4",
  file: "M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6",
  help: "M21 11a9 9 0 0 1-9 9H4l-3 2 2-7a9 9 0 1 1 18-4ZM8 9h8M8 13h5",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 9 3 3 5-5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  alert: "m12 3 10 18H2L12 3ZM12 9v5M12 17v1",
  logout: "M9 3H3v18h6M9 12h12m-5-5 5 5-5 5",
  menu: "M3 6h18M3 12h18M3 18h18",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  snow: "M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3",
  key: "M14 7a5 5 0 1 1-5-5 5 5 0 0 1 5 5Zm-2 4 10 10m-3-3 2-2m-5-1 2-2",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4",
  mail: "M3 5h18v14H3zM3 5l9 8 9-8",
  phone: "M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 5-22-8-16-16",
  back: "M19 12H5m5-5-5 5 5 5",
  home: "m2 11 10-9 10 9M5 9v13h14V9M9 22v-9h6v9",
};
export function Icon({ name = "box", size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
export function Badge({ status, children, tone }) {
  const s = statuses[status] || [status, "gray"];
  return (
    <span className={`ss-badge ${tone || s[1]}`}>
      <span />
      {children || s[0]}
    </span>
  );
}
export function Button({ children, variant = "", icon, ...props }) {
  return (
    <button className={`ss-btn ${variant}`} {...props}>
      {icon && <Icon name={icon} size={17} />} {children}
    </button>
  );
}
export function LinkButton({ children, to, variant = "", icon, ...props }) {
  return (
    <a className={`ss-btn ${variant}`} href={`#/customer/${to}`} {...props}>
      {icon && <Icon name={icon} size={17} />} {children}
    </a>
  );
}
export function Field({ label, error, children, hint }) {
  const id = React.useId();
  return (
    <div className={`ss-field ${error ? "invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        ["input", "select", "textarea"].includes(child.type)
          ? React.cloneElement(child, {
              id,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": error || hint ? `${id}-hint` : undefined,
            })
          : child,
      )}
      {error ? (
        <small id={`${id}-hint`} role="alert">
          {error}
        </small>
      ) : (
        hint && (
          <small id={`${id}-hint`} className="muted">
            {hint}
          </small>
        )
      )}
    </div>
  );
}

export function Empty({
  title = "Chưa có dữ liệu",
  text = "Thông tin mới sẽ xuất hiện tại đây.",
  children,
}) {
  return (
    <div className="ss-empty">
      <span className="ss-empty-icon">
        <Icon name="box" size={34} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function PageTitle({
  eyebrow = "KHÔNG GIAN CỦA BẠN",
  title,
  description,
  children,
}) {
  return (
    <div className="ss-page-title">
      <div>
        <div className="ss-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="ss-actions">{children}</div>
    </div>
  );
}
export function Notice({ children, tone = "" }) {
  return (
    <div className={`ss-notice ${tone}`}>
      <Icon name={tone === "success" ? "check" : "alert"} size={19} />
      <div>{children}</div>
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const old = document.activeElement;
    const el = ref.current;
    el?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const f = [
          ...el.querySelectorAll(
            'button:not(:disabled),a,input,select,textarea,[tabindex="0"]',
          ),
        ];
        const first = f[0],
          last = f.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === el)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="ss-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ss-dialog-title"
        className={`ss-modal ${wide ? "wide" : ""}`}
      >
        <header>
          <h2 id="ss-dialog-title">{title}</h2>
          <button className="ss-icon-btn" onClick={onClose} aria-label="Đóng">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function StorageArt({ variant = "blue", large = false }) {
  return (
    <div
      className={`ss-storage-art ${variant} ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 500 240" fill="none">
        <path d="M0 205 500 150v90H0z" fill="currentColor" opacity=".05" />
        <path
          d="m80 61 130-28 186 47v118l-132 26-184-48V61Z"
          fill="#fff"
          opacity=".8"
        />
        <path
          d="m80 61 184 47v116L80 176V61Z"
          fill="currentColor"
          opacity=".2"
        />
        <path
          d="m264 108 132-28v118l-132 26V108Z"
          fill="currentColor"
          opacity=".12"
        />
        <path
          d="m104 80 135 35v96l-135-35V80Z"
          fill="currentColor"
          opacity=".65"
        />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path
            key={i}
            d={`m108 ${91 + i * 12} 127 33`}
            stroke="white"
            strokeOpacity=".55"
            strokeWidth="2"
          />
        ))}
        <path
          d="m295 118 73-15v77l-73 15v-77Z"
          fill="currentColor"
          opacity=".55"
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`m299 ${129 + i * 12} 64-13`}
            stroke="white"
            strokeOpacity=".4"
            strokeWidth="2"
          />
        ))}
        <path d="m53 164 40-10 46 14-40 11-46-15Z" fill="#ddb980" />
        <path d="m53 164 46 15v40l-46-17v-38Z" fill="#c89d66" />
        <path d="m99 179 40-11v37l-40 14v-40Z" fill="#e9cda0" />
        <path d="m72 159 45 14v13l-10 3v-13l-44-15 9-2Z" fill="#f1ddbb" />
        <circle cx="415" cy="58" r="23" fill="white" />
        <path
          d="m405 58 7 7 12-14"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
export function Details({ items }) {
  return (
    <dl className="ss-details">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
