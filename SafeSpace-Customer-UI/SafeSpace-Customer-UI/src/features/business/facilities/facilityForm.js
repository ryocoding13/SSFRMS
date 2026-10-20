// B05a · Sửa thông tin cơ sở — chuyển giữa dữ liệu API và form, kiểm tra trước khi gửi
// (backend kiểm tra lại y hệt trong OperationsService.ValidateFacility).

const VN = { latMin: 8, latMax: 24, lngMin: 102, lngMax: 110 };

const text = (v) => (v == null ? "" : String(v));
const num = (v) => Number(String(v).trim().replace(",", "."));

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
export function splitCoordinates(value) {
  const m = String(value || "").trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  return m ? { latitude: m[1], longitude: m[2] } : null;
}

// Trả { errors } nếu sai, hoặc { body } đúng hợp đồng PUT /api/operations/facilities/{id}
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
