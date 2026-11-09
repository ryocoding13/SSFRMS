import { policyValueLabel, replacementOf, parseMoney } from "../utils/businessFormat.js";

// Phân định rõ 3 nhóm chính sách theo chuẩn P0 (SSFRMS-Business-Policies-Audit-and-Refactor-Plan.md):
// 1. Tham số vận hành tự động (Active Engine Rules - có consumer backend thực thi)
// 2. Quy định cố định theo hệ thống (System Enforced Policies - Chỉ đọc)
// 3. Nội dung hướng dẫn nghiệp vụ (Guidance Only - Lưu mô tả, không đổi xử lý tự động)

export const ENGINE_SECTIONS = [
  {
    title: 'Quy tắc vận hành tự động',
    category: 'ENGINE',
    tone: 'green',
    badge: 'Tự động áp dụng',
    description: 'Các tham số có consumer backend thực thi trực tiếp trong tính tiền cọc, phí phạt quá hạn và số ngày đệm kho trống.',
    fields: [
      { key: 'deposit', label: 'Mức đặt cọc mặc định', type: 'DEPOSIT', numeric: true, hint: '1 tháng tiền thuê (D09/D16). Đọc bởi FacilityService, ReservationService, RenewalUnitMove.' },
      { key: 'overdue', label: 'Phí phạt quá hạn / ngày', type: 'OVERDUE', numeric: true, hint: '% cọc ban đầu / ngày (mặc định 5%). Đọc bởi OverdueProcessor và nghiệp vụ trả kho.' },
      { key: 'relet', label: 'Ngày đệm cho thuê lại sau ngày hết hạn', type: 'RELET_BUFFER', numeric: true, hint: '0–60 ngày (D41, mặc định 3 ngày). Đọc bởi UnitAvailability khi kiểm tra kho trống.' },
    ],
  },
];

export const SYSTEM_ENFORCED_POLICIES = [
  {
    key: 'expiring',
    label: 'Thông báo sắp hết hạn (EXPIRING)',
    value: '30 ngày trước khi hết hạn',
    reference: 'D11 · OverdueProcessor',
    description: 'Worker tự động quét hàng ngày, gửi thông báo và chuyển trạng thái hợp đồng sang EXPIRING.',
  },
  {
    key: 'online_hold',
    label: 'Hạn giữ chỗ thanh toán trực tuyến',
    value: '15 phút',
    reference: 'D02 · ReservationService',
    description: 'Đếm ngược 15 phút từ lúc tạo đơn PayOS; hết hạn đơn tự động huỷ để trả kho trống.',
  },
  {
    key: 'counter_hold',
    label: 'Hạn giữ chỗ thanh toán tại quầy',
    value: 'Hết ngày hẹn nhận kho (theo giờ VN)',
    reference: 'D02/D43 · PayOSService',
    description: 'Giữ đơn đến 23:59:59 của ngày hẹn nhận kho theo giờ Việt Nam.',
  },
  {
    key: 'renewal_hold',
    label: 'Hạn thanh toán gia hạn sau khi duyệt',
    value: '24 giờ kể từ khi duyệt',
    reference: 'D11/D32 · RenewalApproval',
    description: 'Khách hàng có tối đa 24 giờ để thanh toán gia hạn sau khi quản lý cơ sở phê duyệt.',
  },
  {
    key: 'penalty_cap',
    label: 'Trần khấu trừ quá hạn & hư hỏng',
    value: 'Tối đa 100% tiền cọc',
    reference: 'D27/D32/D48',
    description: 'Tổng phí phạt quá hạn và phí đền bù hư hỏng không bao giờ vượt quá 100% tiền cọc ban đầu.',
  },
  {
    key: 'cleaning_fee',
    label: 'Phí vệ sinh cơ bản khi trả kho',
    value: '10% tiền cọc ban đầu',
    reference: 'D32 · Tiêu chuẩn trả kho',
    description: 'Áp dụng cố định khi kho trả lại chưa được dọn dẹp vệ sinh theo tiêu chuẩn bàn giao.',
  },
  {
    key: 'disposal_milestone',
    label: 'Mốc xử lý tài sản quá hạn',
    value: 'Ngày thứ 20 quá hạn',
    reference: 'D32/D45 · Quyền truy cập khoá ngay',
    description: 'Nhắc nhở ngày 10–14; ngày 20 khoá vĩnh viễn và xử lý tài sản. Không ân hạn quyền truy cập.',
  },
];

export const GUIDELINE_SECTIONS = [
  {
    title: 'Nội dung hướng dẫn nghiệp vụ',
    category: 'GUIDELINE',
    tone: 'warn',
    badge: 'Chỉ hiển thị, không thay đổi xử lý tự động',
    notice: 'Các trường dưới đây chỉ lưu nội dung mô tả hoặc điều khoản hướng dẫn cho khách hàng và nhân viên. Thay đổi văn bản tại đây KHÔNG làm thay đổi công thức tính toán hoặc thời hạn xử lý tự động của máy chủ.',
    fields: [
      { key: 'refund', label: 'Hoàn cọc trong vòng', type: 'RETURN', hint: 'Hướng dẫn thời gian hoàn trả tiền cọc cho khách hàng.' },
      { key: 'inspection', label: 'Thời gian kiểm tra sau khi trả kho', type: 'RETURN', hint: 'Hướng dẫn SLA kiểm tra tình trạng kho của nhân viên.' },
      { key: 'renewals', label: 'Số lần gia hạn tối đa', type: 'RENEWAL', hint: 'Nội dung điều khoản hiển thị cho khách; máy chủ chưa áp đặt giới hạn tự động.' },
      { key: 'cancel', label: 'Phí huỷ trước ngày nhận kho', type: 'CANCELLATION', hint: 'Nội dung điều khoản hiển thị cho khách; quy trình huỷ tuân theo chính sách hoàn cọc.' },
      { key: 'grace', label: 'Mốc xử lý quá hạn', type: 'OVERDUE', hint: 'Ghi chú điều khoản: nhắc nhở ngày 10–14, lập biên bản di dời tài sản ngày 20 theo D32.' },
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
  return policies.filter(p => {
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

function numericValue(p, field, text) {
  const raw = text.replace(/tháng tiền thuê|(?:\/\s*)?ngày|[đ₫%]/g, '').trim();
  if (!/^[\d.,\s]+$/.test(raw)) throw new Error(`${field.label}: nhập một mức cụ thể, ví dụ 500.000đ hoặc 1 tháng tiền thuê.`);
  const isPercent = p?.calculationType === 'PERCENTAGE' || p?.calculationType === 'DEPOSIT_PERCENT_PER_DAY';
  const n = (field.key === 'deposit' && /tháng/.test(text) || isPercent) ? Number(raw.replace(',', '.')) : parseMoney(raw);
  if (!Number.isFinite(n) || n < 0 || isPercent && n > 100) throw new Error(`${field.label}: giá trị không hợp lệ.`);
  if (field.key === 'relet' && (!Number.isInteger(n) || n > 60)) throw new Error(`${field.label}: nhập số ngày nguyên từ 0 đến 60.`);
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
      else values.value = numericValue(p, numeric, drafts[numeric.key]);
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
    const calculationType = p?.calculationType || (numeric ? 'FIXED' : 'RULE');
    if (!p && numeric && values.value === undefined) {
      // Do not invent a fee/reminder/deposit amount just to save a text instruction.
      throw new Error(`Vui lòng thiết lập ${numeric.label.toLowerCase()} trước khi lưu quy định cùng nhóm.`);
    }
    const body = p ? replacementOf(p, values, day) : { policyName: fields[0].label, policyType: type, calculationType, value: null, minValue: null, maxValue: null, ruleDescription: values.ruleDescription || fields.map(f => [f.label, String(drafts[f.key] ?? '').trim()]).filter(([, v]) => v).map(([label, v]) => `${label}: ${v}`).join('\n'), facilityId: null, unitTypeId: null, effectiveFrom: day, effectiveTo: null, ...values };
    return { p, body, keys: edited.map(f => f.key) };
  });
}
