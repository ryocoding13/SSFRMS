# Nhật ký tiến độ (progress.md)

> Mỗi phiên làm việc với AI thêm MỘT mục ở đầu danh sách (mới nhất trên cùng).
> Ghi đủ để phiên sau tiếp tục ngay mà không phải hỏi lại. Không xoá mục cũ.

## Mẫu một mục

```
## Phiên N — YYYY-MM-DD — <người / công cụ AI>
- Tính năng: Fxx — <tên>
- Đã xong: …
- Đang dở: …
- Kiểm chứng: <lệnh đã chạy> → <kết quả>
- Bị chặn / rủi ro: …
- Phiên sau nên: …
```

---

## Phiên 2 — 2026-10-01 — Giao diện theo Figma 30/09, khu Nhân viên / Quản lý cơ sở

- Tính năng: F30 (mới), F21, F11–F20 (phía giao diện). Nhánh `feature/figma-3009-staff-manager`.
- Đã xong (chỉ frontend, không sửa backend):
  - Figma: ô trống màu xanh, bỏ ảnh sơ đồ mặt bằng khỏi thư viện ảnh, sửa nút đen, xếp frame theo vai trò và thứ tự luồng.
  - Khách hàng: sơ đồ ô kho trong chi tiết cơ sở (D13), tìm kho trên bản đồ + nút Danh sách / Bản đồ (D12),
    bỏ footer mọi trang, một dòng thông báo khi chưa có kho.
  - Khu Nhân viên `#/staff` (S01–S05, S09) và Quản lý cơ sở `#/manager` (M01–M07) trong `src/ops/`, lưới 3×3 (D14).
  - Hợp đồng `/api/ops/*` + dự phòng lưu trình duyệt (D15); việc backend còn thiếu: `BACKEND-TODO.md`.
- Kiểm chứng: `npm test` → 38/38 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK;
  chạy tay luồng khách / nhân viên / quản lý trên mock (`MOCK_OPS=1`). **Chưa chạy với backend .NET thật.**
- Bị chặn / rủi ro:
  - Backend chưa có `/api/ops/*`, tài khoản seed MANAGER, lọc theo cơ sở (UserFacility) → F11–F21 để `blocked`.
  - D13 cần nhóm chốt có cho khách giữ đúng ô đã chọn không.
  - Luồng nghiệp vụ D02 không đổi. F29 chưa kiểm lại, giữ nguyên trạng thái.
- Phiên sau nên: người phụ trách backend làm `BACKEND-TODO.md` mục A, chạy `npm run dev` với backend thật
  và đi hết luồng đặt → đối soát → phân bổ → xác minh → bàn giao; pass thì đổi F11–F21 sang `passing`.

## Phiên 1 — 2026-09-26 — Rà mâu thuẫn Figma

- Tính năng: (không có — rà soát thiết kế trước khi chốt "Figma là chuẩn")
- Đã xong: đọc chữ và liên kết prototype của toàn bộ màn trong Figma "SafeSpace - Modern UI"; sửa trực tiếp
  trong Figma các chỗ mâu thuẫn về luồng / trạng thái / nhân vật / liên kết (bỏ qua ảnh, giá, số liệu).
  Danh sách đầy đủ: `docs/figma-review-2026-09-26.md`. Chốt D02 theo Figma, thêm D11.
- Kiểm chứng: quét lại toàn file Figma không còn "SafeSpace Quận 7", "Trần Minh", "Lê Anh", gia hạn B-015 "đã gửi";
  chụp lại C01, C07, C11, C14, M03, M07, A04 để kiểm tra bố cục.
- Bị chặn / rủi ro: code giao diện còn cho gia hạn / trả kho khi hợp đồng chưa bàn giao và câu tiền cọc cũ → F29.
  SRS mục A03 cần sửa cho khớp D02.
- Phiên sau nên: làm F29 (nhỏ, chỉ giao diện) hoặc F28.

## Phiên 0 — 2026-09-26 — Thiết lập harness

- Tính năng: (không có — phiên khởi tạo, chưa viết code tính năng)
- Căn cứ: hướng dẫn Harness Engineering tại https://learnharness.org/#dinh-nghia và https://skills.learnharness.org/
  (thầy Hoàng Giáo Làng giới thiệu tại Build With AI #3: From Working Code To Reliable Product).
- Đã xong: thêm `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `DECISIONS.md`,
  `init.sh`, `init.ps1`, `docs/` (architecture, business-rules, conventions, verification, templates/sprint-contract).
- Hiện trạng code (commit `5177812`, main):
  - Giao diện khách hàng C01–C14 và quản trị A01–A04 đã có, gọi API thật cho các luồng backend đã hỗ trợ.
  - Backend .NET: auth, facilities/rates/availability, reservations, contracts, payments, renewals,
    handover confirm, tickets, toàn bộ `/api/admin/*`.
  - Chưa có: giao diện Nhân viên / Quản lý cơ sở / Quản lý vận hành KD (UC07–UC23).
- Kiểm chứng:
  - `npm test` → 28/28 pass
  - `npm run test:render` → 38 route PASS
  - `npm run build` → OK
  - `dotnet build` → **chưa chạy** (máy thiết lập không có .NET). Phiên sau chạy `./init.sh` trên máy có .NET để xác nhận.
- Bị chặn / rủi ro:
  - Backend không có test tự động → kiểm chứng backend yếu (F28).
  - Luồng thanh toán lúc đặt (Figma) lệch SRS A03 → đã chốt theo Figma ở Phiên 1 (D02).
  - `README.md` gốc chưa khớp code: ghi .NET 9 (project là `net10.0`); mục cấu trúc frontend còn tên cũ
    (`services/`, `customer.css`); nhắc tag "BẢN DEMO UI" không còn trong code.
- Phiên sau nên: chạy `./init.sh` đầy đủ trên máy có .NET; sau đó làm F28 (test backend) hoặc F21
  (khu Nhân viên / Quản lý) tuỳ nhóm ưu tiên.
