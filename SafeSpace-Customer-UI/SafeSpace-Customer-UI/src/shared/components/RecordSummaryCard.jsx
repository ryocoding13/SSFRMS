import React from "react";
import { Panel } from "./UI.jsx";
import "../styles/customer-records.css";

export default function RecordSummaryCard({ title, children, status, actions }) {
  return <Panel as="article" className="record-summary">
    <div className="record-summary__body"><h2>{title}</h2>{children}</div>
    {status}
    <div className="record-summary__actions" role="group" aria-label={`Thao tác ${title}`}>{actions}</div>
  </Panel>;
}
