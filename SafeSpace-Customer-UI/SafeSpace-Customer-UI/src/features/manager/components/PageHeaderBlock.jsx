import React from "react";

export function PageHeaderBlock({ title, text }) {
  return (
    <header className="page-header page-header--tight">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
    </header>
  );
}
