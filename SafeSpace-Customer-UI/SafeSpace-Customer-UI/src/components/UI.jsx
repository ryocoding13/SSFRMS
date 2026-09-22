import React, { useEffect, useId, useRef } from "react";
import { href } from "../lib/router";

const paths = {
  box: "M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5",
  bell: "M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  chevron: "m9 5 7 7-7 7",
  back: "M19 12H5m5-5-5 5 5 5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Zm-4 9 3 3 5-5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2",
  image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0",
  paperclip: "m21 11-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  auto: "M4 12a8 8 0 0 1 14-5l2-2v6h-6l2.5-2.5A5 5 0 1 0 17 12M20 12a8 8 0 0 1-14 5l-2 2v-6h6l-2.5 2.5",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4M14 18h2v2h-2z",
  info: "M12 8h.01M11 12h1v5h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
};

export function Icon({ name = "box", size = 20, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name] || paths.box} />
    </svg>
  );
}

export function Tag({ tone = "green", square = false, children, ...rest }) {
  return (
    <span className={`tag tag--${tone}${square ? " tag--square" : ""}`} {...rest}>
      {children}
    </span>
  );
}

export function StatusTag({ map, status, square, children }) {
  const [label, tone] = map[status] || [status, "gray"];
  return (
    <Tag tone={tone} square={square}>
      {children || label}
    </Tag>
  );
}

export function Button({ variant = "primary", block = false, icon, className = "", children, ...props }) {
  return (
    <button type="button" className={`btn btn--${variant}${block ? " btn--block" : ""} ${className}`} {...props}>
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = "primary", block = false, className = "", children, ...props }) {
  return (
    <a className={`btn btn--${variant}${block ? " btn--block" : ""} ${className}`} href={href(to)} {...props}>
      {children}
    </a>
  );
}

export function Field({ label, error, hint, children, className = "" }) {
  const id = useId();
  const described = error || hint ? `${id}-msg` : undefined;
  return (
    <div className={`field${error ? " field--invalid" : ""} ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {React.Children.map(children, (child) =>
        React.isValidElement(child) && (["input", "select", "textarea"].includes(child.type) || child.type?.fieldControl)
          ? React.cloneElement(child, { id, "aria-invalid": error ? true : undefined, "aria-describedby": described })
          : child,
      )}
      {error ? (
        <p className="field__error" id={`${id}-msg`} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-msg`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header__actions">{children}</div>}
    </header>
  );
}

export function Panel({ children, className = "", as: As = "section", ...props }) {
  return (
    <As className={`panel ${className}`} {...props}>
      {children}
    </As>
  );
}

export function Notice({ tone = "info", children }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "success" ? "check" : "info"} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ title, text, children }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name="box" size={30} />
      </span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {children && <div className="empty__actions">{children}</div>}
    </div>
  );
}

// Bảng chi tiết dạng "nhãn — giá trị" (C05, C04b)
export function DetailList({ items }) {
  return (
    <dl className="detail-list">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Hộp thoại: dùng cho thông báo kết quả (C13 "Đã lưu tên", "Đổi mật khẩu thành công") và xác nhận
export function Modal({ title, children, onClose, size = "sm", label }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const el = ref.current;
    el?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key !== "Tab" || !el) return;
      const focusables = [...el.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-label={label} className={`modal modal--${size}`}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </section>
    </div>
  );
}

export function Dialog({ title, message, actionLabel = "Đã hiểu", onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal__text">{message}</p>
      <Button onClick={onClose}>{actionLabel}</Button>
    </Modal>
  );
}
