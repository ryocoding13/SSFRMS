import React, { useState } from "react";
import { useCustomer } from "../context";
import { Modal, Field, Button, Notice, Details, Icon } from "./UI";
import {
  today,
  addMonths,
  dateLabel,
  money,
  validateBooking,
  uid,
} from "../domain";
export default function ActionModal({ modal, onClose }) {
  const { data, command, notify, navigate } = useCustomer();
  const { type, payload: p } = modal;
  const [form, setForm] = useState({
    facility_id: p.facility_id || data.facilities[0].facility_id,
    unit_type_id: p.unit_type_id || 1,
    start_date: p.start_date || today(),
    rental_period_months: p.rental_period_months || "1",
    months: "1",
    date: today(),
    reason: "",
    notes: "",
    method: "BANK_TRANSFER",
    agree: false,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[k];
      return next;
    });
  };
  const finish = async (type, payload, msg, to) => {
    setSubmitting(true);
    try {
      const result = await command(type, payload);
      if (result) {
        onClose();
        notify(msg);
        if (to) {
          const targetTo =
            typeof result === "object" && result?.reservation_id
              ? `reservations/${result.reservation_id}`
              : to;
          navigate(targetTo);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };
  const titles = {
    book: "Đặt không gian của bạn",
    renew: "Yêu cầu gia hạn",
    return: "Yêu cầu trả kho",
    pay: "Thanh toán khoản phí",
    cancel: "Hủy đơn đặt kho",
    handover: "Xác nhận nhận kho",
  };
  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (type === "book") {
      Object.assign(err, validateBooking(form));
      if (!form.agree)
        err.agree = "Vui lòng xác nhận thông tin và điều kiện đặt kho.";
      setErrors(err);
      if (Object.keys(err).length) return;
      const id = uid("DC");
      finish(
        "BOOK",
        {
          reservation_id: id,
          facility_id: Number(form.facility_id),
          unit_type_id: Number(form.unit_type_id),
          start_date: form.start_date,
          rental_period_months: Number(form.rental_period_months),
        },
        "Đã gửi yêu cầu đặt kho.",
        `reservations/${id}`,
      );
    }
    if (type === "renew") {
      if (
        !Number.isInteger(Number(form.months)) ||
        Number(form.months) < 1 ||
        Number(form.months) > 24
      )
        err.months = "Chọn số tháng từ 1 đến 24.";
      if (!form.agree) err.agree = "Vui lòng xác nhận gửi yêu cầu gia hạn.";
      setErrors(err);
      if (!Object.keys(err).length)
        finish(
          "RENEW",
          { contract_id: p.contract_id, months: Number(form.months) },
          "Đã gửi yêu cầu gia hạn. Chờ quản lý phê duyệt.",
        );
    }
    if (type === "return") {
      if (!form.date || form.date < today())
        err.date = "Ngày trả kho không được ở quá khứ.";
      if (!form.agree) err.agree = "Vui lòng xác nhận điều kiện trả kho.";
      setErrors(err);
      if (!Object.keys(err).length)
        finish(
          "RETURN",
          { contract_id: p.contract_id, date: form.date, notes: form.notes },
          "Đã gửi yêu cầu trả kho. Cơ sở sẽ xác nhận lịch kiểm tra.",
        );
    }
    if (type === "cancel") {
      if (!form.reason.trim()) err.reason = "Vui lòng cho biết lý do hủy.";
      setErrors(err);
      if (!Object.keys(err).length)
        finish(
          "CANCEL_RESERVATION",
          { id: p.reservation_id, reason: form.reason.trim() },
          "Đã hủy đơn đặt kho.",
        );
    }
    if (type === "pay") {
      if (!form.agree)
        err.agree = "Vui lòng xác nhận thông tin thanh toán mẫu.";
      setErrors(err);
      if (!Object.keys(err).length)
        finish(
          "PAYMENT_NOTICE",
          { id: p.payment_id, method: form.method },
          "Đã gửi thông báo. Chờ nhân viên xác minh.",
        );
    }
    if (type === "handover") {
      if (!form.agree) err.agree = "Vui lòng xác nhận đã kiểm tra và nhận đủ.";
      setErrors(err);
      if (!Object.keys(err).length)
        finish(
          "CONFIRM_HANDOVER",
          { id: p.handover_id },
          "Đã ghi nhận xác nhận nhận kho của bạn.",
        );
    }
  };
  const agree = (label) => (
    <div className="ss-checkbox-wrap">
      <label className="ss-checkbox">
        <input
          type="checkbox"
          checked={form.agree}
          onChange={(e) => set("agree", e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {errors.agree && (
        <small className="ss-error" role="alert">
          {errors.agree}
        </small>
      )}
    </div>
  );
  const rate = data.rates.find(
    (r) =>
      r.facility_id === Number(form.facility_id) &&
      r.unit_type_id === Number(form.unit_type_id),
  );
  return (
    <Modal title={titles[type]} onClose={onClose} wide={type === "book"}>
      <form className="ss-modal-content" onSubmit={submit} noValidate>
        {type === "book" && (
          <>
            <div className="ss-grid two">
              <div>
                <Field label="Cơ sở *">
                  <select
                    value={form.facility_id}
                    onChange={(e) => set("facility_id", e.target.value)}
                  >
                    {data.facilities.map((f) => (
                      <option value={f.facility_id} key={f.facility_id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Loại kho *">
                  <select
                    value={form.unit_type_id}
                    onChange={(e) => set("unit_type_id", e.target.value)}
                  >
                    {data.unitTypes.map((t) => (
                      <option value={t.unit_type_id} key={t.unit_type_id}>
                        {t.name} · {t.size} m²
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="ss-grid two">
                  <Field label="Ngày bắt đầu *" error={errors.start_date}>
                    <input
                      type="date"
                      min={today()}
                      value={form.start_date}
                      onChange={(e) => set("start_date", e.target.value)}
                    />
                  </Field>
                  <Field
                    label="Số tháng thuê *"
                    error={errors.rental_period_months}
                  >
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={form.rental_period_months}
                      onChange={(e) =>
                        set("rental_period_months", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="ss-summary">
                <h3>Dự toán thuê kho</h3>
                <Details
                  items={[
                    ["Đơn giá / tháng", money(rate.monthly_rate)],
                    [
                      "Tiền thuê",
                      money(
                        rate.monthly_rate *
                          (Number(form.rental_period_months) || 0),
                      ),
                    ],
                    ["Tiền cọc (mẫu)", money(rate.monthly_rate)],
                    [
                      "Kết thúc dự kiến",
                      form.start_date && Number(form.rental_period_months) > 0
                        ? dateLabel(
                            addMonths(
                              form.start_date,
                              form.rental_period_months,
                            ),
                          )
                        : "—",
                    ],
                  ]}
                />
                <div className="ss-total">
                  <span>Tổng dự kiến</span>
                  <strong>
                    {money(
                      rate.monthly_rate *
                        ((Number(form.rental_period_months) || 0) + 1),
                    )}
                  </strong>
                </div>
              </div>
            </div>
            <Notice>
              {rate.available
                ? "Cơ sở sẽ xác nhận khả dụng và phân bổ kho cụ thể. Đây là yêu cầu đặt chỗ; chưa phát sinh thanh toán."
                : "Loại kho này hiện đã hết chỗ. Vui lòng chọn loại kho hoặc cơ sở khác."}
            </Notice>
            {agree(
              "Tôi đã kiểm tra kỳ thuê và chi phí dự kiến; đồng ý để cơ sở xác nhận đơn đặt kho.",
            )}
          </>
        )}
        {type === "renew" && (
          <>
            <p className="muted">
              Hợp đồng {p.contract_id} · Kết thúc hiện tại{" "}
              {dateLabel(p.end_date)}
            </p>
            <Field label="Số tháng gia hạn *" error={errors.months}>
              <select
                value={form.months}
                onChange={(e) => set("months", e.target.value)}
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option value={m} key={m}>
                    {m} tháng
                  </option>
                ))}
              </select>
            </Field>
            <div className="ss-summary">
              <Details
                items={[
                  [
                    "Ngày kết thúc dự kiến",
                    dateLabel(addMonths(p.end_date, form.months)),
                  ],
                  [
                    "Chi phí tạm tính",
                    money(p.agreed_monthly_rate * Number(form.months)),
                  ],
                ]}
              />
            </div>
            <Notice>
              Quản lý sẽ kiểm tra lịch trống và xác nhận giá. Ngày kết thúc chỉ
              được cập nhật sau khi gia hạn được duyệt và thanh toán hoàn tất.
            </Notice>
            {agree("Tôi đồng ý gửi yêu cầu gia hạn theo thông tin trên.")}
          </>
        )}
        {type === "return" && (
          <>
            <p className="muted">Hợp đồng {p.contract_id}</p>
            <Field label="Ngày muốn trả kho *" error={errors.date}>
              <input
                type="date"
                min={today()}
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Ghi chú">
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Thời gian thuận tiện, lưu ý khi kiểm tra…"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
            <Notice>
              Cơ sở sẽ xác nhận lịch kiểm tra, tình trạng kho và các khoản còn
              phải trả. Tiền cọc được xử lý sau khi đối soát.
            </Notice>
            {agree(
              "Tôi sẽ dọn toàn bộ đồ đạc và trả khóa / thẻ khi bàn giao kho.",
            )}
          </>
        )}
        {type === "cancel" && (
          <>
            <Notice>
              Bạn đang hủy đơn {p.reservation_id}. Muốn thuê lại, bạn cần tạo
              một đơn mới.
            </Notice>
            <Field label="Lý do hủy *" error={errors.reason}>
              <textarea
                maxLength={500}
                rows={4}
                placeholder="Ví dụ: Thay đổi kế hoạch lưu trữ"
                value={form.reason}
                onChange={(e) => set("reason", e.target.value)}
              />
            </Field>
          </>
        )}
        {type === "pay" && (
          <>
            <div className="ss-payment-heading">
              <Icon name="card" size={26} />
              <span>{p.payment_id}</span>
              <strong>{money(p.amount)}</strong>
            </div>
            <Field label="Phương thức thanh toán">
              <select
                value={form.method}
                onChange={(e) => set("method", e.target.value)}
              >
                <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
                <option value="CASH">Tiền mặt tại cơ sở</option>
              </select>
            </Field>
            {form.method === "BANK_TRANSFER" ? (
              <div className="ss-summary">
                <h3>Thông tin chuyển khoản mẫu</h3>
                <Details
                  items={[
                    ["Đơn vị nhận", "SAFESPACE DEMO"],
                    ["Tài khoản", "Chưa cấu hình"],
                    ["Nội dung", p.payment_id],
                    ["Số tiền", money(p.amount)],
                  ]}
                />
                <p className="muted">
                  Bản demo không cung cấp tài khoản nhận tiền và không thực hiện
                  giao dịch thật.
                </p>
              </div>
            ) : (
              <Notice>
                Bạn thanh toán tại quầy của cơ sở đang thuê. Nhân viên kiểm tra
                và xác nhận khoản phí sau khi nhận tiền.
              </Notice>
            )}
            {agree(
              "Tôi muốn mô phỏng gửi thông báo thanh toán để kiểm tra giao diện.",
            )}
            <p className="muted">
              Gửi thông báo không tự chuyển khoản phí sang “Đã thanh toán”.
            </p>
          </>
        )}
        {type === "handover" && (
          <>
            <Details
              items={[
                ["Biên bản", p.handover_id],
                ["Hợp đồng", p.contract_id],
                ["Tình trạng kho", p.initial_condition],
              ]}
            />
            {agree(
              "Tôi đã kiểm tra tình trạng kho, nhận đủ khóa / thẻ và đồng ý biên bản bàn giao.",
            )}
          </>
        )}
        <div className="ss-form-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Quay lại
          </Button>
          <Button
            type="submit"
            variant={type === "cancel" ? "danger" : ""}
            disabled={submitting || (type === "book" && !rate.available)}
          >
            {submitting ? "Đang gửi yêu cầu..." : (
              type === "book"
                ? "Gửi yêu cầu đặt kho"
                : type === "cancel"
                  ? "Xác nhận hủy đơn"
                  : type === "pay"
                    ? "Gửi thông báo mẫu"
                    : "Gửi xác nhận"
            )}
            <Icon name="arrow" size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
