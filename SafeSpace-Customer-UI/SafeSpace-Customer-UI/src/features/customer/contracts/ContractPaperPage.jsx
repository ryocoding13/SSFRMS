/**
 * HỢP ĐỒNG GIẤY (Figma C07g · 13/11, D58)
 *
 * Bản in của hợp đồng điện tử, lấy từ máy chủ (GET /api/contracts/{id}/document?inline=true).
 * Máy chủ dựng một mẫu duy nhất cho cả màn này và tệp đính kèm email sau thanh toán,
 * nên khách thấy đúng bản đã được gửi qua email. "Tải PDF" tạo và tải tệp PDF khổ A4 ngay
 * trên trình duyệt (contractPdf.js).
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { api } from "../../../shared/api/customerApi.js";
import { contractOf, facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { downloadContractPdf, printContract } from "./contractPdf.js";

import "../../../shared/styles/customer-detail.css";
import "./contract-paper.css";

export function ContractPaperPage({ id }) {
  const { data, mode } = useApp();
  const c = contractOf(data, id);
  const frame = useRef(null);
  const [state, setState] = useState({ html: "", error: "", loading: true });
  const [pdf, setPdf] = useState({ busy: false, error: "" });
  const apiId = c?.api_id;
  const issued = c && c.status !== "DRAFT" && c.api_status !== "DRAFT";

  useEffect(() => {
    if (mode !== "api" || !apiId || !issued) return undefined;
    let alive = true;
    setState({ html: "", error: "", loading: true });
    api.contractPaper(apiId)
      .then((html) => alive && setState({ html, error: "", loading: false }))
      .catch((error) => alive && setState({ html: "", error: error.message || "Không tải được hợp đồng. Vui lòng thử lại.", loading: false }));
    return () => { alive = false; };
  }, [apiId, issued, mode]);

  if (!c) return <NotFound />;
  const f = facilityOf(data, c.facility_id, c.facility_name);
  const offline = mode !== "api" || !apiId;

  // Khung hiển thị cao theo nội dung để trang cuộn một lần, không có thanh cuộn lồng nhau.
  function fit() {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) frame.current.style.height = `${doc.documentElement.scrollHeight}px`;
  }

  async function downloadPdf() {
    if (pdf.busy || !frame.current) return;
    setPdf({ busy: true, error: "" });
    try {
      const fileCode = String(c.contract_id).replace(/Đ/g, "D").replace(/[^\w-]+/g, "-");
      await downloadContractPdf(frame.current, { code: c.contract_id, fileName: `SafeSpace-${fileCode}.pdf` });
      setPdf({ busy: false, error: "" });
    } catch (error) {
      // Ghi lỗi gốc để biết nguyên nhân (mục 61), rồi mở hộp thoại In để khách vẫn lưu được PDF.
      console.error("[Hợp đồng giấy] Tạo PDF thất bại:", error);
      const printed = printContract(frame.current);
      setPdf({ busy: false, error: printed
        ? "Trình duyệt chưa tạo được tệp PDF trực tiếp nên đã mở hộp thoại In. Chọn \"Lưu dưới dạng PDF\" để tải hợp đồng."
        : `Chưa tạo được tệp PDF (${error?.message || "lỗi không rõ"}). Vui lòng thử lại.` });
    } finally {
      fit();
    }
  }

  return (
    <main className="container page customer-records customer-detail contract-paper">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {c.contract_id} / Hợp đồng giấy</p>
      <PageHeader title={`Hợp đồng giấy · ${c.contract_id}`} description={`Bản in của hợp đồng điện tử · Kho ${c.unit_number} · ${f.name}`}>
        <div className="contract-paper__actions">
          <LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Quay lại hợp đồng</LinkButton>
          <Button disabled={!state.html || pdf.busy} onClick={downloadPdf}>{pdf.busy ? "Đang tạo PDF…" : "Tải PDF"}</Button>
        </div>
      </PageHeader>
      {pdf.error && <Notice tone="error">{pdf.error}</Notice>}
      <section className="contract-paper__area" aria-busy={!offline && state.loading}>
        {!issued ? (
          <Notice>Hợp đồng chưa được phát hành. Hợp đồng giấy có sau khi thanh toán xong và hệ thống cấp ô kho.</Notice>
        ) : offline ? (
          <Notice>Hợp đồng giấy được tạo từ máy chủ SafeSpace. Bản xem này chưa kết nối máy chủ nên chưa hiển thị được hợp đồng.</Notice>
        ) : state.error ? (
          <Notice tone="error">{state.error}</Notice>
        ) : state.loading ? (
          <p className="contract-paper__loading">Đang tải hợp đồng…</p>
        ) : (
          <iframe ref={frame} className="contract-paper__frame" title={`Hợp đồng giấy ${c.contract_id}`}
            sandbox="allow-same-origin allow-modals" srcDoc={state.html} onLoad={fit} />
        )}
      </section>
      {issued && !offline && <p className="hint contract-paper__hint">Bấm "Tải PDF" để lưu hợp đồng về máy.</p>}
    </main>
  );
}
