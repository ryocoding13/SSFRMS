## Mục tiêu

<!-- Một mục tiêu rõ ràng cho PR này (AGENTS.md quy tắc 1). -->

## Thay đổi chính

- (liệt kê thay đổi)

## Quyết định áp dụng

<!-- Mã trong DECISIONS.md (vd D41, D44). Quyết định mới phải ghi vào DECISIONS.md trước khi code. -->

## Tính năng liên quan

<!-- ID trong feature_list.json và trạng thái hiện tại. Chỉ chuyển "passing" khi có bằng chứng và người phụ trách xác nhận. -->

## Kiểm tra đã chạy

- [ ] `npm run check:structure`
- [ ] `npm test`
- [ ] `npm run test:business`
- [ ] `npm run test:render`
- [ ] `npm run build`
- [ ] `dotnet test` (Backend)
- [ ] SQL Server Integration (CI)

<!-- Ghi rõ phần chưa kiểm chứng được và lý do (thiếu SQL Server, PayOS thật, ...). -->

## Checklist

- [ ] Không sửa migration đã merge; thay đổi schema có migration mới
- [ ] Không xoá / reset dữ liệu DB dùng chung
- [ ] Giao diện dùng "đạt / chưa đạt tiêu chuẩn", không có luồng báo sai lệch (D42)
- [ ] Đã cập nhật `progress.md` (và `DECISIONS.md` nếu có quyết định mới)
- [ ] Màn mới / đổi màn đã đối chiếu Figma
- [ ] Có thành viên khác review trước khi merge
