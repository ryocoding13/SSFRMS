import React from "react";
import { LinkButton, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InquiryThread } from "../../facility-operations/workflows/InquiryThread.jsx";
import { WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function InquiryDetailPage({ id }) {
  const { user } = useApp(), load = useWorkflowData("inquiries"), ticket = load.data?.find(t => t.id === id && String(t.ownerId) === String(user?.user_id));
  return <main className="container page workflow-page"><PageHeader title="Theo dõi yêu cầu tư vấn" /><WorkflowState load={load}>{ticket ? <InquiryThread key={ticket.id} ticket={ticket} load={load} customer /> : !load.error && <WorkflowEmpty text="Không tìm thấy yêu cầu thuộc tài khoản của bạn." />}</WorkflowState><LinkButton to="inquiries" variant="outline">Về danh sách yêu cầu</LinkButton></main>;
}
