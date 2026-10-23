import React, { useCallback, useRef, useState } from "react";
import { Button, Modal } from "./UI.jsx";

// Chuỗi hộp thoại thay đổi dữ liệu theo Figma 885:* (Admin, Vận hành KD, Quản lý cơ sở):
//   Xác nhận "<Thao tác>?" → Thành công "Đã <thao tác>" → hoặc Thất bại "Không <thao tác> được".
// Dùng: const [flowEl, runChange] = useChangeFlow();
//       const out = await runChange({ action: "Gán vai trò", scope: "Tài khoản Phạm Thu Hà", content: "Quản lý cơ sở", perform: () => api.assign(...) });
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);
export const GENERIC_FAILURE = "Chưa ghi nhận thay đổi. Giữ nội dung đã nhập để kiểm tra và thử lại.";

export function changeFlowTexts({ action, scope, successTitle, successText, failureTitle, failureText }) {
  return {
    confirmTitle: `${action}?`,
    successTitle: successTitle || `Đã ${lowerFirst(action)}`,
    successText: successText || `Thay đổi đã được ghi nhận. ${scope}.`,
    failureTitle: failureTitle || `Không ${lowerFirst(action)} được`,
    failureText: failureText || GENERIC_FAILURE,
  };
}

export function useChangeFlow() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const step = (next) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(next);
  });
  const answer = useCallback((value) => {
    const resolve = resolver.current;
    resolver.current = null;
    setState(null);
    resolve?.(value);
  }, []);

  const runChange = useCallback(async ({ action, scope, content, perform, confirm = true, showSuccess = true, successAction = "Về màn hình trước", ...texts }) => {
    const t = changeFlowTexts({ action, scope, ...texts });
    if (confirm && !(await step({ kind: "confirm", title: t.confirmTitle, rows: [["Thao tác", action], ["Phạm vi", scope], ["Nội dung", content]] }))) return { ok: false, cancelled: true };
    try {
      const result = await perform();
      if (result === false) return { ok: false, cancelled: true };
      if (showSuccess) await step({ kind: "success", title: t.successTitle, text: t.successText, action: successAction });
      return { ok: true, result };
    } catch (error) {
      await step({ kind: "failure", title: t.failureTitle, text: t.failureText, detail: error?.message && error.message !== t.failureText ? error.message : "" });
      return { ok: false, error };
    }
  }, []);

  const element = state && (
    <Modal title={state.title} size="confirm" onClose={() => answer(false)}>
      {state.kind === "confirm" ? (
        <>
          <p className="modal__text">Kiểm tra thông tin trước khi xác nhận. Chọn Quay lại để giữ nguyên dữ liệu.</p>
          <dl className="confirm-summary">
            {state.rows.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || "—"}</dd></div>)}
          </dl>
          <p className="hint">Chỉ lưu thay đổi sau khi bạn bấm Xác nhận.</p>
          <div className="modal__actions">
            <Button variant="outline" onClick={() => answer(false)}>Quay lại</Button>
            <Button onClick={() => answer(true)}>Xác nhận</Button>
          </div>
        </>
      ) : (
        <>
          <span className={`modal__state modal__state--${state.kind}`} aria-hidden="true" />
          <p className="modal__text">{state.text}</p>
          {state.detail && <p className="hint">{state.detail}</p>}
          <Button variant={state.kind === "success" ? "primary" : "outline"} block onClick={() => answer(true)}>
            {state.kind === "success" ? state.action : "Quay lại kiểm tra"}
          </Button>
        </>
      )}
    </Modal>
  );
  return [element, runChange];
}

export default useChangeFlow;
