import React, { useEffect, useState } from "react";
import { api } from "../api/endpoints";
import PaymentQr from "./PaymentQr";

export default function PayOSEmbeddedModal({
  reservationData,
  onSuccess,
  onClose
}) {
  const [status, setStatus] = useState("Pending");

  useEffect(() => {
    if (status === "Paid" || !reservationData?.reservationId) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.reservationStatus(reservationData.reservationId);
        if (res && (res.isPaid || res.status === "CONFIRMED" || res.status === "PAID")) {
          setStatus("Paid");
          clearInterval(interval);
          setTimeout(() => {
            if (onSuccess) onSuccess();
          }, 2000);
        }
      } catch (err) {
        console.error("Lỗi khi kiểm tra trạng thái thanh toán payOS:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [reservationData?.reservationId, status, onSuccess]);

  if (!reservationData) return null;

  const amountFormatted = (reservationData.amount || 0).toLocaleString("vi-VN");

  return (
    <div className="modal-overlay" style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div className="modal-content panel" style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "32px",
        maxWidth: "460px",
        width: "90%",
        position: "relative",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)",
        textAlign: "center"
      }}>
        {onClose && (
          <button
            className="close-btn"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b"
            }}
          >
            ✕
          </button>
        )}

        {status === "Pending" ? (
          <>
            <h2 style={{ fontSize: "1.35rem", fontWeight: "700", marginBottom: "8px", color: "#0f172a" }}>
              Thanh toán qua VietQR (payOS)
            </h2>

            <p style={{ fontSize: "1rem", margin: "12px 0", color: "#475569" }}>
              Số tiền: <strong style={{ color: "#2563eb", fontSize: "1.2rem" }}>{amountFormatted} VNĐ</strong>
            </p>

            {reservationData.orderCode && (
              <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "-4px", marginBottom: "16px" }}>
                Mã đơn hàng: <code>#{reservationData.orderCode}</code>
              </p>
            )}

            <div style={{ margin: "16px 0", display: "grid", justifyItems: "center" }}>
              <PaymentQr
                amount={reservationData.amount}
                content={reservationData.orderCode ? `#${reservationData.orderCode}` : `#${reservationData.reservationId}`}
                checkoutUrl={reservationData.checkoutUrl}
                payOSQrCode={reservationData.checkoutUrl || reservationData.qrCode}
              />
            </div>

            <div className="payment-note" style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "20px" }}>
              <p style={{ margin: "4px 0", fontWeight: "500" }}>
                ⏳ Đang chờ hệ thống ghi nhận chuyển khoản...
              </p>
              <small style={{ color: "#64748b" }}>
                Mở ứng dụng Ngân hàng/Ví điện tử để quét mã QR trên.
              </small>
            </div>

            {reservationData.checkoutUrl && (
              <a
                href={reservationData.checkoutUrl}
                target="_blank"
                rel="noreferrer"
                className="payos-link-btn"
                style={{
                  display: "inline-block",
                  padding: "10px 18px",
                  background: "#3b82f6",
                  color: "#ffffff",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                  transition: "background 0.2s"
                }}
              >
                Hoặc mở trang thanh toán payOS đầy đủ
              </a>
            )}
          </>
        ) : (
          <div className="success-container" style={{ padding: "20px 0" }}>
            <div
              className="success-icon"
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#22c55e",
                color: "#ffffff",
                fontSize: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto"
              }}
            >
              ✓
            </div>

            <h3 style={{ fontSize: "1.4rem", color: "#15803d", fontWeight: "700", marginBottom: "8px" }}>
              Thanh toán thành công!
            </h3>

            <p style={{ color: "#475569", fontSize: "0.95rem" }}>
              Đơn đặt kho của bạn đã được cập nhật trạng thái <strong>ĐÃ XÁC NHẬN</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
