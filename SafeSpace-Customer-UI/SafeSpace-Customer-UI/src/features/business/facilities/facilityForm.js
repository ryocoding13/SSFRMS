/**
 * FACILITY FORM HELPERS - CHUYỂN ĐỔI VÀ KIỂM TRA DỮ LIỆU CƠ SỞ (B05a / D20)
 *
 * Nghiệp vụ D20:
 * - Lưu tọa độ (vĩ độ, kinh độ) trực tiếp trong database để hiển thị bản đồ Leaflet.
 * - Tách cặp tọa độ sao chép từ Google Maps ("10.6935, 106.7222") thành vĩ độ/kinh độ riêng biệt.
 * - Kiểm tra tính hợp lệ về định dạng giờ mở/đóng cửa và phạm vi tọa độ địa lý Việt Nam.
 */
// B05a · Sửa thông tin cơ sở — chuyển giữa dữ liệu API và form, kiểm tra trước khi gửi
// (backend kiểm tra lại y hệt trong OperationsService.ValidateFacility).

const VN = { latMin: 8, latMax: 24, lngMin: 102, lngMax: 110 };

const text = (v) => (v == null ? "" : String(v));
const num = (v) => Number(String(v).trim().replace(",", "."));

/**
 * Chuyển dữ liệu cơ sở từ API thành dữ liệu hiển thị trong form.
 * @param {Object} f - Đối tượng cơ sở từ backend
 * @returns {Object} Dữ liệu form chuẩn hóa
 */
export function facilityToForm(f) {
  return {
    name: text(f?.name),
    address: text(f?.address),
    contactPhone: text(f?.contactPhone),
    openingTime: text(f?.openingTime),
    closingTime: text(f?.closingTime),
    latitude: f?.latitude == null ? "" : String(f.latitude),
    longitude: f?.longitude == null ? "" : String(f.longitude),
  };
}

// Dán "10.6935, 106.7222" (copy từ Google Maps) → tách thành vĩ độ / kinh độ. Không phải cặp số thì trả null.
/**
 * Tách chuỗi tọa độ (dán từ Google Maps dạng "lat, lng") thành cặp vĩ độ/kinh độ.
 * @param {string} value - Chuỗi tọa độ cần tách
 * @returns {{ latitude: string, longitude: string } | null}
 */
export function splitCoordinates(value) {
  const m = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { latitude: m[1], longitude: m[2] } : null;
}

// Trả { errors } nếu sai, hoặc { body } đúng hợp đồng PUT /api/operations/facilities/{id}
/**
 * Kiểm tra tính hợp lệ của form và chuyển thành body request gửi lên API cập nhật cơ sở.
 * @param {Object} form - Dữ liệu nhập từ form
 * @returns {{ errors: Object } | { body: Object }}
 */
export function formToRequest(form) {
  const errors = {};
  const name = form.name.trim();
  const address = form.address.trim();
  if (!name) errors.name = "Tên cơ sở không được để trống.";
  else if (name.length > 150) errors.name = "Tên cơ sở tối đa 150 ký tự.";
  if (!address) errors.address = "Địa chỉ không được để trống.";
  else if (address.length > 255) errors.address = "Địa chỉ tối đa 255 ký tự.";

  const open = form.openingTime.trim();
  const close = form.closingTime.trim();
  if (Boolean(open) !== Boolean(close)) errors.hours = "Nhập cả giờ mở cửa và giờ đóng cửa, hoặc để trống cả hai.";
  else if (open && close && open >= close) errors.hours = "Giờ mở cửa phải trước giờ đóng cửa.";

  const latText = form.latitude.trim();
  const lngText = form.longitude.trim();
  let latitude = null;
  let longitude = null;
  if (latText || lngText) {
    latitude = num(latText);
    longitude = num(lngText);
    if (!latText || !lngText) errors.coords = "Cần nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.";
    else if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) errors.coords = "Vĩ độ và kinh độ phải là số, ví dụ 10.6935 và 106.7222.";
    else if (latitude < VN.latMin || latitude > VN.latMax || longitude < VN.lngMin || longitude > VN.lngMax)
      errors.coords = "Toạ độ phải nằm trong Việt Nam (vĩ độ 8–24, kinh độ 102–110). Kiểm tra có nhập ngược hai ô không.";
    else {
      latitude = Math.round(latitude * 1e6) / 1e6;
      longitude = Math.round(longitude * 1e6) / 1e6;
    }
  }
  if (Object.keys(errors).length) return { errors };

  return {
    body: {
      name,
      address,
      contactPhone: form.contactPhone.trim() || null,
      openingTime: open || null,
      closingTime: close || null,
      status: null, // đổi trạng thái dùng endpoint /status riêng
      latitude,
      longitude,
    },
  };
}

export const coordinateLabel = (f) =>
  f?.latitude != null && f?.longitude != null ? `${Number(f.latitude).toFixed(6)}, ${Number(f.longitude).toFixed(6)}` : "Chưa có";

/**
 * Định dạng nhãn hiển thị Quản lý cơ sở cho Business Operator:
 * - Có tên hợp lệ (managerName / manager_name): trả về họ tên.
 * - Có danh sách managers: ghép tên (hoặc "Quản lý #{id}" nếu thiếu họ tên) cách nhau bởi dấu phẩy.
 * - Có managerId / manager_id nhưng không có tên: trả về "Quản lý #{id}".
 * - Không có phân công: trả về "Chưa phân công".
 * - Tuyệt đối không trả về "Chưa có thông tin".
 *
 * @param {Object} facility - Đối tượng cơ sở từ backend hoặc null/undefined
 * @returns {string} Nhãn hiển thị
 */
export function managerLabel(facility) {
  if (!facility) return "Chưa phân công";
  const name = (facility.managerName || facility.manager_name || "").trim();
  if (name) return name;

  const managers = facility.managers;
  if (Array.isArray(managers) && managers.length > 0) {
    const names = managers
      .map((m) => {
        const n = (m.fullName || m.full_name || "").trim();
        if (n) return n;
        const id = m.userId || m.user_id;
        return id ? `Quản lý #${id}` : "";
      })
      .filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }

  const id = facility.managerId || facility.manager_id;
  if (id) {
    return `Quản lý #${id}`;
  }

  return "Chưa phân công";
}
