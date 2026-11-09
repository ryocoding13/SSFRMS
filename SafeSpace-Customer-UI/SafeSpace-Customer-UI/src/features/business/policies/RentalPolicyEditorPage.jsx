import React, { useState, useEffect } from "react";
import { Button, DetailList, Field, LinkButton, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { POLICY_SECTIONS } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { useWorkflowChange, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { policyVersionLabel } from "../../../shared/utils/rentalPolicy.js";
import { requirePublication } from "./policyPublication.js";
import { businessApi } from "../api/businessApi.js";
import "../../../shared/styles/customer-detail.css";

export function RentalPolicyEditorPage() {
  const load = useWorkflowData("policy");
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [ack, setAck] = useState(false);
  const [dialog, ask] = useWorkflowChange(load);

  // Lịch sử phiên bản công bố (P3)
  const [versions, setVersions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);

  const fetchVersions = async () => {
    try {
      setHistoryLoading(true);
      const list = await businessApi.rentalPolicyVersions();
      setVersions(Array.isArray(list) ? list : []);
    } catch {
      // Bỏ qua lỗi mạng nền, không chặn giao diện chính
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [load.data?.version]);

  const viewOldVersion = async (vNumber) => {
    try {
      setViewingLoading(true);
      const detail = await businessApi.rentalPolicyVersion(vNumber);
      setViewingVersion(detail);
    } catch (err) {
      setError(`Không tải được bản ghi phiên bản ${vNumber}: ${err.message}`);
    } finally {
      setViewingLoading(false);
    }
  };

  const policy = draft || load.data;
  let valid = false;
  try {
    requirePublication(policy);
    valid = true;
  } catch {}

  const disabled = load.busy || load.needsRefresh;

  return (
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Vận hành kinh doanh / Chính sách</p>
      <PageHeader
        title="Phiên bản chính sách thuê kho"
        description="Tạo phiên bản mới và xem trước nội dung khách đọc. Giữ bằng chứng phiên bản đã đồng ý."
      />

      <WorkflowState load={load}>
        {!valid && !draft ? (
          <Notice tone="error">
            Máy chủ chưa cung cấp đầy đủ nội dung/phiên bản chính sách. Không dùng bản mặc định để công bố.
            <Button onClick={load.reload}>Tải lại</Button>
          </Notice>
        ) : (
          policy && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  if (disabled) return;
                  if (!ack) throw new Error("Xác nhận đã kiểm tra đủ nội dung trước khi công bố.");
                  const payload = requirePublication(policy);
                  setError("");
                  ask(
                    "SAVE_RENTAL_POLICY",
                    payload,
                    "Kiểm tra & công bố phiên bản mới?",
                    "Lưu tạo phiên bản mới có hiệu lực ngay sau khi xác nhận. Bằng chứng phiên bản cũ được giữ; phạm vi quy định hiện hành vẫn áp dụng cho mọi hợp đồng."
                  );
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              <div className="customer-detail__grid">
                <div className="customer-detail__column">
                  <section className="panel customer-detail__card">
                    <h2>Thông tin phiên bản</h2>
                    <DetailList
                      items={[
                        ["Phiên bản đang đọc", policyVersionLabel(policy)],
                        ["Nội dung", draft ? "Đang chỉnh sửa · Chưa công bố" : "Bản máy chủ đã lưu"],
                      ]}
                    />
                    <p className="hint">
                      Máy chủ cấp số phiên bản và thời điểm khi lưu. Công bố tạo phiên bản mới có hiệu lực ngay.
                    </p>
                    {draft && load.data?.version > draft.version && (
                      <Notice tone="warn">
                        Bản máy chủ đã thay đổi (người khác vừa công bố phiên bản mới). Nội dung bạn đang soạn vẫn được bảo lưu an toàn.
                        <Button
                          onClick={() => {
                            setDraft(null);
                            setAck(false);
                          }}
                        >
                          Dùng bản máy chủ vừa tải
                        </Button>
                      </Notice>
                    )}
                  </section>

                  <section className="panel customer-detail__card">
                    <h2>Thông số áp dụng</h2>
                    <Field label="Quá hạn · % cọc ban đầu / ngày lịch (Hiển thị văn bản cho khách)">
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        disabled={disabled}
                        value={policy.rate}
                        onChange={(e) => {
                          setDraft({ ...policy, rate: e.target.value });
                          setAck(false);
                        }}
                      />
                    </Field>
                    <DetailList
                      items={[
                        ["Tổng khấu trừ", "Tối đa 100% cọc · không nợ vượt cọc"],
                        ["Kho chưa đạt tiêu chuẩn vệ sinh", "10% cọc cố định"],
                        ["Nhắc / xử lý đồ", "Ngày 10–14 · ngày 20 theo chính sách"],
                        ["Gia hạn", "Trước hết hạn · thanh toán trong 24 giờ"],
                        ["Sự cố cơ sở", "100% cọc + tháng đang thuê + tháng chưa dùng"],
                      ]}
                    />
                    <div className="customer-detail__actions">
                      <Button variant="outline" onClick={() => setEditing(!editing)}>
                        {editing ? "Thu gọn nội dung" : "Sửa nội dung 7 nhóm chính sách"}
                      </Button>
                      <Button variant="outline" onClick={() => setPreview(true)}>
                        Xem trước bản khách đọc
                      </Button>
                    </div>
                  </section>

                  {editing &&
                    POLICY_SECTIONS.map(([id, title]) => (
                      <section className="panel customer-detail__card" key={id}>
                        <h2>{title}</h2>
                        <Field label="Nội dung hiển thị cho khách">
                          <textarea
                            rows={4}
                            maxLength={3000}
                            disabled={disabled}
                            value={policy.sections?.[id] || ""}
                            onChange={(e) => {
                              setDraft({
                                ...policy,
                                sections: { ...policy.sections, [id]: e.target.value },
                              });
                              setAck(false);
                            }}
                          />
                        </Field>
                      </section>
                    ))}

                  {error && <Notice tone="error">{error}</Notice>}

                  <div className="customer-detail__actions">
                    <Button type="submit" disabled={disabled || !valid || !ack}>
                      Kiểm tra &amp; công bố
                    </Button>
                  </div>
                </div>

                <aside className="panel customer-detail__card customer-detail__sidebar">
                  <h2>Phạm vi áp dụng</h2>
                  <p>Khách tự đồng ý phiên bản hiện hành khi thanh toán đặt chỗ và khi gửi gia hạn mới.</p>
                  <Notice>
                    Lưu đúng phiên bản khách đã đồng ý làm bằng chứng. Quy định hiện hành áp dụng cho mọi hợp đồng;
                    không tự thay đổi phạm vi chỉ vì cách ghi trên thiết kế cũ.
                  </Notice>
                  <label className="customer-detail__choice">
                    <input
                      type="checkbox"
                      checked={ack}
                      disabled={disabled}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    <span>Đã kiểm tra đủ bảy nhóm nội dung và phạm vi công bố</span>
                  </label>

                  {/* Lịch sử phiên bản công bố (P3) */}
                  <div style={{ marginTop: "24px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>
                      Lịch sử phiên bản công bố
                    </h3>
                    {historyLoading ? (
                      <p style={{ fontSize: "13px", color: "#64748b" }}>Đang tải lịch sử...</p>
                    ) : versions.length === 0 ? (
                      <p style={{ fontSize: "13px", color: "#64748b" }}>Chưa có bản ghi lịch sử.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                        {versions.map((v) => (
                          <div
                            key={v.version}
                            style={{
                              padding: "8px 10px",
                              borderRadius: "6px",
                              backgroundColor: v.isCurrent ? "#f0fdf4" : "#f8fafc",
                              border: `1px solid ${v.isCurrent ? "#bbf7d0" : "#e2e8f0"}`,
                              fontSize: "13px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <strong>
                                v{v.version} ({v.displayVersion})
                              </strong>
                              {v.isCurrent && (
                                <span style={{ color: "#166534", fontWeight: 600, fontSize: "11px" }}>
                                  ● Hiện hành
                                </span>
                              )}
                            </div>
                            <div style={{ color: "#64748b", marginTop: "2px" }}>
                              Rate: {v.rate}%/ngày · {new Date(v.publishedAt).toLocaleDateString("vi-VN")}
                            </div>
                            <div style={{ marginTop: "6px" }}>
                              <Button
                                size="small"
                                variant="outline"
                                disabled={viewingLoading}
                                onClick={() => viewOldVersion(v.version)}
                              >
                                Xem bản này
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </form>
          )
        )}
      </WorkflowState>

      <div className="workflow-links">
        <LinkButton to="business/policies" variant="outline">
          Về cấu hình chính sách
        </LinkButton>
      </div>

      {preview && policy && (
        <Modal title="Xem trước bản khách đọc" size="confirm" tone="info" onClose={() => setPreview(false)}>
          {POLICY_SECTIONS.map(([id, title]) => (
            <section key={id} style={{ marginBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600 }}>{title}</h3>
              <p style={{ fontSize: "13px", color: "#334155" }}>{policy.sections?.[id]}</p>
            </section>
          ))}
          <Button onClick={() => setPreview(false)}>Quay lại chỉnh sửa</Button>
        </Modal>
      )}

      {/* Modal xem bản công bố trong lịch sử */}
      {viewingVersion && (
        <Modal
          title={`Xem bản công bố v${viewingVersion.version} (${viewingVersion.displayVersion})`}
          size="confirm"
          tone="info"
          onClose={() => setViewingVersion(null)}
        >
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
            Tỷ lệ quá hạn ghi nhận: <strong>{viewingVersion.rate}%/ngày</strong> · Ngày công bố:{" "}
            {new Date(viewingVersion.updatedAt).toLocaleString("vi-VN")}
          </p>
          {POLICY_SECTIONS.map(([id, title]) => (
            <section key={id} style={{ marginBottom: "12px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600 }}>{title}</h3>
              <p style={{ fontSize: "13px", color: "#334155" }}>
                {viewingVersion.sections?.[id] || "(Chưa có nội dung)"}
              </p>
            </section>
          ))}
          <Button onClick={() => setViewingVersion(null)}>Đóng</Button>
        </Modal>
      )}

      {dialog}
    </main>
  );
}
