import { returnDeductions } from "../../../shared/utils/returnPolicy.js";
import { dateLabel, money } from "../../../shared/utils/format.js";

// Nội dung hộp thoại xác nhận (02), thành công (03a) và thất bại (03b) cho thao tác tại cơ sở.
// Chữ lấy theo Figma: S02–S05, S09 (779:*), S05c–e (831:*), M03a–d (847:*), phân bổ / phân công (885:*).
// confirm: false → trang đã có hộp thoại riêng (nhập lý do…), provider chỉ hiện kết quả.
// D32: ước tính chỉ dùng trong demo; máy chủ quyết toán số chính thức.
export const settleReturn = returnDeductions;
const GENERIC_FAIL = "Chưa ghi nhận thay đổi. Giữ nội dung đã nhập để kiểm tra và thử lại.";
// Phí quá hạn do backend tự tính khi xác nhận trả kho, không có trong biên bản S04
const FEE_KEYS = [["damage_fee", "Hư hỏng"], ["cleaning_fee", "Vệ sinh"]];

export function opsConfirmation(type, payload, ops) {
  const find = key => (ops[key] || []).find(x => x.id === payload.id);
  const facility = ops.facility?.name || "Cơ sở đang phụ trách";
  switch (type) {
    case "CONFIRM_PAYMENT": {
      const p = find("payments");
      return {
        title: "Xác nhận đã thu đủ tiền?", text: "Kiểm tra khách hàng, mã đơn và số tiền thực nhận trước khi ghi nhận thanh toán.", label: "Xác nhận đã thu",
        rows: [["Đơn đặt chỗ", `${p?.id} · ${p?.customer}`], ["Số tiền thực nhận", money(p?.amount)], ["Hình thức thu", "Tiền mặt / chuyển khoản tại quầy"]],
        success: { title: "Đã ghi nhận thanh toán", text: `Đã thu ${money(p?.amount)} cho đơn ${p?.id}. Hệ thống cập nhật hợp đồng và quyền mở kho theo kỳ thuê.`, action: "Về danh sách thu tiền" },
        failure: { title: "Chưa xác nhận được thanh toán", text: "Chưa xác nhận được kết quả lưu. Kiểm tra trạng thái đơn trước khi thực hiện lại để tránh ghi nhận trùng." },
      };
    }
    case "VERIFY_CUSTOMER": {
      const v = find("verifications");
      return {
        title: "Xác nhận thông tin giấy tờ?", text: "Chỉ xác nhận khi đã đối chiếu đầy đủ giấy tờ và đúng người nhận chìa khóa.", label: "Xác nhận xác minh",
        rows: [["Khách hàng", v?.customer], ["Đơn đặt chỗ", v?.reservation_id || v?.id], ["Nội dung xác minh", `${payload.doc_type} · …${String(payload.doc_no || "").slice(-4)} · ảnh và thông tin khớp`]],
        success: { title: "Đã lưu kết quả xác minh", text: "Thông tin giấy tờ đã được xác minh. Tiếp tục ghi nhận việc nhận chìa khóa vật lý tại quầy.", action: "Tiếp tục nhận chìa khóa" },
        failure: { title: "Không lưu được kết quả xác minh", text: "Vui lòng kiểm tra lại thông tin và kết nối rồi thực hiện lại. Chưa thể chuyển sang bước nhận chìa khóa." },
      };
    }
    case "RECORD_KEY_RECEIPT": {
      const h = find("handovers");
      return {
        title: "Xác nhận khách đã nhận chìa khóa?", text: "Chỉ ghi nhận sau khi khách thực sự nhận đúng chìa khóa vật lý.", label: "Xác nhận đã nhận chìa khóa",
        rows: [["Khách hàng", h?.customer], ["Kho", `${h?.unit} · ${facility}`], ["Chìa khóa đã nhận", "01 chìa khóa vật lý"]],
        success: { title: "Đã ghi nhận nhận chìa khóa", text: `Đã cập nhật trạng thái nhận chìa khóa cho kho ${h?.unit}. QR và PIN vẫn có hiệu lực theo ngày bắt đầu, ngày kết thúc hợp đồng.`, action: "Về danh sách nhận chìa khóa" },
        failure: { title: "Không ghi nhận được việc nhận chìa khóa", text: "Kiểm tra trạng thái nhận chìa khóa và kết nối trước khi thử lại." },
      };
    }
    case "SUBMIT_RETURN": {
      const r = find("returns");
      const report = payload.report || {};
      const hasFees = FEE_KEYS.some(([k]) => report[k] != null);
      const total = FEE_KEYS.reduce((sum, [k]) => sum + (Number(report[k]) || 0), 0);
      return {
        title: "Xác nhận gửi biên bản trả kho?", text: "Kiểm tra tình trạng kho, các khoản phí và lý do trước khi gửi cho quản lý cơ sở.", label: "Xác nhận gửi biên bản",
        rows: [
          ["Kho / khách hàng", `${r?.unit} · ${r?.customer}`],
          ...(hasFees ? [["Phí phát sinh", FEE_KEYS.map(([k, label]) => `${label}: ${money(Number(report[k]) || 0)}`).join(" · ")]] : []),
          ["Đề xuất trạng thái", report.proposal],
        ],
        success: { title: "Đã gửi biên bản cho quản lý", text: `Biên bản trả kho ${r?.unit}${total ? ` và phí phát sinh ${money(total)}` : ""} đã được gửi để quản lý xem xét.`, action: "Về danh sách trả kho" },
        failure: { title: "Không gửi được biên bản", text: "Vui lòng kiểm tra kết nối và nội dung biên bản trước khi gửi lại." },
      };
    }
    case "TICKET_RESPONSE": {
      const t = find("tickets");
      const states = { WAITING_CUSTOMER: "Chờ khách xác nhận đã sử dụng được", IN_PROGRESS: "Tiếp tục xử lý", DONE: "Đã xử lý xong" };
      return {
        title: "Xác nhận lưu và gửi phản hồi?", text: "Phản hồi và trạng thái xử lý sẽ được lưu, đồng thời thông báo tới khách hàng.", label: "Xác nhận lưu phản hồi",
        rows: [["Yêu cầu hỗ trợ", `${t?.id} · Kho ${t?.unit} · ${t?.customer}`], ["Phản hồi", payload.note], ["Trạng thái tiếp theo", states[payload.next]]],
        success: { title: "Đã lưu và gửi phản hồi", text: `Yêu cầu ${t?.id} đã được cập nhật. Khách hàng nhận thông báo và xem được phản hồi trong tài khoản.`, action: "Về danh sách hỗ trợ" },
        failure: { title: "Không lưu được phản hồi", text: "Phản hồi chưa gửi thành công. Kiểm tra kết nối và gửi lại sau khi rà soát nội dung." },
      };
    }
    case "REISSUE_CREDENTIAL": {
      const kind = payload.type in REISSUE ? payload.type : "QR";
      const [confirm, success, failure] = REISSUE[kind];
      return {
        title: confirm[0], text: confirm[1], label: confirm[2],
        rows: [["Khách hàng / kho", [payload.customer, payload.unit].filter(Boolean).join(" · ")], ["Loại cấp lại", { QR: "Mã QR", PIN: "PIN 6 số", KEY: "01 chìa khóa vật lý" }[kind]], ["Lý do", payload.reason]],
        success: { title: success[0], text: success[1].replace("{unit}", payload.unit || ""), action: "Về yêu cầu hỗ trợ" },
        failure: { title: failure[0], text: failure[1], action: "Quay lại xác nhận" },
      };
    }
    // Quản lý cơ sở
    case "ALLOCATE": {
      const a = find("allocations");
      return {
        title: "Phân bổ ô kho?", text: "Kiểm tra thông tin trước khi xác nhận. Chọn Quay lại để giữ nguyên dữ liệu.", label: "Xác nhận", hint: "Chỉ lưu thay đổi sau khi bạn bấm Xác nhận.",
        rows: [["Thao tác", "Phân bổ ô kho"], ["Phạm vi", facility], ["Nội dung", `${a?.id} · ${a?.customer} → ô ${payload.unit}`]],
        success: { title: "Đã phân bổ ô kho", text: `Thay đổi đã được ghi nhận. ${facility}.`, action: "Về màn hình trước" },
        failure: { title: "Không phân bổ ô kho được", text: GENERIC_FAIL },
      };
    }
    case "ASSIGN": {
      const a = find("assignments");
      const staff = (ops.staff || []).find((s) => s.staff_id === payload.staff)?.full_name || payload.staff;
      return {
        title: "Lưu phân công nhân viên?", text: "Kiểm tra thông tin trước khi xác nhận. Chọn Quay lại để giữ nguyên dữ liệu.", label: "Xác nhận", hint: "Chỉ lưu thay đổi sau khi bạn bấm Xác nhận.",
        rows: [["Thao tác", "Lưu phân công nhân viên"], ["Phạm vi", facility], ["Nội dung", `${a?.title} → ${staff}`]],
        success: { title: "Đã lưu phân công nhân viên", text: `Thay đổi đã được ghi nhận. ${facility}.`, action: "Về màn hình trước" },
        failure: { title: "Không lưu phân công nhân viên được", text: GENERIC_FAIL },
      };
    }
    case "DECIDE_RENEWAL": {
      const r = find("renewals");
      if (!payload.approve)
        return {
          confirm: false,
          success: { title: "Đã từ chối yêu cầu", text: "Lý do đã được gửi cho khách. Hợp đồng giữ nguyên kỳ thuê hiện tại.", action: "Về yêu cầu gia hạn" },
          failure: { title: "Chưa từ chối được yêu cầu", text: GENERIC_FAIL },
        };
      return {
        title: `Duyệt gia hạn kho ${r?.unit}?`, text: "Duyệt để khách thanh toán tiền thuê kỳ mới. Chỉ cập nhật ngày kết thúc hợp đồng khi đủ điều kiện thanh toán.", label: "Xác nhận duyệt", hint: "Kiểm tra thông tin trước khi xác nhận.",
        rows: [["Khách hàng", r?.customer], ["Kỳ gia hạn", r ? `${dateLabel(r.from)}–${dateLabel(r.to)}` : ""], ["Trạng thái sau khi duyệt", "Chờ khách thanh toán"]],
        success: { title: "Đã duyệt · Chờ thanh toán", text: "Khách nhận khoản tiền thuê kỳ mới trong mục Thanh toán. Kỳ thuê chính thức được cập nhật khi đủ điều kiện thanh toán.", action: "Về yêu cầu gia hạn" },
        failure: { title: "Chưa duyệt được gia hạn", text: GENERIC_FAIL },
      };
    }
    // Các thao tác quản lý có hộp thoại nhập liệu riêng trên trang → chỉ hiện kết quả (Figma "Kết quả · … (trên M02/M07)")
    case "CREATE_UNIT":
      return {
        confirm: false,
        success: { title: `Đã thêm ô kho ${payload.code}`, text: "Ô mới ở trạng thái Trống, khách đặt được ngay.", action: "Đã hiểu" },
        failure: { title: "Không thêm ô kho được", text: GENERIC_FAIL },
      };
    case "UPDATE_UNIT":
      return {
        confirm: false,
        success: { title: `Đã lưu ô kho #${payload.code || payload.id}`, text: "Thông tin ô đã cập nhật trong danh sách kho.", action: "Đã hiểu" },
        failure: { title: "Không lưu ô kho được", text: GENERIC_FAIL },
      };
    case "UPDATE_UNIT_STATUS":
      return {
        confirm: false,
        success: { title: `Đã đổi trạng thái kho #${payload.code}`, text: "Lần đổi được ghi vào lịch sử trạng thái của ô.", action: "Đã hiểu" },
        failure: { title: "Không đổi trạng thái được", text: GENERIC_FAIL },
      };
    case "CONFIRM_REFUND": {
      return {
        confirm: false,
        success: (result = {}) => ({
          title: "Đã chốt trả kho",
          text: `Hợp đồng ${payload.id} đã chốt trả kho. ${typeof result.refund === "number" ? `Số tiền hoàn: ${money(result.refund)}. ` : ""}Xem khoản hoàn và trạng thái chuyển tiền ở mục Hoàn cọc sau trả kho. Chốt trả kho không xác nhận đã chuyển tiền.`,
          action: "Đã hiểu",
        }),
        failure: { title: "Không xác nhận trả kho được", text: GENERIC_FAIL },
      };
    }
    default:
      return {
        title: "Xác nhận thay đổi?", text: "Kiểm tra thông tin trước khi lưu thay đổi tại cơ sở.", label: "Xác nhận thay đổi",
        rows: Object.entries(payload).map(([key, value]) => [({ unit: "Kho", type: "Loại mã / chìa khóa", reason: "Lý do", status: "Trạng thái", code: "Mã kho", id: "Mã yêu cầu" })[key] || key, String(value ?? "")]),
      };
  }
}

// S05c–e: [xác nhận, thành công, thất bại] theo loại cấp lại
const REISSUE = {
  QR: [
    ["Xác nhận cấp lại QR?", "QR cũ sẽ bị vô hiệu hóa. PIN 6 số hiện tại và thời gian hiệu lực hợp đồng được giữ nguyên.", "Xác nhận cấp lại QR"],
    ["Đã cấp lại QR", "QR cũ đã bị vô hiệu hóa. Khách xem QR mới trong tài khoản; PIN và kỳ hợp đồng không đổi."],
    ["Chưa cấp lại được QR", "Yêu cầu chưa hoàn tất. Kiểm tra trạng thái mã và kết nối trước khi thử lại."],
  ],
  PIN: [
    ["Xác nhận cấp lại PIN?", "PIN cũ sẽ bị vô hiệu hóa. QR hiện tại và thời gian hiệu lực hợp đồng được giữ nguyên.", "Xác nhận cấp lại PIN"],
    ["Đã cấp lại PIN 6 số", "PIN cũ đã bị vô hiệu hóa. Khách xem PIN mới trong tài khoản; QR và kỳ hợp đồng không đổi."],
    ["Chưa cấp lại được PIN", "Yêu cầu chưa hoàn tất. Kiểm tra trạng thái PIN và kết nối trước khi thử lại."],
  ],
  KEY: [
    ["Đã giao chìa khóa thay thế?", "Chỉ ghi nhận sau khi đã đối chiếu khách hàng và giao chìa khóa tại quầy. Quyền mở kho không thay đổi.", "Xác nhận đã giao"],
    ["Đã ghi nhận giao chìa khóa", "Đã ghi nhận giao 01 chìa khóa thay thế cho kho {unit}. QR, PIN và kỳ hợp đồng không đổi."],
    ["Chưa lưu được giao chìa khóa", "Nếu đã giao chìa khóa, kiểm tra lại lịch sử trước khi lưu tiếp. Không giao thêm chìa khóa."],
  ],
};

// Thao tác của quản lý có hộp thoại kết quả (Figma 885:*, M03a–d, kết quả M02/M07). Mục có confirm: false dùng hộp thoại
// nhập liệu riêng trên trang (M02a, M02b, M02c, M07a, M03b) nên provider chỉ hiện kết quả. M08a tự hiện kết quả trên trang.
export const MANAGER_CONFIRM = new Set(["ALLOCATE", "ASSIGN", "DECIDE_RENEWAL", "CREATE_UNIT", "UPDATE_UNIT", "UPDATE_UNIT_STATUS", "CONFIRM_REFUND"]);
