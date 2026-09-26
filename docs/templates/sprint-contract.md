# Sprint contract: <Fxx> — <tên tính năng>

> Dùng cho tính năng lớn (nhiều file, cả FE và BE). Chép file này thành `docs/sprints/Fxx.md`,
> điền trước khi cho AI code, để AI biết rõ được làm gì và không được làm gì.

## Mục tiêu
<Một câu: người dùng nào làm được gì sau khi xong.>

## Nguồn yêu cầu
- Use case: UCxx (SRS mục 15.x)
- Quy tắc: BRxx, Axx
- Màn Figma: <mã màn / link node>

## Phạm vi (được sửa)
- Backend: <file / endpoint>
- Frontend: <page / component / route>
- Tài liệu: `BE-CONTRACT.md`, `*-FLOW-COVERAGE.md`

## Ngoài phạm vi (KHÔNG làm)
- <việc dễ bị "tiện tay" làm luôn>

## Tiêu chí hoàn thành
- [ ] <hành vi đo được, vd. POST /api/... trả 201 và bản ghi có trạng thái X>
- [ ] <kịch bản lỗi, vd. trùng lịch → 400 với thông báo "…">
- [ ] `./init.sh` pass
- [ ] Đã cập nhật `feature_list.json`, `progress.md`

## Chấm điểm (người kiểm điền)
| Tiêu chí | A | B | C | D |
|---|---|---|---|---|
| Đúng nghiệp vụ | Đúng cả luồng chính và lỗi | Đúng luồng chính | Đúng một phần | Sai |
| Test | Có test luồng chính + lỗi | Chỉ luồng chính | Chỉ khung | Không có |
| Khớp Figma | Khớp | Lệch nhỏ | Lệch nhiều | Không theo |
