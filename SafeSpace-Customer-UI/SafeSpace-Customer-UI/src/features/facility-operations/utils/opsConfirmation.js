import { money } from "../../../shared/utils/format.js";

export function opsConfirmation(type, payload, ops) {
  const find = key => (ops[key] || []).find(x => x.id === payload.id);
  switch (type) {
    case "CONFIRM_PAYMENT": {
      const p = find("payments");
      return { title: "Xác nhận đã thu đủ tiền?", text: "Kiểm tra khách hàng, mã đơn và số tiền thực nhận trước khi ghi nhận thanh toán.", label: "Xác nhận đã thu", rows: [["Đơn đặt chỗ", `${p?.id} · ${p?.customer}`], ["Số tiền thực nhận", money(p?.amount)], ["Hình thức thu", "Tiền mặt / chuyển khoản tại quầy"]] };
    }
    case "VERIFY_CUSTOMER": {
      const v = find("verifications");
      return { title: "Xác nhận giấy tờ khách hàng?", text: "Chỉ xác nhận khi ảnh và thông tin trên giấy tờ khớp với khách hàng.", label: "Xác nhận giấy tờ", rows: [["Khách hàng / Kho", `${v?.customer} · ${v?.unit}`], ["Giấy tờ", `${payload.doc_type} · …${String(payload.doc_no || "").slice(-4)}`]] };
    }
    case "RECORD_KEY_RECEIPT": {
      const h = find("handovers");
      return { title: "Xác nhận khách đã nhận chìa khóa?", text: "Ghi nhận nhận chìa khóa vật lý tại quầy. Thao tác này không kích hoạt hợp đồng hoặc quyền mở kho.", label: "Ghi nhận đã nhận chìa khóa", rows: [["Khách hàng / Kho", `${h?.customer} · ${h?.unit}`], ["Chìa khóa vật lý", "01 chìa khóa"]] };
    }
    case "SUBMIT_RETURN": {
      const r = find("returns");
      return { title: "Gửi biên bản trả kho?", text: "Kiểm tra các mục kiểm tra và đề xuất trước khi gửi cho quản lý cơ sở.", label: "Gửi biên bản", rows: [["Khách hàng / Kho", `${r?.customer} · ${r?.unit}`], ...Object.entries({ "Đồ lưu trữ": payload.report.items, "Tường, sàn & cửa kho": payload.report.walls, "Chìa khóa vật lý": payload.report.keys, "Đề xuất": payload.report.proposal })] };
    }
    case "TICKET_RESPONSE": {
      const t = find("tickets");
      const states = { WAITING_CUSTOMER: "Chờ khách xác nhận", IN_PROGRESS: "Tiếp tục xử lý", DONE: "Đã xử lý xong" };
      return { title: "Lưu phản hồi hỗ trợ?", text: "Phản hồi và trạng thái xử lý sẽ được cập nhật cho yêu cầu này.", label: "Lưu phản hồi", rows: [["Yêu cầu", `${t?.id} · ${t?.customer}`], ["Phản hồi", payload.note], ["Trạng thái tiếp theo", states[payload.next]]] };
    }
    case "REISSUE_CREDENTIAL":
      return { title: "Xác nhận cấp lại?", text: payload.type === "KEY" ? "Tạo lịch nhận chìa khóa thay thế tại quầy. Quyền mở kho không thay đổi." : "Mã cũ cùng loại sẽ bị vô hiệu hóa. Thời gian hiệu lực hợp đồng không thay đổi.", label: "Xác nhận cấp lại", rows: [["Kho", payload.unit], ["Mục cần cấp lại", { QR: "Mã QR", PIN: "PIN 6 số", KEY: "Chìa khóa vật lý" }[payload.type]], ["Lý do", payload.reason]] };
    default:
      return { title: "Xác nhận thay đổi?", text: "Kiểm tra thông tin trước khi lưu thay đổi tại cơ sở.", label: "Xác nhận thay đổi", rows: Object.entries(payload).map(([key, value]) => [({ unit: "Kho", type: "Loại mã / chìa khóa", reason: "Lý do", status: "Trạng thái", code: "Mã kho", id: "Mã yêu cầu" })[key] || key, String(value ?? "")]) };
  }
}
