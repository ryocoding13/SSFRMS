/**
 * POLICY STATUS PAGE - MÀN HÌNH TRA CỨU TRẠNG THÁI HIỆU LỰC CHÍNH SÁCH THUÊ (B02)
 *
 * Hiển thị phiên bản văn bản chính sách hiện hành, thời điểm bắt đầu hiệu lực
 * và lịch sử các lần ban hành chính sách thuê kho SafeSpace.
 */
import React, { useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { Button, Empty, Field, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { LoadState } from "../components/BusinessComponents.jsx";
import { RecordCard } from "../../facility-operations/workflows/WorkflowComponents.jsx";

/**
 * Component hiển thị trạng thái và phiên bản chính sách thuê hiện tại.
 */
export function PolicyStatusPage() {
  const { onApiError } = useApp();
  const load = useLoad(() => businessApi.policies({}), [], onApiError);
  const [flow, runChange] = useChangeFlow();
  const [blocked, setBlocked] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editForm, setEditForm] = useState({ policyName: "", value: "", ruleDescription: "" });
  const [editError, setEditError] = useState("");

  const change = async (p, actionType) => {
    const isRemove = actionType === "DELETE_DRAFT";
    const isActivate = actionType === "ACTIVATE";
    const isDeactivate = actionType === "DEACTIVATE";

    const title = isRemove
      ? "Xoá chính sách nháp"
      : isActivate
      ? "Kích hoạt chính sách"
      : "Ngừng áp dụng chính sách";

    const content = isRemove
      ? "Chỉ xoá bản DRAFT chưa áp dụng."
      : isActivate
      ? "Kích hoạt chính sách nháp để bắt đầu áp dụng vào hệ thống tính toán tự động."
      : "Giữ lịch sử phiên bản và phạm vi chính sách hiện hành.";

    const out = await runChange({
      action: title,
      scope: p.policyName,
      danger: isRemove || isDeactivate,
      content,
      perform: async () => {
        if (isRemove) {
          if (p.status !== "DRAFT") throw new Error("Chỉ được xoá bản nháp.");
          await businessApi.deletePolicy(p.policyId);
        } else if (isActivate) {
          try {
            await businessApi.activatePolicy(p.policyId, false);
          } catch (err) {
            if (err?.status === 409 || err?.data?.conflictingPolicyIds) {
              const confirmReplace = window.confirm(
                "Đã có chính sách cùng loại và phạm vi đang áp dụng trong thời gian này. Bạn có muốn kết thúc bản cũ và thay thế bằng bản mới này không?"
              );
              if (confirmReplace) {
                await businessApi.activatePolicy(p.policyId, true);
              } else {
                return false;
              }
            } else {
              throw err;
            }
          }
        } else {
          await businessApi.deactivatePolicy(p.policyId);
        }

        const rows = await businessApi.policies({});
        if (
          isRemove
            ? rows.some((r) => r.policyId === p.policyId)
            : isActivate
            ? !rows.some((r) => r.policyId === p.policyId && r.status === "ACTIVE")
            : !rows.some((r) => r.policyId === p.policyId && r.status === "INACTIVE")
        ) {
          throw Object.assign(
            new Error("Chưa xác nhận trạng thái chính sách. Tải lại trước khi gửi tiếp."),
            { uncertain: true }
          );
        }
        return true;
      },
    });

    if (out.error) {
      onApiError(out.error);
      if (out.uncertain) setBlocked(true);
    }
    if (out.ok) load.reload();
  };

  const openEditDraft = (p) => {
    setEditingPolicy(p);
    setEditForm({
      policyName: p.policyName || "",
      value: p.value != null ? String(p.value) : "",
      ruleDescription: p.ruleDescription || "",
    });
    setEditError("");
  };

  const saveDraft = async (e) => {
    e.preventDefault();
    if (!editingPolicy) return;
    try {
      setEditError("");
      const body = {
        policyName: editForm.policyName.trim(),
        policyType: editingPolicy.policyType,
        calculationType: editingPolicy.calculationType,
        value: editForm.value ? Number(editForm.value) : null,
        ruleDescription: editForm.ruleDescription.trim(),
        facilityId: editingPolicy.facilityId,
        unitTypeId: editingPolicy.unitTypeId,
        effectiveFrom: editingPolicy.effectiveFrom,
        effectiveTo: editingPolicy.effectiveTo,
      };
      await businessApi.updatePolicy(editingPolicy.policyId, body);
      setEditingPolicy(null);
      load.reload();
    } catch (err) {
      setEditError(err.message || "Lỗi khi cập nhật bản nháp.");
    }
  };

  return (
    <main className="container page workflow-page">
      <PageHeader
        title="Quản lý trạng thái chính sách"
        description="Giữ lịch sử chính sách đã áp dụng; quản lý, chỉnh sửa và kích hoạt các bản nháp."
      />
      {blocked && (
        <Button onClick={() => window.location.reload()}>Tải lại trước khi thao tác tiếp</Button>
      )}

      {/* Bộ lọc trạng thái & phạm vi */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp (DRAFT)</option>
            <option value="ACTIVE">Đang áp dụng (ACTIVE)</option>
            <option value="INACTIVE">Đã ngừng (INACTIVE)</option>
            <option value="EXPIRED">Đã hết hạn (EXPIRED)</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>Phạm vi:</span>
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            <option value="ALL">Tất cả phạm vi</option>
            <option value="SYSTEM">Toàn hệ thống</option>
            <option value="FACILITY">Theo cơ sở</option>
            <option value="UNIT_TYPE">Theo loại kho</option>
          </select>
        </div>
      </div>

      <LoadState load={load}>
        {(rows) => {
          const filtered = rows.filter((p) => {
            if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
            if (scopeFilter === "SYSTEM" && (p.facilityId != null || p.unitTypeId != null)) return false;
            if (scopeFilter === "FACILITY" && p.facilityId == null) return false;
            if (scopeFilter === "UNIT_TYPE" && p.unitTypeId == null) return false;
            return true;
          });

          if (!filtered.length) {
            return <Empty title="Không có chính sách phù hợp bộ lọc" />;
          }

          return filtered.map((p) => {
            const scopeText = p.facilityId
              ? `Cơ sở #${p.facilityId}${p.unitTypeId ? ` · Loại kho #${p.unitTypeId}` : ""}`
              : p.unitTypeId
              ? `Loại kho #${p.unitTypeId}`
              : "Toàn hệ thống";

            const actions = (
              <div style={{ display: "flex", gap: "8px" }}>
                {p.status === "ACTIVE" && (
                  <Button
                    disabled={blocked || load.loading}
                    variant="outline"
                    onClick={() => change(p, "DEACTIVATE")}
                  >
                    Ngừng áp dụng
                  </Button>
                )}
                {p.status === "DRAFT" && (
                  <>
                    <Button
                      disabled={blocked || load.loading}
                      onClick={() => change(p, "ACTIVATE")}
                    >
                      Kích hoạt
                    </Button>
                    <Button
                      disabled={blocked || load.loading}
                      variant="outline"
                      onClick={() => openEditDraft(p)}
                    >
                      Sửa nháp
                    </Button>
                    <Button
                      disabled={blocked || load.loading}
                      variant="outline"
                      onClick={() => change(p, "DELETE_DRAFT")}
                    >
                      Xoá nháp
                    </Button>
                  </>
                )}
              </div>
            );

            return (
              <RecordCard
                key={p.policyId}
                title={p.policyName}
                subtitle={`${p.policyType} · ${scopeText} · Hiệu lực: ${p.effectiveFrom}${
                  p.effectiveTo ? ` đến ${p.effectiveTo}` : ""
                }`}
                status={
                  p.status === "ACTIVE"
                    ? "Đang áp dụng"
                    : p.status === "DRAFT"
                    ? "Bản nháp"
                    : p.status === "INACTIVE"
                    ? "Đã ngừng"
                    : "Đã hết hạn"
                }
                actions={actions}
              >
                <p>{p.ruleDescription}</p>
                {p.value != null && (
                  <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                    Giá trị: <strong>{p.value}</strong> ({p.calculationType})
                  </p>
                )}
              </RecordCard>
            );
          });
        }}
      </LoadState>

      {/* Modal chỉnh sửa bản nháp */}
      {editingPolicy && (
        <Modal
          title={`Chỉnh sửa chính sách nháp #${editingPolicy.policyId}`}
          onClose={() => setEditingPolicy(null)}
        >
          <form onSubmit={saveDraft}>
            <Field label="Tên chính sách">
              <input
                type="text"
                required
                value={editForm.policyName}
                onChange={(e) => setEditForm({ ...editForm, policyName: e.target.value })}
              />
            </Field>

            {editingPolicy.calculationType !== "RULE" && (
              <Field label={`Giá trị (${editingPolicy.calculationType})`}>
                <input
                  type="number"
                  step="any"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                />
              </Field>
            )}

            <Field label="Mô tả điều kiện / Quy tắc áp dụng">
              <textarea
                rows={3}
                required
                value={editForm.ruleDescription}
                onChange={(e) => setEditForm({ ...editForm, ruleDescription: e.target.value })}
              />
            </Field>

            {editError && <Notice tone="error">{editError}</Notice>}

            <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setEditingPolicy(null)}>
                Hủy
              </Button>
              <Button type="submit">Lưu bản nháp</Button>
            </div>
          </form>
        </Modal>
      )}

      {flow}
    </main>
  );
}
