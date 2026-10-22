import React, { useEffect, useRef } from "react";

export default function StickyHeader({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const root = document.documentElement;
    const measure = () => root.style.setProperty("--site-header-height", `${element.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--site-header-height");
    };
  }, []);

  return <div className="site-header" ref={ref}>{children}</div>;
}
