# Quyết định thiết kế (DECISIONS.md)

> Ghi lại vì sao chọn A thay vì B, để phiên AI sau không tự đảo ngược.
> Muốn đổi một quyết định → thêm quyết định mới ghi "Thay thế Dxx", không sửa mục cũ.
> Trạng thái: **Đã chốt** · **Cần nhóm chốt** · **Đã thay thế**.

## D01 — Figma là chuẩn cho giao diện khách hàng — Đã chốt
- Giao diện code bám file Figma "SafeSpace - Modern UI". Backend được sửa cho khớp giao diện, không ngược lại.
- Figma đã được rà và sửa hết mâu thuẫn về luồng ngày 26/09/2026 (D11, `docs/figma-review-2026-09-26.md`).
- Những gì backend cần bổ sung: `BE-CONTRACT.md`.

## D02 — Thời điểm thanh toán khi đặt chỗ — Đã chốt theo Figma (26/09/2026)
- Theo D01: khách chuyển khoản QR ngay lúc đặt (C04), bấm "Tôi đã chuyển khoản" → đơn "Chờ đối soát";
  nhân viên đối soát (S09) → quản lý phân bổ kho (M05) → nhận kho theo lịch (S02, S03). Hết giờ giữ chỗ → đơn tự huỷ (C04b).
- SRS v2.0 mục A03 (thanh toán sau hợp đồng DRAFT) khác luồng này → nhóm cần sửa SRS cho khớp.
- Backend còn thiếu API báo đã chuyển khoản và đối soát (F03).

## D03 — Khách đăng ký dùng email làm username — Đã chốt
- Backend chỉ đăng nhập bằng `username`; Figma không có ô username.
- Khi khách đăng ký trên giao diện, `username = email`. Tài khoản seed vẫn dùng username (`customer01`…).

## D04 — Luồng backend chưa hỗ trợ thì lưu trong trình duyệt theo tài khoản — Đã chốt
- Áp dụng: báo đã chuyển khoản, trả kho, thông báo, đổi tên, ảnh đính kèm hỗ trợ.
- Khi backend có API: chỉ sửa nhánh `ApiProvider` trong `src/state/store.jsx`; không rải lời gọi API vào page.

## D05 — Tên vai trò lấy từ backend, không cứng trong giao diện — Đã chốt
- Backend có `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`; SRS/Figma có thêm Quản lý vận hành KD.
- Giao diện quản trị đọc `GET /api/admin/roles`, nên thêm vai trò ở backend (F24) là giao diện tự hiện.

## D06 — Ảnh cơ sở là file tĩnh của nhóm — Đã chốt
- Dùng ảnh thật của nhóm trong `public/images/` (mặt tiền, bên trong, sơ đồ), không lấy ảnh từ Figma.
- Cách gán ảnh cho cơ sở nằm ở `src/config/media.js`; khi có API ảnh chỉ đổi file này.

## D07 — Giao diện trông như sản phẩm chính thức — Đã chốt
- Không hiện chữ "demo", "bản thử", "dữ liệu mẫu", "sample" trên giao diện, kể cả khi chạy không có backend.

## D08 — Quy trình Git — Đã chốt
- Mỗi việc một nhánh `feature/<tên>` → Pull Request vào `main`. Giao diện khách hàng dùng `feature/customer-ui-figma`.
- Commit theo tính năng: `feat(F05): …`, `fix(F02): …`, `docs: …`.

## D09 — Tiền cọc và số tiền chuyển lúc đặt — Đã chốt (phía giao diện)
- Cọc = 1 tháng tiền thuê. Số tiền chuyển lúc đặt = tiền thuê cả kỳ + cọc. Gói thuê 1 / 3 / 6 tháng.
- Đi cùng luồng thanh toán lúc đặt (D02).

## D10 — Thời gian từ backend coi là UTC — Đã chốt
- Backend trả DateTime không kèm múi giờ; giao diện hiểu là UTC. Nên cấu hình JSON backend trả kèm `Z`.

## D11 — Figma đã rà mâu thuẫn, mọi màn dùng chung một mốc dữ liệu — Đã chốt (26/09/2026)
- Mốc chung 14/09/2026: A-102 chờ nhận kho 20/09; B-015 sắp hết hạn, chưa gửi gia hạn; HT-0082 thuộc B-015;
  một tên cơ sở "SafeSpace Nguyễn Lương Bằng"; một nhân viên Trần Văn Long. Chi tiết: `docs/figma-review-2026-09-26.md`.
- Quy tắc rút ra từ Figma: hợp đồng **chưa bàn giao** chỉ cho "Xem lịch nhận kho" / "Đổi lịch nhận kho" / hỗ trợ;
  gia hạn và trả kho chỉ mở sau khi nhận kho. Gia hạn gửi chậm nhất 7 ngày trước ngày kết thúc; tiền cọc chuyển sang kỳ mới.
- Ảnh, giá, số liệu trong Figma chỉ là minh hoạ — dữ liệu thật lấy từ backend.
