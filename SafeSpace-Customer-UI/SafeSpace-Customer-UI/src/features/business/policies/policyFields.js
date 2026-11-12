import { policyValueLabel, replacementOf, parseMoney } from "../utils/businessFormat.js";

// Phân định rõ 3 nhóm chính sách theo chuẩn tinh gọn:
// 1. Tham số vận hành tự động (Active Engine Rules - có consumer backend thực thi)
// 2. Quy định cố định theo hệ thống (System Enforced Policies - Chỉ đọc)
// 3. Nội dung hướng dẫn nghiệp vụ (Guidance Only - Lưu mô tả, không đổi xử lý tự động)

export const ENGINE_SECTIONS = [
  {
    title: 'Quy tắc vận hành tự động',
    category: 'ENGINE',
    tone: 'green',
    badge: 'Tự động áp dụng',
    description: 'Các tham số tự động thực thi trong tính tiền cọc, phí phạt quá hạn và số ngày đệm kho trống.',
    fields: [
      { key: 'deposit', label: 'Mức đặt cọc mặc định', type: 'DEPOSIT', numeric: true, readOnly: true, suffix: '', hint: 'Cố định bằng 1 tháng tiền thuê toàn hệ thống.' },
      { key: 'overdue', label: 'Tỷ lệ phí phạt quá hạn', type: 'OVERDUE', numeric: true, suffix: '% cọc / ngày', placeholder: '5', hint: 'Từ 0.01% đến 100% cọc ban đầu mỗi ngày trễ.' },
      { key: 'relet', label: 'Ngày đệm cho thuê lại', type: 'RELET_BUFFER', numeric: true, suffix: 'ngày', placeholder: '3', hint: 'Từ 0 đến 60 ngày sau khi hợp đồng cũ kết thúc.' },
    ],
  },
];

export const SYSTEM_ENFORCED_POLICIES = [
  {
    key: 'expiring',
    label: 'Thông báo sắp hết hạn hợp đồng',
    value: '30 ngày trước khi hết hạn',
    reference: 'D11 · OverdueProcessor',
    description: 'Hệ thống tự động rà soát hàng ngày và gửi thông báo nhắc gia hạn đến khách hàng.',
  },
  {
    key: 'online_hold',
    label: 'Hạn giữ chỗ thanh toán trực tuyến',
    value: '15 phút',
    reference: 'D02 · ReservationService',
    description: 'Thời gian đếm ngược giữ kho kể từ lúc tạo đơn thanh toán trực tuyến.',
  },
  {
    key: 'counter_hold',
    label: 'Hạn giữ chỗ thanh toán tại quầy',
    value: 'Đến hết ngày hẹn nhận kho',
    reference: 'D02/D43 · PayOSService',
    description: 'Đơn giữ chỗ tại quầy có hiệu lực đến 23:59:59 của ngày hẹn nhận kho theo giờ Việt Nam.',
  },
  {
    key: 'renewal_hold',
    label: 'Hạn thanh toán yêu cầu gia hạn',
    value: '24 giờ kể từ khi duyệt',
    reference: 'D11/D32 · RenewalApproval',
    description: 'Khách hàng có 24 giờ để thanh toán gia hạn sau khi yêu cầu được phê duyệt.',
  },
  {
    key: 'penalty_cap',
    label: 'Trần khấu trừ quá hạn & đền bù',
    value: 'Tối đa 100% tiền cọc',
    reference: 'D27/D32/D48',
    description: 'Tổng tiền phạt quá hạn và phí đền bù hư hỏng không bao giờ vượt quá tiền cọc ban đầu.',
  },
  {
    key: 'cleaning_fee',
    label: 'Phí vệ sinh cơ bản khi trả kho',
    value: '10% tiền cọc ban đầu',
    reference: 'D32 · Tiêu chuẩn trả kho',
    description: 'Khấu trừ khi kho trả lại chưa được dọn dẹp vệ sinh theo đúng tiêu chuẩn bàn giao.',
  },
  {
    key: 'disposal_milestone',
    label: 'Mốc xử lý tài sản quá hạn',
    value: 'Ngày thứ 20 quá hạn',
    reference: 'D32/D45 · Quyền truy cập khoá ngay',
    description: 'Khoá quyền truy cập; lập biên bản và bắt đầu quy trình xử lý tài sản lưu kho.',
  },
];

export const GUIDELINE_SECTIONS = [
  {
    title: 'Quy định cố định & Hướng dẫn nghiệp vụ',
    category: 'GUIDELINE',
    tone: 'warn',
    badge: 'Chỉ hiển thị, không thay đổi xử lý tự động',
    notice: 'Nội dung hướng dẫn nghiệp vụ và điều khoản phục vụ tham khảo cho khách hàng và nhân viên.',
    fields: [
      { key: 'refund', label: 'Thời gian hoàn trả tiền cọc', value: '3–5 ngày làm việc', type: 'RETURN', hint: 'Hoàn trả chuyển khoản sau khi hoàn tất kiểm tra và trừ các khoản phí (nếu có).' },
      { key: 'inspection', label: 'Thời gian kiểm tra khi trả kho', value: 'Trong vòng 24 giờ', type: 'RETURN', hint: 'Nhân viên hoàn tất kiểm kê hiện trạng kho sau khi khách hàng bàn giao.' },
      { key: 'renewals', label: 'Số lần gia hạn hợp đồng', value: 'Không giới hạn', type: 'RENEWAL', hint: 'Khách hàng có thể gia hạn nhiều lần nếu ô kho chưa có người khác đặt trước.' },
      { key: 'cancel', label: 'Phí huỷ trước ngày nhận kho', value: '0% (Miễn phí huỷ)', type: 'CANCELLATION', hint: 'Khách hàng huỷ trước ngày bắt đầu thuê được hoàn 100% tiền thuê và 100% tiền cọc.' },
      { key: 'grace', label: 'Quy trình xử lý quá hạn', value: 'Nhắc nhở ngày 10–14, xử lý đồ ngày 20', type: 'OVERDUE', hint: 'Nhắc nhở và đôn đốc thanh toán trước khi tiến hành xử lý tài sản tồn kho.' },
    ],
  },
];

export const LEGACY_FIELDS = [
  { key: 'reminder', label: 'Thông báo trước khi hết hạn (Legacy)', type: 'RENEWAL', numeric: true, legacy: true },
];

export const POLICY_SECTIONS = [
  ...ENGINE_SECTIONS,
  ...GUIDELINE_SECTIONS,
];

export const policyFields = [
  ...POLICY_SECTIONS.flatMap(s => s.fields),
  ...LEGACY_FIELDS,
];

export function isLegacyRenewal(p) {
  if (!p || p.policyType !== 'RENEWAL') return false;
  const name = (p.policyName || '').toLowerCase();
  const desc = (p.ruleDescription || '').toLowerCase();
  return Number(p.value) === 24 || desc.includes('24 giờ') || name.includes('giữ chỗ') || desc.includes('giữ chỗ');
}

export function legacyPolicies(policies) {
  return (policies || []).filter(isLegacyRenewal);
}

export function fieldPolicy(policies, field, day) {
  return (policies || []).filter(p => {
    if (p.status !== 'ACTIVE' || p.facilityId != null || p.unitTypeId != null || p.policyType !== field.type) return false;
    // Bỏ ánh xạ RENEWAL=24 sang ô "Thông báo trước khi hết hạn" (P0).
    if (field.key === 'reminder' && isLegacyRenewal(p)) return false;
    return p.effectiveFrom <= day && (!p.effectiveTo || p.effectiveTo >= day);
  }).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.policyId - a.policyId)[0];
}

function descriptionField(p, field) {
  const prefix = field.label + ': ';
  return p?.ruleDescription?.split('\n').find(line => line.startsWith(prefix))?.slice(prefix.length);
}

export function fieldValue(p, field) {
  if (!p) return '';
  // P0: Bỏ ánh xạ RENEWAL=24 sang ô "Thông báo trước khi hết hạn" (không định dạng thành 24 ngày).
  if (field.key === 'reminder' && isLegacyRenewal(p)) return '';
  if (['reminder', 'relet'].includes(field.key) && p.calculationType === 'FIXED') return `${p.value} ngày`;
  if (field.numeric) return policyValueLabel(p, field.key === 'overdue' ? '/ ngày' : '');
  const explicit = descriptionField(p, field);
  if (explicit !== undefined) return explicit;
  if (['refund', 'cancel'].includes(field.key) && !p.ruleDescription?.includes('Thời gian kiểm tra sau khi trả kho: ')) return p.ruleDescription || '';
  return '';
}

/** Giá trị thô nạp vào ô input biểu mẫu */
export function fieldRawValue(p, field) {
  if (field.key === 'deposit') {
    return '1 tháng tiền thuê';
  }
  if (!p || p.value === null || p.value === undefined) {
    return '';
  }
  return String(p.value);
}

/** Kiểm tra tính hợp lệ của số nhập vào biểu mẫu */
export function validatePolicyNumber(key, raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return 'Không được để trống.';
  }
  const s = String(raw).trim();
  if (key === 'overdue') {
    const normalized = s.replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      return 'Nhập tỷ lệ từ 0.01 đến 100, tối đa 2 chữ số thập phân (ví dụ: 5 hoặc 5,25).';
    }
    const val = Number(normalized);
    if (!Number.isFinite(val) || val < 0.01 || val > 100) {
      return 'Tỷ lệ phải từ 0.01% đến 100% cọc / ngày.';
    }
    return null;
  }
  if (key === 'relet') {
    if (!/^\d+$/.test(s)) {
      return 'Nhập số ngày nguyên từ 0 đến 60 (ví dụ: 3).';
    }
    const val = Number(s);
    if (!Number.isInteger(val) || val < 0 || val > 60) {
      return 'Số ngày đệm phải từ 0 đến 60 ngày.';
    }
    return null;
  }
  return null;
}

function numericValue(p, field, text) {
  const str = String(text ?? '').trim();
  const raw = str.replace(/tháng tiền thuê|(?:\/\s*)?ngày|[đ₫%]/g, '').trim();
  if (!/^[\d.,\s]+$/.test(raw)) {
    throw new Error(`${field.label}: nhập một mức cụ thể, ví dụ 500.000đ hoặc 1 tháng tiền thuê.`);
  }

  // Handle relet buffer specifically:
  if (field.key === 'relet') {
    const normalized = raw.replace(',', '.');
    const val = Number(normalized);
    if (!Number.isInteger(val) || val < 0 || val > 60) {
      throw new Error(`${field.label}: nhập số ngày nguyên từ 0 đến 60.`);
    }
    return val;
  }

  // Handle overdue rate specifically (numbers, percentage or VND for legacy mock):
  if (field.key === 'overdue') {
    const normalized = raw.replace(',', '.');
    const parsedNum = Number(normalized);
    // If text has 'đ' or value is > 100 with FIXED, treat as money:
    if (str.includes('đ') || (p?.calculationType === 'FIXED' && parsedNum > 100)) {
      const n = parseMoney(raw);
      if (!Number.isFinite(n) || n < 0) throw new Error(`${field.label}: giá trị không hợp lệ.`);
      return n;
    }
    // Otherwise treat as percentage (0.01 - 100, max 2 decimals):
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      throw new Error(`${field.label}: nhập số từ 0.01 đến 100, tối đa 2 chữ số thập phân.`);
    }
    if (!Number.isFinite(parsedNum) || parsedNum < 0.01 || parsedNum > 100) {
      throw new Error(`${field.label}: tỷ lệ phải từ 0.01% đến 100%.`);
    }
    return parsedNum;
  }

  const isPercent = p?.calculationType === 'PERCENTAGE' || p?.calculationType === 'DEPOSIT_PERCENT_PER_DAY';
  const n = (field.key === 'deposit' && /tháng/.test(str) || isPercent) ? Number(raw.replace(',', '.')) : parseMoney(raw);
  if (!Number.isFinite(n) || n < 0 || isPercent && n > 100) {
    throw new Error(`${field.label}: giá trị không hợp lệ.`);
  }
  return n;
}

// One job per policy TYPE/scope, matching the API's conflict rule. Extra guidance
// shares ruleDescription with that policy rather than creating conflicting rows.
export function policyJobs(policies, drafts, day) {
  const types = [...new Set(policyFields.filter(f => f.key in drafts).map(f => f.type))];
  return types.map(type => {
    const fields = policyFields.filter(f => f.type === type), p = fieldPolicy(policies, fields[0], day);
    const edited = fields.filter(f => f.key in drafts);
    for (const f of edited) if (!String(drafts[f.key]).trim()) throw new Error(`${f.label}: không được để trống.`);
    const numeric = fields.find(f => f.numeric), values = {};
    if (numeric && numeric.key in drafts) {
      if (p?.calculationType === 'RANGE') throw new Error(`${numeric.label}: chính sách khoảng giá hiện tại cần được kiểm tra trước khi sửa.`);
      if (p?.calculationType === 'RULE') values.ruleDescription = drafts[numeric.key].trim();
      else {
        values.value = numericValue(p, numeric, drafts[numeric.key]);
        if (numeric.key === 'overdue' && !String(drafts[numeric.key]).includes('đ')) {
          values.calculationType = 'DEPOSIT_PERCENT_PER_DAY';
        }
      }
    }
    const textFields = fields.filter(f => !f.numeric);
    if (textFields.some(f => f.key in drafts)) {
      const knownPrefixes = fields.map(f => f.label + ': ');
      const existing = (p?.ruleDescription || '').split('\n').filter(line => line && !knownPrefixes.some(prefix => line.startsWith(prefix)));
      // Existing unstructured RETURN/CANCELLATION description is surfaced in its first field.
      const unstructuredOwned = fields.some(f => ['refund', 'cancel'].includes(f.key));
      const preserved = unstructuredOwned ? [] : existing;
      values.ruleDescription = [...preserved, ...textFields.map(f => [f.label, String(drafts[f.key] ?? fieldValue(p, f)).trim()]).filter(([, v]) => v).map(([label, v]) => `${label}: ${v}`)].join('\n');
    }
    const calculationType = (numeric && numeric.key === 'overdue' && !String(drafts[numeric.key] ?? '').includes('đ'))
      ? 'DEPOSIT_PERCENT_PER_DAY'
      : (p?.calculationType || (numeric ? 'FIXED' : 'RULE'));
    if (!p && numeric && values.value === undefined) {
      // Do not invent a fee/reminder/deposit amount just to save a text instruction.
      throw new Error(`Vui lòng thiết lập ${numeric.label.toLowerCase()} trước khi lưu quy định cùng nhóm.`);
    }
    const body = p ? replacementOf(p, values, day) : { policyName: fields[0].label, policyType: type, calculationType, value: null, minValue: null, maxValue: null, ruleDescription: values.ruleDescription || fields.map(f => [f.label, String(drafts[f.key] ?? '').trim()]).filter(([, v]) => v).map(([label, v]) => `${label}: ${v}`).join('\n'), facilityId: null, unitTypeId: null, effectiveFrom: day, effectiveTo: null, ...values };
    return { p, body, keys: edited.map(f => f.key) };
  });
}
