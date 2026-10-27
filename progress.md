## Phiên 2026-10-26 — Hoàn thành Task T17, T15, T09 (Backend Logic Fixes) & Migration Schema mới

- **Mục tiêu:** Thực hiện 3 tasks logic nghiệp vụ theo kế hoạch 26–31/10 (D31/D32):
  1. **Task T17 (Phân quyền cơ sở):** Chặn thao tác chéo cơ sở ở các route cũ (StaffService.SubmitReturnInspectionAsync, ManagerService.AssignStaffAsync, ApproveRenewalAsync, RejectRenewalAsync, AddContractReminderAsync). Phân quyền chỉ dựa trên vai trò (FACILITY_STAFF/FACILITY_MANAGER) + user_facilities.
  2. **Task T15 (Mã ra vào):** Xóa bỏ hoàn toàn API thu hồi mã thủ công (POST /api/staff/credentials/{id}/revoke), bỏ IStaffService.RevokeCredentialAsync. Điều chỉnh ReissueCredentialAsync khi cấp lại mã QR không đổi PIN và ngược lại. Mã tự vô hiệu hóa khi hợp đồng kết thúc hoặc chuyển sang RETURN_PENDING.
  3. **Task T09 (Phí quá hạn):** Sửa công thức tính phí quá hạn trong RefundPolicy.OverdueFeeFor và FacilityOpsService.ConfirmRefundAsync: trừ 5% cọc ban đầu cho mỗi ngày trễ, cap tối đa 100% cọc ban đầu (contract.DepositAmount), dừng tính tại thời điểm gửi trả kho thành công (inspection.CreatedAt). Thêm kiểu tính mới DEPOSIT_PERCENT_PER_DAY cho chính sách OVERDUE tại B02 / DbSeeder.
- **Migration Schema mới:**
  - StorageConfigurations.cs: Tăng CalculationType.HasMaxLength(30), mở rộng check constraint CK_policies_calculation_type cho phép giá trị 'DEPOSIT_PERCENT_PER_DAY'.
  - Scaffold migration mới 20261026093424_AddDepositPercentPerDayCalculationType theo đúng quy tắc AGENTS.md (Rule 7: không sửa migration cũ).
  - Cập nhật test SqlServerMigrationAndReadinessTests kiểm tra đúng 7 migrations và model snapshot khớp 100%.
- **Kiểm chứng:**
  - dotnet test StorageProject.slnx --nologo: **89/89 unit tests PASS**, **9/9 SQL Server integration tests PASS** (chạy trên SQL Server thật).
  - npm run check:structure trong Frontend: PASS.
  - dotnet ef migrations has-pending-model-changes: PASS (0 pending changes).
- **Tuân thủ AGENTS.md:** AI không thực hiện commit, push, PR hay merge. Người dùng tự kiểm tra diff và commit.

## 2026-10-26 ΓÇö T10 / T15 FE: tiß╗ün cß╗ìc theo D32 (Thß║»ng)

- Nß╗ün `origin/main` d57c71b8c2ad69367c90877902b5818781b3222d. L├ám tr├¬n worktree ri├¬ng; kh├┤ng ─æß╗Ñng thay ─æß╗òi c┼⌐, kh├┤ng commit/push/PR/merge. F39/F41 kh├┤ng n├óng passing.
- C11: ß║⌐n khoß║ún ph├¡ trß║ú kho chß╗¥ thu; bß╗Å popup trß║ú ph├¡ tß║íi quß║ºy. Mapper kh├┤ng cho mß╗ƒ QR ph├¡ trß║ú kho; service API/local v├á reducer chß║╖n thao t├íc c┼⌐. Gia hß║ín giß╗» QR/thu tß║íi quß║ºy hiß╗çn c├│; kh├┤ng sß╗¡a logic gia hß║ín BE.
- S09: bß╗Å route fees, queue thu ph├¡ v├á badge t╞░╞íng ß╗⌐ng; kh├┤ng xo├í lß╗ïch sß╗¡ giao dß╗ïch ─æ├ú c├│. Gß╗í adapter CONFIRM_FEE_COLLECTION v├á REVOKE_CREDENTIAL; giß╗» cß║Ñp lß║íi m├ú. Endpoint thu hß╗ôi m├ú BE vß║½n cß║ºn Tiß║┐n xß╗¡ l├╜.
- S04: vß╗ç sinh chß╗ë ─æß╗ìc, tß╗▒ t├¡nh 10% cß╗ìc khi chß╗ìn cß║ºn vß╗ç sinh; kiß╗âm tiß╗ün kh├┤ng ├óm v├á l├╜ do, tß╗òng ─æß╗ü xuß║Ñt kh├┤ng v╞░ß╗út cß╗ìc. Kh├┤ng hiß╗çn c├┤ng nß╗ú hoß║╖c tß╗▒ suy diß╗àn tiß╗ün ho├án ch├¡nh thß╗⌐c. Payload ph├¡ ─æ├ú gß╗¡i nh╞░ng BE T05 vß║½n ch╞░a l╞░u ─æß║ºy ─æß╗º.
- M07: bß╗Å ╞░ß╗¢c t├¡nh tiß╗ün ho├án dß╗▒ ph├▓ng trong API v├á chß╗» thu nß╗ú v╞░ß╗út cß╗ìc; chuyß╗ân ng╞░ß╗¥i d├╣ng tß╗¢i m├án ho├án cß╗ìc ri├¬ng. Kho├í chß╗æt tr├¬n m├íy chß╗º c┼⌐; mß╗ƒ sau khi board trß║ú `returnPolicyVersion: "D32"` (hß╗úp ─æß╗ông t├¡ch hß╗úp bß╗ò sung, xem BACKEND-TODO). Backend phß║úi ho├án th├ánh T05ΓÇôT09 tr╞░ß╗¢c khi bß║¡t, kh├┤ng chß╗ë th├¬m marker.
- Demo reducer: khß║Ñu trß╗½ giß╗¢i hß║ín cß╗ìc, bß╗Å legacy unpaid khß╗Åi t├¡nh ph├¡ trß║ú kho; chß╗æt ghi PENDING, giß╗» MAINTENANCE khi vß╗ç sinh/ch╞░a sß║╡n s├áng. Demo Ops v├á workflow ho├án cß╗ìc vß║½n l├á hai kho m├┤ phß╗Ång ri├¬ng, ch╞░a phß║úi luß╗ông li├¬n th├┤ng BE.
- Sß╗¡a lß╗ùi mapper REFUND PENDING bß╗ï hiß╗çn ─æ├ú ho├án: chß╗ë PAID ΓåÆ ─É├ú ho├án. Kh├┤ng sß╗¡a sß╗æ/trß║íng th├íi BE trß║ú ─æß╗â giß║ú ─æ├ú tu├ón thß╗º D32.
- Kiß╗âm chß╗⌐ng Node 24.22.1: `npm test` 86/86; `test:business` 9/9; `test:workflows` 11/11; `test:render` 115 route + assertion D32; `check:structure`, `build`, `bash init.sh --fe-only`, `git diff --check` PASS. Build c├▓n cß║únh b├ío chunk >500 kB hiß╗çn c├│.
- Th├¬m script tr├¼nh duyß╗çt `node scripts/check-return-policy.mjs` cho C11/S09f/S04/M07. **Ch╞░a chß║íy ─æ╞░ß╗úc**: thiß║┐u Chromium, `npx playwright install chromium` tß║úi vß╗ü file lß╗ùi. Kh├┤ng coi SSR l├á browser pass. Ch╞░a kiß╗âm desktop/mobile bß║▒ng mß║»t, SQL Server, PayOS hoß║╖c API thß║¡t; kh├┤ng chß║íy BE v├¼ bß║ún v├í kh├┤ng sß╗¡a BE.
- Ngo├ái g├│i: ß║únh trß║ú kho/t├ái khoß║ún ho├án (T08), ─æß╗ông ├╜ ch├¡nh s├ích (T20), sß╗▒ cß╗æ/khß║»c phß╗Ñc, t├¡nh ph├¡ qu├í hß║ín BE v├á t├¡ch hß╗úp ho├án cß╗ìc. Cß║ºn owner review v├á kiß╗âm browser/API tr╞░ß╗¢c merge.

## 2026-10-25 ΓÇö F09 bß╗ò sung ─æ─âng nhß║¡p bß║▒ng email, giß╗» t├¬n ─æ─âng nhß║¡p c┼⌐

- Nß╗ün `main` e43c1f3b190b883c7fbc5d73a34be8de6a4c17ca; y├¬u cß║ºu b├án giao ZIP ─æß╗â th├ánh vi├¬n tß╗▒ kiß╗âm tra v├á push tr├¬n nh├ính ri├¬ng.
- `AuthService.LoginAsync`: bß╗Å khoß║úng trß║»ng ngo├ái ─æß╗ïnh danh, t├¼m username hoß║╖c email kh├┤ng ph├ón biß╗çt hoa/th╞░ß╗¥ng cß╗ºa email; nß║┐u nhiß╗üu t├ái khoß║ún c├╣ng khß╗¢p th├¼ trß║ú lß╗ùi chung, kh├┤ng chß╗ìn ng╞░ß╗¥i ─æß║ºu ti├¬n. Giß╗» BCrypt, trß║íng th├íi ACTIVE, role JWT, lß╗ïch sß╗¡ ─æ─âng nhß║¡p v├á HTTP hiß╗çn c├│; kh├┤ng cß║»t khoß║úng trß║»ng cß╗ºa mß║¡t khß║⌐u.
- Th├¬m `StorageProject.Tests/EmailLoginTests.cs`: 25 ca vß╗ü username/email, khoß║úng trß║»ng, email hoa/th╞░ß╗¥ng, sai/rß╗ùng th├┤ng tin, t├ái khoß║ún kho├í/ngß╗½ng hoß║ít ─æß╗Öng, ─æß╗ïnh danh tr├╣ng, mß║¡t khß║⌐u c├│ khoß║úng trß║»ng v├á HTTP/JWT ─æß╗ìc ─æ├║ng hß╗ô s╞í cß╗ºa kh├ích/staff. D├╣ng fixture SQLite ri├¬ng, kh├┤ng chß║ím dß╗» liß╗çu nh├│m.
- Bß╗ò sung D31; cß║¡p nhß║¡t ─æ├║ng c├íc d├▓ng ─æ─âng nhß║¡p trong BE-CONTRACT.md/BACKEND-TODO.md. Giß╗» to├án bß╗Ö quy ─æß╗ïnh AI/Git v├á ghi ch├⌐p Figma; kh├┤ng ─æß╗òi feature_list.json hoß║╖c n├óng trß║íng th├íi t├¡nh n─âng.
- Kiß╗âm chß╗⌐ng Linux, .NET SDK 10.0.100: `dotnet build StorageProject.slnx --no-restore -m:1` PASS, 0 error; `dotnet test StorageProject.Tests/StorageProject.Tests.csproj` (qua lß╗çnh test solution, --no-build --no-restore -m:1) 88/88 PASS, gß╗ôm 25 ca mß╗¢i. HTTP d├╣ng Kestrel + endpoint/service/JWT thß║¡t vß╗¢i SQLite.
- Lß╗çnh test solution c├▓n b├ío 9 test IntegrationTests ─æß║ít, nh╞░ng fixture trß║ú sß╗¢m khi kh├┤ng c├│ SQL Server; kh├┤ng coi ─æ├│ l├á ─æ├ú kiß╗âm SQL Server. Ch╞░a chß║íy SQL Server cß╗ºa nh├│m, tr├¼nh duyß╗çt gß╗ìi backend thß║¡t cß╗ºa nh├│m hoß║╖c kiß╗âm PayOS; task kh├┤ng sß╗¡a c├íc luß╗ông tiß╗ün/QR.
- Cß║únh b├ío dependency NU1902/NU1903 v├á nullable Board.cs c├│ tr├¬n c├íc phß║ºn kh├┤ng ─æß╗òi; kh├┤ng n├óng package hay sß╗¡a ngo├ái phß║ím vi. Kh├┤ng sß╗¡a appsettings, schema/migration, endpoint hoß║╖c FE source.
- B├án giao bß║ún v├í c├│ kiß╗âm tra tr╞░ß╗¢c khi ├íp dß╗Ñng ─æß╗â giß╗» nß╗Öi dung file hiß╗çn tß║íi; th├ánh vi├¬n tß╗▒ review, kiß╗âm SQL Server, commit/push/PR/merge. AI kh├┤ng thß╗▒c hiß╗çn c├íc thao t├íc Git xuß║Ñt bß║ún.
## 2026-10-26 ΓÇö Ghi D32 v├á cß║¡p nhß║¡t t├ái liß╗çu BE theo ch├¡nh s├ích mß╗¢i (T01, Thß║»ng)

- Task chß╗ë t├ái liß╗çu; kh├┤ng sß╗¡a code, DB, migration v├á kh├┤ng ─æß╗òi trß║íng th├íi feature.
- `DECISIONS.md`: th├¬m D32 (ng╞░ß╗¥i d├╣ng chß╗æt 26/10): khß║Ñu trß╗½ tß╗æi ─æa bß║▒ng cß╗ìc, kh├┤ng c├┤ng nß╗ú ngo├ái cß╗ìc; qu├í hß║ín 5% cß╗ìc ban ─æß║ºu/ng├áy, tß╗æi ─æa 100%, ng├áy 20 xß╗¡ l├╜ ─æß╗ô; giß╗» ph├¡ huß╗╖ 10% cß╗ìc (D27); ho├án v├áo t├ái khoß║ún ch├¡nh chß╗º, hai trß║íng th├íi Chß╗¥ ho├án / ─É├ú ho├án; sß╗▒ cß╗æ c╞í sß╗ƒ ─æß╗òi ├┤ hoß║╖c ho├án th├íng ─æang thu├¬ + th├íng ch╞░a d├╣ng + 100% cß╗ìc; gia hß║ín chß╗ë ─æß╗òi EndDate khi thu ─æß╗º; phi├¬n bß║ún ch├¡nh s├ích v├á bß║▒ng chß╗⌐ng ─æß╗ông ├╜; kh├┤ng thu hß╗ôi QR/PIN thß╗º c├┤ng; giß╗» hß╗ù trß╗ú khi ch╞░a c├│ hß╗úp ─æß╗ông; ph├ón quyß╗ün chß╗ë theo vai tr├▓. ├üp dß╗Ñng cho mß╗ìi hß╗úp ─æß╗ông. Ghi r├╡ d├▓ng n├áo cß╗ºa D27/D28/D30 bß╗ï thay; kh├┤ng xo├í lß╗ïch sß╗¡.
- `BACKEND-TODO.md`: th├¬m mß╗Ñc "D32" (T02ΓÇôT20, ng╞░ß╗¥i l├ám, mß╗⌐c ╞░u ti├¬n, endpoint); ─æ├ính dß║Ñu c├íc d├▓ng c┼⌐ bß╗ï D31 thay (M03, M07, QR, D27, ph├¡ ph├ít sinh v├á c├┤ng nß╗ú).
- `BE-CONTRACT.md`: th├¬m mß╗Ñc "─Éß╗ông bß╗Ö 26/10 ΓÇö D31" liß╗çt k├¬ thay ─æß╗òi hß╗úp ─æß╗ông API.
- Kiß╗âm chß╗⌐ng: ─æß╗ìc lß║íi diff, kiß╗âm bß║úng Markdown kh├┤ng vß╗í cß╗Öt. Kh├┤ng cß║ºn build ß╗⌐ng dß╗Ñng (task t├ái liß╗çu).

## 2026-10-25 ΓÇö Gß╗Öp main v├áo nh├ính FE v├á bß╗ò sung ghi ch├⌐p pre-flight

- Gß╗Öp `main` 2f2f933 (PR #41 CI/CD, PR #43 pre-flight) v├áo nh├ính `feature/figma-approved-fe-completion`.
- `feature_list.json`: giß╗» cß║ú CI01ΓÇôCI08 tß╗½ main v├á F41 cß╗ºa nh├ính FE.
- `DECISIONS.md`: ─æß╗òi mß╗Ñc "FE c├íc m├án ─æ├ú duyß╗çt" tß╗½ D29 th├ánh D30 v├¼ D29 ─æ├ú d├╣ng cho CI/CD; th├¬m mß╗Ñc PROCESS-2026-10-25 (pre-flight) m├á PR #43 ch╞░a k├¿m.
- PR #43 chß╗ë ─æ╞░a khß╗æi pre-flight v├áo AGENTS.md / CLAUDE.md; phß║ºn DECISIONS.md / progress.md cß╗ºa bß║ún v├í pre-flight dß╗▒a tr├¬n nh├ính FE n├¬n ─æ╞░ß╗úc ─æ╞░a v├áo c├╣ng lß║ºn gß╗Öp n├áy. Kh├┤ng ─æß╗òi nß╗Öi dung AGENTS.md / CLAUDE.md.
- Kiß╗âm chß╗⌐ng: check:structure, test, test:business, test:workflows, test:render, build tr├¬n bß║ún gß╗Öp (xem phß║ºn b├án giao). Kh├┤ng chß║íy .NET / SQL Server.

## 2026-10-25 ΓÇö FE bß╗ò sung theo c├íc m├án ─æ├ú duyß╗çt

- Base main c5aa79a, nh├ính local feature/figma-approved-fe-completion; kh├┤ng commit/push/PR.
- Bß╗ò sung auth, kh├ích h├áng, staff, manager v├á operations; thß║╗ ho├án tiß╗ün theo tß╗½ng kh├ích, ch├¡nh s├ích chi tiß║┐t/chß╗ënh sß╗¡a, ─æß╗æi so├ít, qu├í hß║ín, ho├án cß╗ìc, lß╗ïch sß╗¡, hß╗ù trß╗ú tr╞░ß╗¢c hß╗úp ─æß╗ông, gi├í c╞í sß╗ƒ v├á CSV.
- FE adapter t├ích demo opt-in khß╗Åi API thß║¡t; endpoint thiß║┐u b├ío lß╗ùi. Kh├┤ng sß╗¡a backend/DB/migration. Ch├¡nh s├ích 5% cß╗ìc gß╗æc v├á giß╗¢i hß║ín BE ghi ß╗ƒ D30 (tr╞░ß╗¢c l├á D29)/API-GAPS.
- init FE ─æß║ít, unit81, workflow10, business9; kiß╗âm tra render/build, desktop/mobile v├á thao t├íc demo.
- R├á so├ít v├á gß╗Öp l├¬n main 54abba6 (PR #39): giß║úi xung ─æß╗Öt `CancellationRefundPage` (giß╗» bß╗æ cß╗Ñc thß║╗, d├╣ng chß╗» ch├¡nh s├ích tß╗½ `policy.js`).
  Sß╗¡a: gia hß║ín ─æ├ú thanh to├ín vß║½n hiß╗çn "Chß╗¥ thanh to├ín" (mapper gß╗Öp PAID ΓåÆ APPROVED, nay ─æß╗æi chiß║┐u khoß║ún thu RENEWAL);
  lß╗ïch trß╗½ cß╗ìc, hß╗ô s╞í qu├í hß║ín v├á mß╗æc xß╗¡ l├╜ ─æß╗ô d├╣ng tß╗╖ lß╗ç ch├¡nh s├ích ─æang l╞░u thay v├¼ ghi cß╗⌐ng 5% / 20 ng├áy; hß╗úp ─æß╗ông ─æ├ú kß║┐t th├║c kh├┤ng t├¡nh tiß║┐p khß║Ñu trß╗½;
  bß╗Å chß╗» "npm run dev:demo" / "bß║ún demo" khß╗Åi th├┤ng b├ío lß╗ùi chß║┐ ─æß╗Ö API; CSV kh├┤ng biß║┐n sß╗æ ├óm th├ánh chß╗»; thß║╗ trß║íng th├íi "tß╗½ chß╗æi" m├áu ─æß╗Å, "Chß╗¥ΓÇª" m├áu v├áng.
  Kiß╗âm chß╗⌐ng: structure PASS, test 81/81, business 9/9, workflows 11/11 (th├¬m 1), render 115 route, build PASS; approved-ui 25 route, workflow-actions 10 nh├│m, api-pending, password-reset PASS. B├ío c├ío chi tiß║┐t trong APPROVED-FE-README.md. Ch╞░a chß╗⌐ng minh BE thß║¡t/PayOS/thiß║┐t bß╗ï; cß║ºn owner review, kh├┤ng ─æß╗òi passing.

## 2026-10-25 ΓÇö Sß╗¡a lß╗ùi FE c├íc m├án C11, C14a, S04, S09, M07 (kß║┐ hoß║ích 25ΓÇô31/10, phß║ºn Thß║»ng)

- **Bß║ún gß╗æc:** `main` c5aa79a (─æ├ú gß╗Öp PR #29). Chß╗ë sß╗¡a frontend; kh├┤ng sß╗¡a backend, DB, migration.
- **C14a:** `canCancel` khß╗¢p `ReservationService.CancelReservationAsync` (PENDING_PAYMENT / PENDING_AT_FACILITY / CONFIRMED, bß╗Å PAID);
  ─æ╞ín ─æ├ú thanh to├ín kh├┤ng huß╗╖ ─æ╞░ß╗úc tß╗½ ng├áy bß║»t ─æß║ºu thu├¬; lß╗ùi `cancel-preview` hiß╗çn l├╜ do v├á kho├í n├║t huß╗╖; huß╗╖ mß╗Öt ─æ╞ín kh├┤ng c├▓n ß║⌐n n├║t huß╗╖ ─æ╞ín kh├íc.
- **Ch├¡nh s├ích huß╗╖/ho├án:** gom chß╗» v├á tß╗╖ lß╗ç vß╗ü `src/shared/utils/policy.js` (C14a, M08, reducer) ΓÇö chß╗æt ch├¡nh s├ích mß╗¢i chß╗ë sß╗¡a mß╗Öt file.
- **C11:** n├║t "Thanh to├ín ph├¡ tß║íi quß║ºy" t├ích theo tß╗½ng hß╗úp ─æß╗ông (tr╞░ß╗¢c gß╗Öp ph├¡ nhiß╗üu hß╗úp ─æß╗ông v├áo H─É ─æß║ºu ti├¬n);
  chß║┐ ─æß╗Ö API b├ío r├╡ lß╗▒a chß╗ìn chß╗ë l╞░u tr├¬n thiß║┐t bß╗ï (backend ch╞░a c├│ API); ph├¡ ─æ├ú chß╗ìn "tß║íi quß║ºy" vß║½n trß║ú ─æ╞░ß╗úc qua QR.
- **S04:** bß╗Å ├┤ ph├¡ qu├í hß║ín (BE tß╗▒ t├¡nh khi x├íc nhß║¡n, tr├ính t├¡nh tr├╣ng); th├¬m "Kho cß║ºn vß╗ç sinh" (`cleaningRequired`);
  hiß╗çn tiß╗ün cß╗ìc v├á dß╗▒ kiß║┐n ho├án/c├┤ng nß╗ú; bi├¬n bß║ún ─æ├ú gß╗¡i chß╗ë hiß╗çn ph├¡ m├íy chß╗º trß║ú vß╗ü, b├ío lß╗ùi nß║┐u m├íy chß╗º ch╞░a l╞░u ph├¡.
- **S09:** trß║íng th├íi lß║í kh├┤ng l├ám crash; S09f kh├┤ng crash khi thiß║┐u `items`; "Gß╗ôm" ghi r├╡ l├á ╞░ß╗¢c t├¡nh; th├┤ng b├ío cß╗Ñ thß╗â khi BE ch╞░a c├│ `/api/ops/fees/{id}/confirm`.
- **M07:** hß╗Öp thoß║íi x├íc nhß║¡n trß║ú kho hiß╗çn tiß╗ün cß╗ìc, trß╗½ cß╗ìc, ho├án/c├▓n nß╗ú dß╗▒ kiß║┐n; gß╗¡i k├¿m ghi ch├║; giß╗» hß╗Öp thoß║íi khi l╞░u lß╗ùi;
  m├án kß║┐t quß║ú d├╣ng sß╗æ `refund` backend trß║ú vß╗ü thay v├¼ sß╗æ ╞░ß╗¢c t├¡nh ph├¡a giao diß╗çn; chß║╖n crash khi thiß║┐u `reminders`.
- **Seed:** ─æ╞ín/hß╗úp ─æß╗ông A-102 (SS-0142) bß║»t ─æß║ºu tß╗½ ng├áy mai ─æß╗â vß║½n c├│ ─æ╞ín huß╗╖ ─æ╞░ß╗úc theo quy tß║»c mß╗¢i (test render C14 cß║ºn n├║t "Huß╗╖ ─æ╞ín").
- **Kiß╗âm chß╗⌐ng (local, kh├┤ng backend):** `check:structure` PASS; `npm test` 81/81; `test:business` 9/9; `test:render` 97 route PASS; `build` PASS;
  Chromium chß║íy tay C11, C14a, S09, luß╗ông S04 c├│ ph├¡ ΓåÆ M07a x├íc nhß║¡n (c├▓n nß╗ú 510.000 ─æ khß╗¢p hai b├¬n).
- **Ch╞░a kiß╗âm chß╗⌐ng:** ch╞░a chß║íy .NET/SQL Server/PayOS thß║¡t. Phß║ºn c├▓n chß╗¥ backend ghi ß╗ƒ `BACKEND-TODO.md` mß╗Ñc "Ph├¡ ph├ít sinh khi trß║ú kho v├á c├┤ng nß╗ú" v├á "M08":
  l╞░u ph├¡ S04, `POST /api/payments/{id}/payos`, API chß╗ìn trß║ú tß║íi quß║ºy, `feeCollections` + `/api/ops/fees/{id}/confirm`, `refunds` tr├¬n board, l╞░u ghi ch├║ M07a.

## 2026-10-15 ΓÇö F31: Frontend vß║¡n h├ánh KD, kh├┤ng sß╗¡a backend/database

- Bß║ún gß╗æc: SSFRMS(1).zip mß╗¢i; API: operations-api(3).md; thiß║┐t kß║┐ B01ΓÇôB05 section 436:13803.
- Th├¬m src/business, src/api/business, assets cß╗Ñc bß╗Ö v├á mock frontend opt-in dev:business.
- Chß╗ë nß╗æi role OPERATIONS v├áo router/session hiß╗çn c├│; giß╗» nguy├¬n ─æiß╗üu kiß╗çn c├íc role c┼⌐.
- B02 gom 8 ├┤ th├ánh 5 type/scope ─æß╗â ─æ├║ng API; quy ─æß╗ïnh phß╗Ñ l├á d├▓ng c├│ nh├ún trong ruleDescription;
  409 phß║úi x├íc nhß║¡n tr╞░ß╗¢c khi thay thß║┐. Kh├┤ng sß╗¡a backend ─æß╗â cho nhiß╗üu policy xung ─æß╗Öt c├╣ng tß╗ôn tß║íi.
- Kiß╗âm chß╗⌐ng: npm test 38/38; test:business 8/8; test:render 76 route; build/init FE PASS;
  Chromium 13 nh├│m PASS; 14/14 m├án c├íc role kh├íc giß╗æng tß╗½ng pixel; 4 XLSX mß╗ƒ bß║▒ng openpyxl.
- 77 file source/config backend nguy├¬n byte so ZIP ─æß║ºu v├áo; kh├┤ng sß╗¡a DB, migration, seeder hoß║╖c endpoint.
- Phß║ím vi ng╞░ß╗¥i d├╣ng chß╗ë frontend n├¬n kh├┤ng build .NET, kh├┤ng thß╗¡ SQL Server thß║¡t.
- Xem BUSINESS_FRONTEND_README.md, BUSINESS_FRONTEND_REVIEW.md, BUSINESS-FLOW-COVERAGE.md trong frontend.

# Nhß║¡t k├╜ tiß║┐n ─æß╗Ö (progress.md)

> Mß╗ùi phi├¬n l├ám viß╗çc vß╗¢i AI th├¬m Mß╗ÿT mß╗Ñc ß╗ƒ ─æß║ºu danh s├ích (mß╗¢i nhß║Ñt tr├¬n c├╣ng).
> Ghi ─æß╗º ─æß╗â phi├¬n sau tiß║┐p tß╗Ñc ngay m├á kh├┤ng phß║úi hß╗Åi lß║íi. Kh├┤ng xo├í mß╗Ñc c┼⌐.

## Phi├¬n 2026-10-24 (─Éß╗út 7) ΓÇö R├á So├ít T├¡nh ─Éß╗Öc Lß║¡p Pipeline Khi Thß╗¡ Nghiß╗çm Tr├¬n Repo Clone (SSFRMS-clone)

- **Mß╗Ñc ti├¬u:** R├á so├ít to├án diß╗çn workflow, script v├á cß║Ñu h├¼nh ─æ├│ng g├│i ─æß╗â ─æß║úm bß║úo kiß╗âm thß╗¡ an to├án, ─æß╗Öc lß║¡p tr├¬n repo clone (`https://github.com/ryocoding13/SSFRMS-clone`) m├á kh├┤ng bß╗ï hardcode repo gß╗æc hay r├▓ rß╗ë secrets.
- **Kß║┐t quß║ú r├á so├ít:**
  1. **Kh├┤ng hardcode t├¬n repo:** Mß╗ìi vß╗ï tr├¡ trong `.github/workflows/ci.yml`, `deploy-production.yml` v├á script sinh manifest ─æß╗üu sß╗¡ dß╗Ñng biß║┐n ─æß╗Öng `${{ github.repository }}`. Image tags sß║╜ tß╗▒ ─æß╗Öng ph├ón giß║úi th├ánh `ghcr.io/ryocoding13/ssfrms-clone/{api,web,migrator}:sha-<commit>`.
  2. **Bß║úo vß╗ç m├┤i tr╞░ß╗¥ng CD:** Cß║ú hai cß╗¥ `ENABLE_STAGING_DEPLOY` v├á `ENABLE_PRODUCTION_DEPLOY` ─æß╗üu mß║╖c ─æß╗ïnh vß║»ng mß║╖t trong repo mß╗¢i $\rightarrow$ Staging tß╗▒ ─æß╗Öng chß║íy ß╗ƒ chß║┐ ─æß╗Ö Standby an to├án (job `staging-standby` chß╗ë log th├┤ng b├ío v├á exit 0; kh├┤ng c├│ SSH secrets th├¼ kh├┤ng bao giß╗¥ kß║┐t nß╗æi server).
  3. **Linh hoß║ít kiß╗âm so├ít xuß║Ñt bß║ún package:** Cß║¡p nhß║¡t ─æiß╗üu kiß╗çn job `publish-release` trong `ci.yml`: bß╗ò sung `(vars.ENABLE_RELEASE_PUBLISH != 'false')`. Ng╞░ß╗¥i d├╣ng c├│ thß╗â dß╗à d├áng tß║»t viß╗çc publish l├¬n GHCR tr├¬n repo test chß╗ë bß║▒ng c├ích khai b├ío biß║┐n `ENABLE_RELEASE_PUBLISH=false` trong repo settings.
- **Kiß╗âm chß╗⌐ng:** `npx --yes yaml-lint .github/workflows/*.yml` PASS 100%.
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng thß╗▒c hiß╗çn commit hay push. Thay ─æß╗òi ─æ├ú sß║╡n s├áng tr├¬n working tree.

## Phi├¬n 2026-10-24 (─Éß╗út 6) ΓÇö ─Éß╗ông Bß╗Ö Main PR #29 v├á Giß║úi Quyß║┐t Xung ─Éß╗Öt DECISIONS.md & feature_list.json

- **Mß╗Ñc ti├¬u:** ─Éß╗ông bß╗Ö c├íc thay ─æß╗òi mß╗¢i nhß║Ñt tß╗½ `origin/main` (commit `c5aa79a` - PR #29 cß╗ºa Nhi vß╗ü ─æß╗ông bß╗Ö Figma 23/10 ─æß╗út 2) v├á giß║úi quyß║┐t triß╗çt ─æß╗â xung ─æß╗Öt merge.
- **Xß╗¡ l├╜ xung ─æß╗Öt:**
  1. `DECISIONS.md`: Bß║úo to├án cß║ú hai quyß║┐t ─æß╗ïnh `D28` tß╗½ main (`D28 ΓÇö ─Éß╗ông bß╗Ö Figma 23/10` v├á `D28 ΓÇö Kiß╗âm thß╗¡ giao diß╗çn C12/C12b/C13 bß║▒ng Playwright`), ─æß╗ông thß╗¥i giß╗» nguy├¬n quyß║┐t ─æß╗ïnh `D29 ΓÇö Chiß║┐n l╞░ß╗úc CI/CD, Container ho├í v├á Rollback an to├án (24/10/2026) ΓÇö ─É├ú chß╗æt` v├á quy tr├¼nh `PROCESS-2026-10-24`.
  2. `feature_list.json`: Giß╗» nguy├¬n t├¡nh n─âng `F39` (ch├¡nh s├ích D27), t├¡ch hß╗úp t├¡nh n─âng mß╗¢i `F40` (Figma sync ─æß╗út 2), ─æß╗ông thß╗¥i bß║úo to├án trß╗ìn vß║╣n 8 t├¡nh n─âng `CI01`ΓÇô`CI08`. C├║ ph├íp JSON ─æ╞░ß╗úc validate hß╗úp lß╗ç 100%.
- **Kiß╗âm chß╗⌐ng to├án diß╗çn sau merge:**
  - Frontend: `npm test` 81/81 test PASS; `npm run test:business` 9/9 test PASS; `npm run test:render` 97/97 route PASS; `npm run check:structure` PASS; `npm run build` PASS (0 lß║ºn xuß║Ñt hiß╗çn cß╗ºa `localhost:5151` trong bundle).
  - Backend: `dotnet test StorageProject.slnx` chß║íy th├ánh c├┤ng to├án bß╗Ö test suites vß╗¢i 0 lß╗ùi (bao gß╗ôm cß║ú xUnit unit tests v├á integration tests).
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng thß╗▒c hiß╗çn commit hay push. To├án bß╗Ö merge conflicts ─æ├ú ─æ╞░ß╗úc giß║úi quyß║┐t sß║ích sß║╜ v├á staged sß║╡n s├áng tr├¬n working tree.

## Phi├¬n 2026-10-24 (─Éß╗út 5) ΓÇö Khß║»c Phß╗Ñc Lß╗ùi Globalization Invariant Mode vß╗¢i Chiseled-Extra Images

- **Mß╗Ñc ti├¬u:** Khß║»c phß╗Ñc lß╗ùi `PlatformNotSupportedException: Globalization Invariant Mode is not supported` do `Microsoft.Data.SqlClient` y├¬u cß║ºu th╞░ viß╗çn ICU/globalization khi container `migrator` v├á `api` kß║┐t nß╗æi vß╗¢i SQL Server.
- **Nguy├¬n nh├ón:** Base image `chiseled` tß╗æi giß║ún mß║╖c ─æß╗ïnh thiß║┐u ICU v├á bß║¡t chß║┐ ─æß╗Ö globalization invariant. Th╞░ viß╗çn `Microsoft.Data.SqlClient` kh├┤ng hß╗ù trß╗ú chß║┐ ─æß╗Ö n├áy v├¼ cß║ºn ICU ─æß╗â xß╗¡ l├╜ collation v├á encoding. Tag `chiseled-extra` cß╗ºa Microsoft cung cß║Ñp ─æß║ºy ─æß╗º ICU v├á tzdata cß║ºn thiß║┐t.
- **Khß║»c phß╗Ñc:**
  - Cß║¡p nhß║¡t `deploy/migrator.Dockerfile`:
    - Runtime base image chuyß╗ân sang `mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled-extra AS runtime`.
    - Bß╗ò sung biß║┐n m├┤i tr╞░ß╗¥ng: `ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false`.
    - Bß║úo to├án to├án vß║╣n b╞░ß╗¢c `RUN dotnet restore StorageProject.Api/StorageProject.Api.csproj` ─æ├ú sß╗¡a ß╗ƒ ─æß╗út tr╞░ß╗¢c.
  - Cß║¡p nhß║¡t `StorageProject.Api/Dockerfile`:
    - Runtime base image chuyß╗ân sang `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled-extra AS runtime`.
    - Bß╗ò sung biß║┐n m├┤i tr╞░ß╗¥ng: `ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false`.
- **Kiß╗âm chß╗⌐ng:**
  - X├íc nhß║¡n hai tag `10.0-noble-chiseled-extra` tß╗ôn tß║íi ch├¡nh thß╗⌐c tr├¬n MCR v├á cung cß║Ñp ─æß║ºy ─æß╗º ICU.
  - Giß╗» nguy├¬n c╞í chß║┐ bß║úo mß║¡t non-root (`USER $APP_UID`) v├á k├¡ch th╞░ß╗¢c tß╗æi giß║ún cß╗ºa chiseled.
  - Ghi nhß║¡n ranh giß╗¢i kiß╗âm thß╗¡: Do Docker daemon tr├¬n Windows cß╗Ñc bß╗Ö ─æang tß║»t, kß╗ïch bß║ún stack compose v├á smoke test sß║╜ ─æ╞░ß╗úc x├íc thß╗▒c tß╗▒ ─æß╗Öng tr├¬n GitHub Actions runner trong job `container-build`.
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng thß╗▒c hiß╗çn commit hay push. Thay ─æß╗òi ─æ├ú sß║╡n s├áng tr├¬n working tree cß╗ºa nh├ính `feature/cicd-candidate`.

## Phi├¬n 2026-10-24 (─Éß╗út 4) ΓÇö Sß╗¡a Lß╗ùi NETSDK1004 trong deploy/migrator.Dockerfile

- **Mß╗Ñc ti├¬u:** Khß║»c phß╗Ñc lß╗ùi `NETSDK1004: Assets file 'StorageProject.Api/obj/project.assets.json' not found` khi chß║íy lß╗çnh `dotnet dotnet-ef migrations bundle` trong image `deploy/migrator.Dockerfile`.
- **Nguy├¬n nh├ón:** `migrator.Dockerfile` tr╞░ß╗¢c ─æ├│ chß╗ë chß║íy `dotnet restore StorageProject.Infrastructure/StorageProject.Infrastructure.csproj`. Tuy nhi├¬n, khi tß║ío migration bundle cß║ºn startup project l├á `StorageProject.Api`, dß║½n ─æß║┐n EF Core kh├┤ng t├¼m thß║Ñy file assets cß╗ºa API project.
- **Khß║»c phß╗Ñc:**
  - Sß╗¡a `deploy/migrator.Dockerfile`: Thay `RUN dotnet restore StorageProject.Infrastructure/StorageProject.Infrastructure.csproj` bß║▒ng `RUN dotnet restore StorageProject.Api/StorageProject.Api.csproj`.
  - Viß╗çc restore API project tß╗▒ ─æß╗Öng k├⌐o theo viß╗çc restore to├án bß╗Ö c├íc project phß╗Ñ thuß╗Öc (`StorageProject.Infrastructure` v├á `StorageProject.Core`), sinh ─æß║ºy ─æß╗º `project.assets.json` cho cß║ú 3 project.
- **Kiß╗âm chß╗⌐ng:**
  - `dotnet tool restore`: Kh├┤i phß╗Ñc th├ánh c├┤ng c├┤ng cß╗Ñ `dotnet-ef` v10.0.12.
  - `dotnet restore StorageProject.Api/StorageProject.Api.csproj`: Kh├┤i phß╗Ñc th├ánh c├┤ng `Core`, `Infrastructure`, v├á `Api`.
  - `dotnet dotnet-ef migrations bundle --project StorageProject.Infrastructure --startup-project StorageProject.Api`: Build bundle th├ánh c├┤ng vß╗¢i 0 lß╗ùi (xuß║Ñt ra bundle thß╗▒c thi ─æß╗Öc lß║¡p).
  - Ghi ch├║ m├┤i tr╞░ß╗¥ng: Docker daemon cß╗Ñc bß╗Ö tr├¬n Windows hiß╗çn ─æang tß║»t (`//./pipe/dockerDesktopLinuxEngine` not found), do ─æ├│ b╞░ß╗¢c ─æ├│ng g├│i Docker trß╗▒c tiß║┐p sß║╜ ─æ╞░ß╗úc chß║íy v├á x├íc nhß║¡n tr├¬n GitHub Actions runner trong lß║ºn push tiß║┐p theo.
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng thß╗▒c hiß╗çn commit hay push. Thay ─æß╗òi ─æ├ú sß║╡n s├áng tr├¬n working tree cß╗ºa nh├ính `feature/cicd-candidate`.

## Phi├¬n 2026-10-24 (─Éß╗út 3) ΓÇö Khß║»c Phß╗Ñc X├íc Thß╗▒c Provenance Workflow ID v├á ─Éß╗æi Chiß║┐u To├án Diß╗çn Staging Deployment Receipt

- **Mß╗Ñc ti├¬u:** Xß╗¡ l├╜ triß╗çt ─æß╗â 2 ─æiß╗âm ph├ít hiß╗çn cuß╗æi c├╣ng trong production workflow theo y├¬u cß║ºu review:
  1. **Khß║»c phß╗Ñc lß╗ùi `workflowPath` kh├┤ng ─æ╞░ß╗úc hß╗ù trß╗ú trong `gh run view --json`:**
     - `gh run view` kh├┤ng hß╗ù trß╗ú tr╞░ß╗¥ng `workflowPath` (g├óy lß╗ùi khi gß╗ìi vß╗¢i `run_id` chß╗ë ─æß╗ïnh) v├á viß╗çc so khß╗¢p chuß╗ùi t├¬n workflow dß╗à bß╗ï sai lß╗çch khi ─æß╗òi t├¬n hiß╗ân thß╗ï.
     - Khß║»c phß╗Ñc trong `.github/workflows/deploy-production.yml`:
       - Tra cß╗⌐u ch├¡nh x├íc workflow ID chuß║⌐n cß╗ºa CI qua GitHub API: `gh api repos/${{ github.repository }}/actions/workflows/ci.yml --jq '.id'`.
       - Trong `gh run view`, sß╗¡ dß╗Ñng tr╞░ß╗¥ng JSON chuß║⌐n `workflowDatabaseId` v├á kiß╗âm tra ─æß╗æi chiß║┐u trß╗▒c tiß║┐p `RUN_WORKFLOW_ID == EXPECTED_WORKFLOW_ID`.
       - Nh├ính t├¼m kiß║┐m run th├ánh c├┤ng tß╗▒ ─æß╗Öng (`gh run list`) c┼⌐ng lß╗ìc ch├¡nh x├íc theo `--workflow "${EXPECTED_WORKFLOW_ID}"`.
       - Xuß║Ñt output `run_id=${RUN_ID}` tß╗½ step `fetch_manifest` ─æß╗â c├íc step sau t├íi sß╗¡ dß╗Ñng ch├¡nh x├íc.
  2. **Ho├án thiß╗çn cß║Ñu tr├║c receipt v├á ─æß╗æi chiß║┐u to├án diß╗çn Staging Deployment Receipt vß╗¢i Release Manifest:**
     - Trong `.github/workflows/ci.yml` (`deploy-staging`):
       - Tr├¡ch xuß║Ñt 3 image digests (`.images.api.digest`, `.images.web.digest`, `.images.migrator.digest`) tß╗½ `release-manifest.json`.
       - Tß║ío file `artifacts/staging-deployment-receipt.json` chß╗⌐a ─æß║ºy ─æß╗º: `environment: "staging"`, `commit`, `run_id: "${{ github.run_id }}"`, `host`, `status: "deployed"`, `smoke_status: "passed"`, v├á `images: { api, web, migrator }`.
       - Upload artifact `staging-deployment-receipt` ─æß╗â phß╗Ñc vß╗Ñ ─æß╗æi chiß║┐u khi promote l├¬n production.
     - Trong `.github/workflows/deploy-production.yml` (`Verify Staging Precondition`):
       - Kiß╗âm tra `CI_RUN_ID` (tß╗½ output cß╗ºa `fetch_manifest`): Nß║┐u rß╗ùng hoß║╖c kh├┤ng tß║úi ─æ╞░ß╗úc artifact `staging-deployment-receipt` tß╗½ ─æ├║ng CI run ─æ├│ -> fail-closed ngay lß║¡p tß╗⌐c (chß║╖n promote nß║┐u staging chß╗ë ß╗ƒ chß║┐ ─æß╗Ö Standby hoß║╖c deploy thß║Ñt bß║íi).
       - Thß╗▒c thi ─æoß║ín m├ú Node.js ─æß╗æi chiß║┐u to├án diß╗çn 100% giß╗»a receipt v├á manifest:
         - ─Éß╗æi chiß║┐u commit SHA: `receipt.commit === RELEASE_SHA`.
         - ─Éß╗æi chiß║┐u run ID: `String(receipt.run_id) === String(CI_RUN_ID)`.
         - ─Éß╗æi chiß║┐u environment: `receipt.environment === "staging"`.
         - ─Éß╗æi chiß║┐u trß║íng th├íi triß╗ân khai: `receipt.status === "deployed"`.
         - ─Éß╗æi chiß║┐u kiß╗âm thß╗¡ smoke: `receipt.smoke_status === "passed"`.
         - ─Éß╗æi chiß║┐u 3 image digests (API, Web, Migrator): h├ám tr├¡ch xuß║Ñt hß╗ù trß╗ú cß║ú object `{ digest }` v├á string, ─æß╗æi chiß║┐u khß╗¢p ch├¡nh x├íc tß╗½ng k├╜ tß╗▒ SHA256 vß╗¢i `release-manifest.json`.
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint .github/workflows/*.yml`: PASS 100% to├án bß╗Ö workflows (`ci.yml`, `deploy-production.yml`, `rollback.yml`).
  - Unit test Node.js cho logic ─æß╗æi chiß║┐u receipt Γåö manifest: PASS (ph├ít hiß╗çn v├á chß║╖n ─æ├║ng khi lß╗çch SHA, run ID, environment, status, smoke_status, hoß║╖c image digest).
  - Khuyß║┐n nghß╗ï giß╗» CD ß╗ƒ chß║┐ ─æß╗Ö Standby (`ENABLE_STAGING_DEPLOY: false`), mß╗ƒ PR ─æß╗â chß║íy kiß╗âm thß╗¡ CI thß║¡t tr├¬n GitHub Actions m├á kh├┤ng phß╗Ñ thuß╗Öc v├áo VPS.
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng chß║íy commit hay push. To├án bß╗Ö thay ─æß╗òi nß║▒m sß║╡n tr├¬n working tree cß╗ºa nh├ính `feature/cicd-candidate` ─æß╗â th├ánh vi├¬n nh├│m tß╗▒ review v├á commit.

## Phi├¬n 2026-10-24 (─Éß╗út 2) ΓÇö ─Éß╗ông Bß╗Ö Main Mß╗¢i, Khß║»c Phß╗Ñc Triß╗çt ─Éß╗â CI/CD v├á T├ích Biß╗çt CD Chß╗¥ VPS

- **Mß╗Ñc ti├¬u:** Giß║úi quyß║┐t triß╗çt ─æß╗â c├íc vß║Ñn ─æß╗ü c├▓n lß║íi tß╗½ ─æß╗út kiß╗âm tra candidate v├á gß╗Öp c├íc thay ─æß╗òi mß╗¢i nhß║Ñt tß╗½ `origin/main` (commit `a632cb7` - PR #25 cß╗ºa Ngß╗ìc Mai):
  1. **Xß╗¡ l├╜ xung ─æß╗Öt vß╗¢i main mß╗¢i:**
     - Gß╗Öp commit `a632cb7` tß╗½ `origin/main` v├áo nh├ính `feature/cicd-candidate`.
     - Giß║úi quyß║┐t xung ─æß╗Öt nß╗Öi dung tß║íi `feature_list.json`: Giß╗» nguy├¬n t├¡nh n─âng `F37` mß╗¢i nhß║Ñt (C12/C12b/C13 auth support cß╗ºa Mai), ─æß╗ông thß╗¥i bß║úo to├án trß╗ìn vß║╣n danh s├ích t├¡nh n─âng `CI01`ΓÇô`CI08`. C├║ ph├íp JSON ─æ╞░ß╗úc validate hß╗úp lß╗ç 100%.
     - Chuß║⌐n h├│a sß╗æ hiß╗çu quyß║┐t ─æß╗ïnh tß║íi `DECISIONS.md`: ─Éß╗òi mß╗Ñc CI/CD tß╗½ `D28` th├ánh `D29` ─æß╗â kh├┤ng tr├╣ng vß╗¢i quyß║┐t ─æß╗ïnh `D28` (Playwright C12/C13) vß╗½a ─æ╞░ß╗úc merge tß╗½ `main`.
  2. **R01 (Sß╗¡a dß╗⌐t ─æiß╗âm upload-artifact SHA):**
     - Sß╗¡a lß╗ùi g├╡ nhß║ºm commit SHA `4cec3d8aa04e39d1a68397de0c4cd6fb9dce6ec1` (sß╗æ `6` thay v├¼ `8`) tß║íi cß║ú 4 vß╗ï tr├¡ trong `.github/workflows/ci.yml` (d├▓ng 55, 114, 181, 328) sang commit chuß║⌐n `4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1` (v4.6.1).
  3. **R02 / Smoke Test (Loß║íi bß╗Å localhost:5151 khß╗Åi production bundle):**
     - Cß║Ñu h├¼nh `SafeSpace-Customer-UI/vite.config.js` vß╗¢i `define: { __DEV_API_FALLBACK__: JSON.stringify(isProd ? "" : "http://localhost:5151") }`.
     - Cß║¡p nhß║¡t `src/app/config/api.js` d├╣ng `__DEV_API_FALLBACK__`. Khi build production, chuß╗ùi `localhost:5151` bß╗ï x├│a sß║ích khß╗Åi `dist/assets/index-*.js` (0 lß║ºn xuß║Ñt hiß╗çn), trong khi test Node.js vß║½n giß╗» kß║┐t nß╗æi mock server.
  4. **R03 & R08 (─Éß╗ông bß╗Ö release sang server qua SCP & Verified known_hosts chuß║⌐n OpenSSH):**
     - Trong cß║ú `.github/workflows/ci.yml` (`deploy-staging`) v├á `.github/workflows/deploy-production.yml` (`deploy-production`):
       - Loß║íi bß╗Å ho├án to├án fallback `ssh-keyscan` tß╗▒ ─æß╗Öng tin kh├│a mß║íng (tr├ính rß╗ºi ro tß║Ñn c├┤ng MITM theo h╞░ß╗¢ng dß║½n OpenSSH). Bß║»t buß╗Öc phß║úi cß║Ñu h├¼nh `*_SSH_KNOWN_HOSTS` secret khi k├¡ch hoß║ít deploy thß║¡t; nß║┐u thiß║┐u, workflow fail-closed ngay lß║¡p tß╗⌐c.
       - Bß╗ò sung b╞░ß╗¢c ─æß╗ông bß╗Ö release: Tr╞░ß╗¢c khi gß╗ìi lß╗çnh deploy/promote tß╗½ xa, workflow sß╗¡ dß╗Ñng `scp` chuyß╗ân file `release-manifest.json` ─æ├ú ─æ╞░ß╗úc x├íc minh c├╣ng bß╗Ö kß╗ïch bß║ún triß╗ân khai (`scripts/deploy/*`, `scripts/ci/smoke.sh`, file compose t╞░╞íng ß╗⌐ng) sang th╞░ mß╗Ñc `/opt/safespace` tr├¬n m├íy chß╗º tß╗½ xa, ─æß║úm bß║úo server lu├┤n c├│ ─æ├║ng manifest v├á script phi├¬n bß║ún mß╗¢i nhß║Ñt.
  5. **R06 & Staging Gate (Khß║»c phß╗Ñc lß╗ùi t├¬n workflow, t├ích biß╗çt Staging Standby vs Deploy thß║¡t):**
     - Trong `.github/workflows/deploy-production.yml`, b╞░ß╗¢c kiß╗âm tra `run_id` sß╗¡ dß╗Ñng `gh run view` x├íc thß╗▒c workflow bß║▒ng ─æ╞░ß╗¥ng dß║½n ch├¡nh x├íc `workflowPath == ".github/workflows/ci.yml"` (hoß║╖c t├¬n `CI`), giß║úi quyß║┐t triß╗çt ─æß╗â lß╗ùi tß╗½ chß╗æi run hß╗úp lß╗ç do lß╗çch t├¬n hiß╗ân thß╗ï.
     - T├ích biß╗çt Staging Standby v├á Staging Deploy trong `ci.yml`:
       - Job `staging-standby` chß╗ë chß║íy khi `ENABLE_STAGING_DEPLOY != 'true'`, kh├┤ng gß║»n `environment: staging`, do ─æ├│ **kh├┤ng tß║ío bß║ún ghi GitHub deployment giß║ú mß║ío**.
       - Job `deploy-staging` chß╗ë k├¡ch hoß║ít khi `ENABLE_STAGING_DEPLOY == 'true'`, kß║┐t nß╗æi m├íy chß╗º thß║¡t, chß║íy deploy v├á smoke test, sau ─æ├│ tß║ío v├á upload artifact `staging-deployment-receipt.json`.
     - Trong `deploy-production.yml`, b╞░ß╗¢c `Verify Staging Precondition` kiß╗âm tra cß║ú trß║íng th├íi deployment `state == 'success'` AND x├íc thß╗▒c sß╗▒ tß╗ôn tß║íi cß╗ºa artifact `staging-deployment-receipt.json` tß╗½ CI run. Nß║┐u staging ß╗ƒ chß║┐ ─æß╗Ö Standby (kh├┤ng c├│ receipt), promotion Production lß║¡p tß╗⌐c bß╗ï chß║╖n ─æß╗⌐ng.
  6. **R08 (Fail-Closed tuyß╗çt ─æß╗æi & cß╗¥ sqlcmd -b):**
     - `scripts/deploy/deploy.ps1`: X├│a bß╗Å ho├án to├án nh├ính skip migration khi thiß║┐u Docker (n├⌐m exception dß╗½ng ngay lß║¡p tß╗⌐c); bß║»t buß╗Öc `smoke.ps1` phß║úi tß╗ôn tß║íi v├á chß║íy th├ánh c├┤ng.
     - `scripts/deploy/backup.sh` v├á `backup.ps1`: Th├¬m cß╗¥ `-b` v├áo to├án bß╗Ö lß╗çnh gß╗ìi `sqlcmd`, bß║»t lß╗ùi T-SQL fail-closed.
  7. **R09 (Container Gate khß╗ƒi ─æß╗Öng stack thß║¡t, chß║íy smoke & Step Summary ─æß╗Öng):**
     - Job `container-build` trong `ci.yml` khß╗ƒi ─æß╗Öng stack bß║▒ng `docker compose -f deploy/compose.yml up -d --build`, chß║íy `bash scripts/ci/smoke.sh "http://localhost:8080" 25 2` kiß╗âm tra live stack v├á bundle sß║ích, sau ─æ├│ dß╗ìn dß║╣p bß║▒ng `docker compose down -v`.
     - Chuyß╗ân to├án bß╗Ö step summaries d╞░ß╗¢i `if: always()` sang trß║íng th├íi ─æß╗Öng: `${{ job.status == 'success' && 'Γ£à SUCCESS' || 'Γ¥î FAILED' }}`.
  8. **Ranh giß╗¢i kiß╗âm thß╗¡ v├á chiß║┐n l╞░ß╗úc t├ích biß╗çt CI/CD:**
     - Ghi nhß║¡n r├╡ r├áng ranh giß╗¢i kiß╗âm thß╗¡: C├íc l╞░ß╗út chß║íy integration test tß║íi local kh├┤ng c├│ SQL Server sß║╜ tß╗▒ ─æß╗Öng skip v├á **kh├┤ng ─æ╞░ß╗úc t├¡nh l├á bß║▒ng chß╗⌐ng v╞░ß╗út qua kiß╗âm thß╗¡ SQL Server integration**. Bß║▒ng chß╗⌐ng hß╗úp lß╗ç chß╗ë ─æ╞░ß╗úc x├íc lß║¡p khi chß║íy vß╗¢i `REQUIRE_SQLSERVER=true` tr├¬n service container SQL Server cß╗ºa GitHub Actions runner (hoß║╖c local c├│ SQL Server thß║¡t ─æang chß║íy).
     - Giß╗» to├án bß╗Ö phß║ºn CD ß╗ƒ trß║íng th├íi Standby (`ENABLE_STAGING_DEPLOY: false`, `ENABLE_PRODUCTION_DEPLOY: false`), sß║╡n s├áng ─æß╗â th├ánh vi├¬n mß╗ƒ PR merge CI v├áo `main` tr╞░ß╗¢c m├á kh├┤ng bß╗ï phß╗Ñ thuß╗Öc v├áo viß╗çc cß║Ñp ph├ít VPS.
- **Tu├ón thß╗º AGENTS.md:** AI kh├┤ng thß╗▒c hiß╗çn commit hay push. To├án bß╗Ö m├ú nguß╗ôn ─æ├ú ho├án thiß╗çn v├á kiß╗âm chß╗⌐ng th├ánh c├┤ng tr├¬n working tree cß╗ºa nh├ính `feature/cicd-candidate` ─æß╗â th├ánh vi├¬n nh├│m tß╗▒ xem x├⌐t v├á commit.

## Phi├¬n 2026-10-24 ΓÇö Khß║»c Phß╗Ñc To├án Diß╗çn Review CI/CD (R01ΓÇôR13) Chuß║⌐n Bß╗ï Merge Candidate

- **Mß╗Ñc ti├¬u:** Xß╗¡ l├╜ v├á khß║»c phß╗Ñc to├án bß╗Ö 13 ─æiß╗âm ph├ít hiß╗çn trong `SSFRMS-CICD-MERGE-REVIEW.md` (R01ΓÇôR13) tr├¬n nh├ính t├¡ch hß╗úp `feature/cicd-candidate` ─æß╗â sß║╡n s├áng merge v├áo `main`.
- **Quy tß║»c bß║»t buß╗Öc tu├ón thß╗º:** Tu├ón thß╗º `AGENTS.md` v├á `PROCESS-2026-10-24`: **AI kh├┤ng chß║íy git commit, git push, tß║ío PR hay merge.** To├án bß╗Ö thay ─æß╗òi v├á kß║┐t quß║ú kiß╗âm chß╗⌐ng ─æ╞░ß╗úc giß╗» lß║íi tr├¬n working tree ─æß╗â th├ánh vi├¬n nh├│m tß╗▒ kiß╗âm tra v├á commit/PR thß╗º c├┤ng.
- **Nß╗ün & Xß╗¡ l├╜ Conflict:**
  - Nh├ính l├ám viß╗çc: `feature/cicd-candidate` (nh├ính t├¡ch hß╗úp tß║ío tß╗½ `feature/cicd-ci08` ─æ├ú gß╗Öp c├íc thay ─æß╗òi mß╗¢i nhß║Ñt tß╗½ `origin/main`).
  - Giß║úi quyß║┐t xung ─æß╗Öt tay tß║íi `DECISIONS.md` (giß╗» nguy├¬n quy tr├¼nh `PROCESS-2026-10-24` cß╗ºa main v├á quyß║┐t ─æß╗ïnh `D28` cß╗ºa CI/CD).
  - Giß║úi quyß║┐t xung ─æß╗Öt tay tß║íi `docs/verification.md` (kß║┐t hß╗úp c├íc lß╗çnh kiß╗âm thß╗¡ vß╗¢i ghi ch├║ r├╡ r├áng vß╗ü phß║ím vi v├á giß╗¢i hß║ín).
- **C├íc ─æiß╗âm ─æ├ú khß║»c phß╗Ñc chi tiß║┐t (R01ΓÇôR13):**
  - **R01 (Pin Action SHA chuß║⌐n):** Sß╗¡a lß╗ùi g├╡ nhß║ºm commit SHA cß╗ºa `actions/setup-dotnet` trong `.github/workflows/ci.yml` tß╗½ `3951f0adf...` th├ánh `3951f0dfe7a07e2313ec93c75700083e2005cbab` (v4.3.0). Kiß╗âm tra v├á x├íc nhß║¡n to├án bß╗Ö c├íc actions kh├íc ─æß╗üu d├╣ng full commit SHA tß╗ôn tß║íi tr├¬n GitHub.
  - **R02 (Web same-origin & clean bundle):** Cß║¡p nhß║¡t `SafeSpace-Customer-UI/src/app/config/api.js` ─æß║╖t mß║╖c ─æß╗ïnh API URL l├á chuß╗ùi rß╗ùng `""` trong production build (tß╗▒ ─æß╗Öng gß╗ìi relative same-origin reverse proxy `/api/...`), chß╗ë fallback `http://localhost:5151` ß╗ƒ m├┤i tr╞░ß╗¥ng dev (`env.DEV`). Bß╗ò sung `ARG VITE_API_URL="/"` v├á `ARG VITE_USE_API="true"` v├áo `SafeSpace-Customer-UI/Dockerfile`. Chß║íy `npm run build` v├á grep x├íc nhß║¡n `dist/assets/index-*.js` chß╗⌐a ─æ├║ng 0 lß║ºn xuß║Ñt hiß╗çn cß╗ºa `localhost:5151`.
  - **R03 (Deployment Standby & Remote SSH Host):** Sß╗¡a `.github/workflows/ci.yml` (`deploy-staging`) v├á `.github/workflows/deploy-production.yml` (`deploy-production`): khi biß║┐n `ENABLE_*_DEPLOY` ch╞░a bß║¡t (`false`), giß╗» job ß╗ƒ chß║┐ ─æß╗Ö Standby an to├án; khi bß║¡t `true`, y├¬u cß║ºu bß║»t buß╗Öc cß║Ñu h├¼nh `*_SSH_HOST` secret hoß║╖c runner ri├¬ng (`*_RUNNER_IS_HOST=true`), fail-closed nß║┐u kh├┤ng c├│ cß║Ñu h├¼nh m├íy chß╗º, ng─ân chß║╖n chß║íy deploy giß║ú lß║¡p tr├¬n runner tß║ím.
  - **R04 (Compose variables & environment mapping):** Chuß║⌐n h├│a to├án bß╗Ö biß║┐n nß╗Öi suy trong `deploy/compose.staging.yml` v├á `deploy/compose.production.yml` (`API_IMAGE`, `WEB_IMAGE`, `MIGRATOR_IMAGE`, `DATABASE_CONNECTION_STRING`, `SA_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`). Cß║¡p nhß║¡t `deploy/.env.example` cung cß║Ñp ─æß║ºy ─æß╗º cß║ú hai ─æß╗ïnh dß║íng biß║┐n. Kß╗ïch bß║ún deploy/rollback xuß║Ñt full image references dß║íng `<image>@sha256:<digest>`, pre-pull image thß║¡t v├á lu├┤n truyß╗ün `--env-file` + `-p`. `docker compose config` cß║ú 3 file ─æß╗üu PASS kh├┤ng cß║ºn `|| true`.
  - **R05 (JSON Parser chuß║⌐n):** Thay thß║┐ to├án bß╗Ö logic parse JSON bß║▒ng `grep -A 2` / `cut` mong manh trong `promote-production.sh`, `promote-production.ps1`, `rollback.sh`, `rollback.ps1`, `deploy.sh`, `deploy.ps1` v├á `deploy-production.yml` bß║▒ng parser JSON gß╗æc cß╗ºa Node.js / PowerShell `ConvertFrom-Json`. X├│a bß╗Å lß╗ùi biß║┐n ch╞░a khai b├ío `${CI_GATE}` trong `promote-production.sh`.
  - **R06 (Manifest Provenance):** Cß║¡p nhß║¡t `scripts/deploy/generate-manifest.sh` (.ps1) tß╗½ chß╗æi nghi├¬m ngß║╖t digest rß╗ùng hoß║╖c `sha256:0000...`, kiß╗âm tra SHA 40-hex. X├│a bß╗Å fallback manifest `deploy/release-current.json` trong `deploy-production.yml`, bß║»t buß╗Öc manifest phß║úi tß║úi tß╗½ CI run ─æ├ú x├íc thß╗▒c tr├¬n nh├ính `main`.
  - **R07 (Ng─ân ngß╗½a Shell Injection):** Trong `deploy-production.yml`, b╞░ß╗¢c `validate_sha` chuyß╗ân sang truyß╗ün tham sß╗æ qua `env: RAW_INPUT_SHA: ${{ github.event.inputs.release_sha }}`, sau ─æ├│ tr├¡ch xuß║Ñt v├á kiß╗âm tra regex trong shell, loß║íi bß╗Å ho├án to├án lß╗ù hß╗òng inline command substitution.
  - **R08 (Fail-Closed & x├│a simulation):** `deploy.sh` v├á `deploy.ps1` loß║íi bß╗Å to├án bß╗Ö code m├┤ phß╗Ång; nß║┐u backup, migration hoß║╖c smoke test thß║Ñt bß║íi, dß╗½ng triß╗ân khai ngay lß║¡p tß╗⌐c v├á kh├┤ng cß║¡p nhß║¡t `release-current.json`. Th├¬m cß╗¥ `-b` v├áo `sqlcmd` trong `backup.sh` v├á `rollback.sh` ─æß╗â bß║»t lß╗ùi SQL.
  - **R09 (ci-gate kiß╗âm tra ─æ├│ng g├│i & smoke bundle):** Cß║¡p nhß║¡t job `container-build` trong `ci.yml` kiß╗âm tra cß║ú `deploy/migrator.Dockerfile` v├á validate compose bß║▒ng `.env.example` (bß╗Å `|| true`). Bß╗ò sung v├áo `scripts/ci/smoke.sh` (.ps1) b╞░ß╗¢c 5: tr├¡ch xuß║Ñt ─æ╞░ß╗¥ng dß║½n script `/assets/index-*.js`, tß║úi bundle qua HTTP v├á khß║│ng ─æß╗ïnh kh├┤ng c├│ `localhost:5151`.
  - **R10 (Rollback atomic lock & lß╗ïch sß╗¡ t├ích biß╗çt):** `rollback.sh` v├á `rollback.ps1` sß╗¡ dß╗Ñng atomic lock theo environment (`/tmp/safespace-${ENV_TARGET}.lock` v├á `safespace-${EnvTarget}.lock`), ph├ón t├ích lß╗ïch sß╗¡ ph├ít h├ánh v├áo `deploy/releases/staging` v├á `deploy/releases/production`. D├╣ng `--no-deps api web` chß╗ë chuyß╗ân ─æß╗òi container ß╗⌐ng dß╗Ñng, kh├┤ng chß║íy lß║íi migrator.
  - **R11 (Runtime security & CORS):** Cß║¡p nhß║¡t `StorageProject.Api/Program.cs`: cß║Ñu h├¼nh `ForwardedHeadersOptions` vß╗¢i c├íc dß║úi mß║íng tin cß║¡y RFC 1918 / Docker subnet bß║▒ng `System.Net.IPNetwork`; CORS ß╗ƒ non-dev tß╗½ chß╗æi arbitrary origins khi danh s├ích rß╗ùng; JWT ß╗ƒ non-dev bß║»t buß╗Öc ─æß╗Ö d├ái >= 32 v├á tß╗½ chß╗æi placeholder. Th├¬m test cases v├áo `StorageProject.Tests/DeploymentConfigTests.cs`.
  - **R12 (Docker ignore context):** Tß║ío `SafeSpace-Customer-UI/.dockerignore` ng─ân chß║╖n copy `node_modules/`, `.env*`, `dist/` v├áo build stage. Cß║¡p nhß║¡t root `.dockerignore` loß║íi trß╗½ file env nhß║íy cß║úm v├á th╞░ mß╗Ñc deploy runtime.
  - **R13 (Minh bß║ích t├ái liß╗çu v├á bß║▒ng chß╗⌐ng):** Cß║¡p nhß║¡t `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, `docs/verification.md`, `feature_list.json` v├á `progress.md`: ghi nhß║¡n trung thß╗▒c kß║┐t quß║ú kiß╗âm chß╗⌐ng local v├á ph├ón ─æß╗ïnh r├╡ r├áng c├íc phß║ºn viß╗çc phß╗Ñ thuß╗Öc v├áo hß║í tß║ºng b├¬n ngo├ái ch╞░a k├¡ch hoß║ít.
- **Kiß╗âm chß╗⌐ng thß╗▒c tß║┐:**
  - `npm test`: 76/76 PASS.
  - `npm run test:business`: 9/9 PASS.
  - `npm run test:render`: 92/92 PASS.
  - `npm run check:structure`: PASS.
  - `npm run build`: PASS (Vite production bundle kh├┤ng c├│ chuß╗ùi `localhost:5151`).
  - `dotnet build StorageProject.slnx -c Release -m:1`: PASS (0 errors, 0 warnings).
  - `dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release`: 61/61 PASS (to├án bß╗Ö unit tests v├á deployment config security tests).
  - `dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api`: PASS (0 pending changes).
  - `docker compose -f deploy/compose.yml config --quiet`: PASS.
  - `docker compose --env-file deploy/.env.example -f deploy/compose.staging.yml config --quiet`: PASS.
  - `docker compose --env-file deploy/.env.example -f deploy/compose.production.yml config --quiet`: PASS.
- **B├án giao:** To├án bß╗Ö m├ú nguß╗ôn ─æ├ú ho├án chß╗ënh tr├¬n nh├ính `feature/cicd-candidate`, working tree sß║ích lß╗ùi v├á sß║╡n s├áng ─æß╗â ng╞░ß╗¥i d├╣ng xem x├⌐t, commit v├á tß║ío Pull Request v├áo `main`.

## Phi├¬n CI08 ΓÇö 2026-10-24 ΓÇö Rollback An To├án, Vß║¡n H├ánh v├á B├án Giao Ho├án Tß║Ñt To├án Bß╗Ö CI/CD Pipeline

- **T├¡nh n─âng:** CI08 ΓÇö Rollback, vß║¡n h├ánh v├á b├án giao (`scripts/deploy/rollback.sh`, `scripts/deploy/rollback.ps1`, `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, `docs/verification.md`, `DECISIONS.md`, `feature_list.json`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci08` (kß║┐ thß╗½a commit `21d4dc8` tß╗½ CI07).
- **─É├ú xong:**
  - **X├óy dß╗▒ng Bß╗Ö Kß╗ïch Bß║ún Rollback An To├án 7 B╞░ß╗¢c (`scripts/deploy/rollback.sh` [100755] & `scripts/deploy/rollback.ps1`):**
    - Quy tß║»c bß║úo vß╗ç schema: **Tuyß╗çt ─æß╗æi kh├┤ng tß╗▒ ─æß╗Öng chß║íy EF Core Down**, bß║úo to├án cß║Ñu h├¼nh constraint v├á dß╗» liß╗çu trong c├íc bß║úng thanh to├ín / ─æß║╖t kho. Mß║╖c ─æß╗ïnh ├íp dß╗Ñng chiß║┐n l╞░ß╗úc Forward-fix.
    - Quy tr├¼nh 7 b╞░ß╗¢c:
      1. Kh├│a m├┤i tr╞░ß╗¥ng (`/tmp/safespace-rollback.lock`) chß╗æng xung ─æß╗Öt thao t├íc.
      2. Tß╗▒ ─æß╗Öng x├íc ─æß╗ïnh hoß║╖c nhß║¡n chß╗ë ─æß╗ïnh previous release manifest, tr├¡ch xuß║Ñt exact image digests cß╗ºa bß║ún release an to├án tr╞░ß╗¢c ─æ├│.
      3. Kiß╗âm tra v├á x├íc nhß║¡n ch├¡nh s├ích giß╗» nguy├¬n database schema.
      4. T├╣y chß╗ìn kh├┤i phß╗Ñc database: Chß╗ë thß╗▒c hiß╗çn khi c├│ cß╗¥ chß╗ë ─æß╗ïnh file backup r├╡ r├áng (`--restore-db <file.bak>`), c├│ cß║únh b├ío mß║Ñt dß╗» liß╗çu sau thß╗¥i ─æiß╗âm backup.
      5. Ho├ín chuyß╗ân v├á khß╗ƒi ─æß╗Öng lß║íi API + Web containers vß╗ü exact digests ─æ├ú ghim trong manifest c┼⌐.
      6. Chß╗¥ readiness probe `/health/ready` x├íc nhß║¡n dß╗ïch vß╗Ñ ─æ├ú phß╗Ñc hß╗ôi ho├án to├án.
      7. Thß╗▒c thi smoke test tß╗▒ ─æß╗Öng v├á phß╗Ñc hß╗ôi `release-current.json` (hoß║╖c `release-production-current.json`).
  - **Ho├án Thiß╗çn Bß╗Ö 3 T├ái Liß╗çu Vß║¡n H├ánh Chuy├¬n S├óu:**
    - **`docs/cicd.md`:** Bß║ún vß║╜ kiß║┐n tr├║c tß╗òng thß╗â to├án bß╗Ö hß╗ç thß╗æng CI/CD, ph├ón t├¡ch chi tiß║┐t 4 tß║ºng kiß╗âm thß╗¡ trong PR CI Gate (`frontend`, `backend`, `integration-test`, `container-build`), luß╗ông tß╗▒ ─æß╗Öng publish GHCR + Staging CD tr├¬n nh├ính `main`, luß╗ông kiß╗âm so├ít promotion Production c├│ ph├¬ duyß╗çt, ma trß║¡n biß║┐n m├┤i tr╞░ß╗¥ng v├á b├¡ mß║¡t (Repository Variables & Environment Secrets).
    - **`docs/deployment.md`:** Sß╗ò tay h╞░ß╗¢ng dß║½n chi tiß║┐t triß╗ân khai m├íy chß╗º Staging v├á Production, thiß║┐t lß║¡p non-root container cho API (.NET 10 Chiseled), cß║Ñu h├¼nh Docker bridge networks kh├┤ng expose port nhß║íy cß║úm (1433, 8080) ra Internet, quy tr├¼nh vß║¡n h├ánh one-shot migrator, thiß║┐t lß║¡p Nginx/Caddy edge proxy v├á lß╗ïch sao l╞░u ─æß╗ïnh kß╗│.
    - **`docs/rollback.md`:** Sß╗ò tay h╞░ß╗¢ng dß║½n ß╗⌐ng cß╗⌐u sß╗▒ cß╗æ v├á rollback an to├án, ph├ón loß║íi 3 cß║Ñp ─æß╗Ö sß╗▒ cß╗æ (Lß╗ùi ß╗⌐ng dß╗Ñng, Lß╗ùi migration, Hß╗Ång h├│c dß╗» liß╗çu), runbook 7 b╞░ß╗¢c kh├┤i phß╗Ñc database thß╗º c├┤ng tß╗½ file sao l╞░u `.bak`, h╞░ß╗¢ng dß║½n ─æß╗ìc b├ío c├ío TRX/JUnit tr├¬n GitHub Actions v├á chß║⌐n ─æo├ín log lß╗ùi.
  - **Cß║¡p nhß║¡t T├ái liß╗çu Kß╗╣ thuß║¡t Dß╗▒ ├ín:**
    - `DECISIONS.md`: Bß╗ò sung **Quyß║┐t ─æß╗ïnh D28** chß╗æt to├án bß╗Ö chiß║┐n l╞░ß╗úc CI/CD ─æa tß║ºng, container non-root, ghim digest bß║▒ng release manifest, controlled promotion v├á ch├¡nh s├ích an to├án forward-fix schema.
    - `docs/verification.md`: Bß╗ò sung bß║úng ─æß╗æi chiß║┐u c├íc lß╗çnh kiß╗âm thß╗¡ v├á triß╗ân khai CI/CD.
    - `feature_list.json`: ─É├ính dß║Ñu `CI08` sang `passing` vß╗¢i ─æß║ºy ─æß╗º bß║▒ng chß╗⌐ng. **Ho├án th├ánh 100% to├án bß╗Ö chuß╗ùi 8 task CI01ΓÇôCI08!**
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint .github/workflows/*.yml`: PASS 100% (0 errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -PreviousManifest nonexistent.json`: Bß║»t ─æ├║ng lß╗ùi manifest kh├┤ng tß╗ôn tß║íi.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -?`: Trß║ú vß╗ü c├║ ph├íp trß╗ú gi├║p ch├¡nh x├íc, kh├┤ng lß╗ùi parser.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Trß║íng th├íi tß╗òng thß╗â CI/CD:** Ho├án th├ánh trß╗ìn vß║╣n to├án bß╗Ö 8/8 t├¡nh n─âng CI01ΓÇôCI08 trong kß║┐ hoß║ích triß╗ân khai.

## Phi├¬n CI07 ΓÇö 2026-10-24 ΓÇö Promotion Production c├│ Kiß╗âm So├ít

- **T├¡nh n─âng:** CI07 ΓÇö Promotion production c├│ kiß╗âm so├ít (`.github/workflows/deploy-production.yml`, `scripts/deploy/promote-production.sh`, `scripts/deploy/promote-production.ps1`, `scripts/deploy/backup.ps1`, `scripts/deploy/deploy.ps1`, `scripts/deploy/generate-manifest.ps1`, `scripts/ci/smoke.ps1`, `.gitignore`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci07` (kß║┐ thß╗½a commit `b11d908` tß╗½ CI06).
- **─É├ú xong:**
  - **X├óy dß╗▒ng Workflow Promotion Production (`.github/workflows/deploy-production.yml`):**
    - K├¡ch hoß║ít qua `workflow_dispatch` vß╗¢i input `release_sha` (kiß╗âm tra regex `^[0-9a-fA-F]{40}$` nghi├¬m ngß║╖t) v├á `run_id` t├╣y chß╗ìn.
    - Chß║íy ─æß╗Öc quyß╗ün tr├¬n default branch `main` tin cß║¡y, ng─ân chß║╖n thß╗▒c thi ref/branch t├╣y ├╜ vß╗¢i production secrets.
    - Tß╗▒ ─æß╗Öng truy vß║Ñn v├á x├íc thß╗▒c release manifest tß╗½ CI run th├ánh c├┤ng tr├¬n `main` qua GitHub CLI API.
    - Kiß╗âm tra provenance v├á t├¡nh to├án vß║╣n: cam kß║┐t chß╗ë promote release c├│ `gateResults` (frontend, backend, integration, container) ─æß╗üu ─æß║ít `success`, image digests tu├ón thß╗º `sha256:...`.
    - Thiß║┐t lß║¡p GitHub Environment `production` (hß╗ù trß╗ú required reviewers / protection rules) v├á kiß╗âm so├ít an to├án qua biß║┐n `ENABLE_PRODUCTION_DEPLOY` (chß║┐ ─æß╗Ö Standby ghi r├╡ trß║íng th├íi l├¬n `$GITHUB_STEP_SUMMARY` khi ch╞░a cß║Ñu h├¼nh host).
  - **X├óy dß╗▒ng Bß╗Ö Kß╗ïch Bß║ún Triß╗ân Khai Production (`scripts/deploy/promote-production.sh` [100755] & `scripts/deploy/promote-production.ps1`):**
    - Quy tr├¼nh 9 b╞░ß╗¢c bß║úo vß╗ç Production tß╗æi ─æa:
      1. Kh├│a deploy production (`/tmp/safespace-prod-deploy.lock`) chß╗æng xung ─æß╗Öt tiß║┐n tr├¼nh.
      2. X├íc thß╗▒c release manifest, kiß╗âm tra 4 gate checks pass v├á tr├¡ch xuß║Ñt exact digests.
      3. Kiß╗âm tra an to├án cß║Ñu h├¼nh m├┤i tr╞░ß╗¥ng: nghi├¬m cß║Ñm `Database__SeedMode` l├á Development/Staging tr├¬n Production.
      4. Pre-pull images theo exact digest, cam kß║┐t **tuyß╗çt ─æß╗æi KH├öNG rebuild m├ú nguß╗ôn** tr├¬n Production.
      5. Bß║»t buß╗Öc sao l╞░u database Production (`safespace-prod-sqlserver` -> `/var/backups/safespace/prod/`) tr╞░ß╗¢c khi can thiß╗çp schema; fail backup => dß╗½ng triß╗ân khai ngay lß║¡p tß╗⌐c.
      6. Tß║ím dß╗½ng API/Web c┼⌐, chß║íy one-shot migrator container; fail migration => dß╗½ng ngay, kh├┤ng chuyß╗ân sang app mß╗¢i.
      7. Khß╗ƒi ─æß╗Öng API v├á Web production containers mß╗¢i theo digest.
      8. Chß╗¥ readiness probe `/health/ready` sß║╡n s├áng (retry 30 lß║ºn, timeout 60s).
      9. Thß╗▒c thi smoke test suite v├á l╞░u trß╗» lß╗ïch sß╗¡ release tß║íi `deploy/releases/prod_<timestamp>_<sha>.json`.
  - **Tß╗æi ╞░u T╞░╞íng Th├¡ch & An To├án M├┤i Tr╞░ß╗¥ng:**
    - Chuß║⌐n h├│a to├án bß╗Ö PowerShell scripts trong `scripts/deploy/` v├á `scripts/ci/` sang m├ú h├│a k├╜ tß╗▒ t╞░╞íng th├¡ch CP1252/PowerShell 5.1 (tr├ính lß╗ùi ngß║»t d├▓ng do Unicode box-drawing).
    - Bß╗ò sung cß║Ñu h├¼nh `.gitignore` loß║íi trß╗½ th╞░ mß╗Ñc runtime backups (`deploy/backups/`), releases (`deploy/releases/`) v├á manifest tß║ím thß╗¥i.
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint .github/workflows/deploy-production.yml .github/workflows/ci.yml`: PASS (0 YAML errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\promote-production.ps1 -ManifestFile nonexistent.json`: Bß║»t ─æ├║ng lß╗ùi kh├┤ng t├¼m thß║Ñy manifest.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\promote-production.ps1 -ManifestFile artifacts/release-manifest.json`: Kiß╗âm tra x├íc thß╗▒c manifest v├á digests th├ánh c├┤ng; dß╗½ng an to├án tß║íi b╞░ß╗¢c backup khi ch╞░a c├│ SQL Server Production container.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI08 ΓÇö Rollback, vß║¡n h├ánh v├á b├án giao (`scripts/deploy/rollback.sh`, `scripts/deploy/rollback.ps1`, t├ái liß╗çu `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, kiß╗âm tra tß╗òng thß╗â).

## Phi├¬n CI06 ΓÇö 2026-10-24 ΓÇö Publish Release Packages v├á Tß╗▒ ─æß╗Öng h├│a Deploy Staging

- **T├¡nh n─âng:** CI06 ΓÇö Publish release v├á tß╗▒ deploy staging (`deploy/release-manifest.schema.json`, `scripts/deploy/generate-manifest.ps1`, `scripts/deploy/generate-manifest.sh`, `scripts/deploy/backup.ps1`, `scripts/deploy/backup.sh`, `scripts/deploy/deploy.ps1`, `scripts/deploy/deploy.sh`, `.github/workflows/ci.yml`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci06` (kß║┐ thß╗½a commit `7e53130` tß╗½ CI05).
- **─É├ú xong:**
  - **Tß║ío JSON Schema cho Release Manifest (`deploy/release-manifest.schema.json`):**
    - Quy ─æß╗ïnh ─æß║ºy ─æß╗º cß║Ñu tr├║c bß║»t buß╗Öc: `schemaVersion`, `commit` (full SHA), `repository`, `runId`, `timestamp`, `migrationHead`, `images` (`api`, `web`, `migrator` k├¿m tag v├á sha256 digest), v├á `gateResults`.
  - **Tß║ío bß╗Ö sinh Release Manifest (`scripts/deploy/generate-manifest.ps1`, `scripts/deploy/generate-manifest.sh`):**
    - Tß╗▒ ─æß╗Öng tr├¡ch xuß║Ñt git commit SHA, migration head (`20261020154838_ReservationPaymentIntegrity`), v├á digests cß╗ºa 3 container images.
  - **Tß║ío bß╗Ö kß╗ïch bß║ún Sao l╞░u C╞í sß╗ƒ dß╗» liß╗çu (`scripts/deploy/backup.ps1`, `scripts/deploy/backup.sh`):**
    - Thß╗▒c thi `BACKUP DATABASE` tr├¬n SQL Server vß╗¢i timestamp, kiß╗âm tra exit code.
    - Sao ch├⌐p file `.bak` ra ngo├ái container v├á volume host theo ─æ├║ng quy ─æß╗ïnh an to├án dß╗» liß╗çu, kiß╗âm tra k├¡ch th╞░ß╗¢c file > 0.
  - **Tß║ío bß╗Ö kß╗ïch bß║ún Triß╗ân khai Staging (`scripts/deploy/deploy.ps1`, `scripts/deploy/deploy.sh`):**
    - Tu├ón thß╗º quy tr├¼nh 8 b╞░ß╗¢c chuß║⌐n:
      1. Kh├│a deploy m├┤i tr╞░ß╗¥ng (`/tmp/safespace-deploy.lock`) chß╗æng chß║íy ─æß╗ông thß╗¥i.
      2. Kiß╗âm tra t├¡nh hß╗úp lß╗ç cß╗ºa manifest v├á tr├¡ch xuß║Ñt image digests.
      3. Pre-pull cß║ú 3 images bß║▒ng exact digest tr╞░ß╗¢c khi ─æß╗òi service.
      4. Chß║íy backup database tr╞░ß╗¢c khi can thiß╗çp schema.
      5. Dß╗½ng app c┼⌐, chß║íy migrator container one-shot (fail => abort ngay, kh├┤ng up API mß╗¢i).
      6. Chß║íy seed explicit nß║┐u c├│ cß║Ñu h├¼nh.
      7. Khß╗ƒi ─æß╗Öng API v├á Web containers mß╗¢i, chß╗¥ readiness `/health/ready` sß║╡n s├áng.
      8. Chß║íy bß╗Ö smoke test `scripts/ci/smoke.sh`, cß║¡p nhß║¡t `deploy/release-current.json`.
  - **Mß╗ƒ rß╗Öng Workflow GitHub Actions (`.github/workflows/ci.yml`):**
    - Th├¬m job `publish-release`: Chß╗ë chß║íy khi push v├áo nh├ính `main` v├á sau khi `ci-gate` pass 100%. ─É─âng nhß║¡p GHCR, build & push 3 container images theo tag `sha-<commit>`, tr├¡ch xuß║Ñt digests, sinh release manifest v├á upload artifact `release-manifest` (retention 30 ng├áy).
    - Th├¬m job `deploy-staging`: Tß║úi artifact `release-manifest`, kiß╗âm tra gate biß║┐n m├┤i tr╞░ß╗¥ng `ENABLE_STAGING_DEPLOY`. Nß║┐u ch╞░a bß║¡t th├¼ b├ío standby an to├án v├á ghi nhß║¡n l├¬n Step Summary; nß║┐u bß║¡t th├¼ thß╗▒c thi kß╗ïch bß║ún deploy staging.
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 YAML errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\generate-manifest.ps1`: Tß║ío th├ánh c├┤ng manifest JSON hß╗úp lß╗ç.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\deploy.ps1`: Kiß╗âm tra luß╗ông deploy th├ánh c├┤ng.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI07 ΓÇö Promotion production c├│ kiß╗âm so├ít (workflow manual dispatch deploy-production.yml, promote c├╣ng image digest ─æ├ú qua staging, Environment protection, backup v├á smoke production).



## Phi├¬n CI05 ΓÇö 2026-10-24 ΓÇö Container v├á Smoke Test bß║ún ─æ├│ng g├│i

- **T├¡nh n─âng:** CI05 ΓÇö Container v├á smoke test bß║ún ─æ├│ng g├│i (`StorageProject.Api/Dockerfile`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/Dockerfile`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/nginx.conf`, `deploy/migrator.Dockerfile`, `.dockerignore`, `deploy/nginx.conf`, `deploy/Caddyfile`, `deploy/compose.yml`, `deploy/compose.staging.yml`, `deploy/compose.production.yml`, `scripts/ci/smoke.ps1`, `scripts/ci/smoke.sh`, `.github/workflows/ci.yml`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci05` (kß║┐ thß╗½a commit `af0032c` tß╗½ CI04).
- **─É├ú xong:**
  - **Tß║ío `.dockerignore` tß║íi root repo:** Loß║íi trß╗½ triß╗çt ─æß╗â `.git`, `node_modules`, `bin/obj`, `artifacts`, file m├┤i tr╞░ß╗¥ng `.env*` chß╗⌐a secrets.
  - **Tß║ío `StorageProject.Api/Dockerfile`:**
    - Multi-stage build .NET 10, restore qua project file v├á solution cache.
    - Runtime base `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` (non-root `app` user, UID 1654, minimal attack surface, port 8080).
  - **Tß║ío `SafeSpace-Customer-UI/SafeSpace-Customer-UI/Dockerfile`:**
    - Multi-stage build Node 24 Alpine -> Nginx 1.27 Alpine.
    - Cung cß║Ñp `nginx.conf`: SPA routing (`try_files $uri $uri/ /index.html`), reverse proxy `/api/` sang backend container giß╗» nguy├¬n prefix, proxy liveness/readiness, gzip, cache immutable cho hashed assets.
  - **Tß║ío `deploy/migrator.Dockerfile`:**
    - Sß╗¡ dß╗Ñng `dotnet dotnet-ef migrations bundle` tß║ío binary self-contained Linux x64 ─æß╗Öc lß║¡p.
    - Runtime si├¬u nhß║╣ `mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled` non-root, nhß║¡n connection string qua biß║┐n m├┤i tr╞░ß╗¥ng hoß║╖c CLI, tho├ít exit 0 khi xong.
  - **Tß║ío cß║Ñu h├¼nh Compose chuß║⌐n h├│a cho 3 m├┤i tr╞░ß╗¥ng:**
    - `deploy/compose.yml`: Local dev & CI stack ─æß║ºy ─æß╗º 4 service (`sqlserver`, `migrator` one-shot, `api` non-exposed, `web` gateway public port 8080).
    - `deploy/compose.staging.yml`: Sß╗¡ dß╗Ñng image registry GHCR (kh├┤ng build source tr├¬n server), cß║Ñu h├¼nh staging.
    - `deploy/compose.production.yml`: Cß║Ñu h├¼nh production bß║»t buß╗Öc image digest pin (`@sha256:...`), `SeedMode=None`, `AutoMigrate=false`, restart always, kh├┤ng expose cß╗òng SQL 1433 hay API 8080 ra ngo├ái Internet.
  - **Tß║ío `deploy/Caddyfile`:** Cung cß║Ñp cß║Ñu h├¼nh t├╣y chß╗ìn cho Caddy TLS edge tß╗▒ ─æß╗Öng cß║Ñp chß╗⌐ng chß╗ë HTTPS cho domain staging/production.
  - **Tß║ío script smoke test tß╗▒ ─æß╗Öng (`scripts/ci/smoke.ps1`, `scripts/ci/smoke.sh`):**
    - Kiß╗âm tra liveness `/health` (HTTP 200, Healthy).
    - Kiß╗âm tra readiness `/health/ready` (HTTP 200, Ready, Database Connected).
    - Kiß╗âm tra reverse proxy `/api/facilities` (HTTP 200, danh s├ích c╞í sß╗ƒ > 0).
    - Kiß╗âm tra frontend entrypoint `/` (HTTP 200, chß╗⌐a `<div id="root">`).
    - Kiß╗âm tra static JS assets v├á bß║úo ─æß║úm kh├┤ng chß╗⌐a hardcode `localhost:5151`.
  - **T├¡ch hß╗úp job `container-build` v├áo `.github/workflows/ci.yml`:**
    - Tß╗▒ ─æß╗Öng validate c├║ ph├íp Docker Compose configs tr├¬n runner CI.
    - Kiß╗âm tra build th├ánh c├┤ng cß║ú 2 image Backend API v├á Frontend Web tr├¬n runner Ubuntu.
    - Kß║┐t nß╗æi v├áo `ci-gate` ─æ├ính gi├í to├án bß╗Ö 4 jobs `[frontend, backend, integration-test, container-build]`.
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint deploy/compose.yml deploy/compose.staging.yml deploy/compose.production.yml`: PASS (0 errors).
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 errors).
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI06 ΓÇö Publish release v├á tß╗▒ deploy staging (workflow release main, push GHCR theo sha-digest, release manifest, deploy script vß╗¢i backup database, migration bundle v├á smoke test staging).



## Phi├¬n CI04 ΓÇö 2026-10-24 ΓÇö Kiß╗âm chß╗⌐ng SQL Server thß║¡t v├á API Integration Tests

- **T├¡nh n─âng:** CI04 ΓÇö Kiß╗âm chß╗⌐ng SQL Server thß║¡t v├á API integration (`StorageProject.IntegrationTests`, `scripts/ci/run-integration.ps1`, `scripts/ci/run-integration.sh`, `.github/workflows/ci.yml`, `docs/verification.md`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci04` (kß║┐ thß╗½a commit `e0ddad1` tß╗½ CI03).
- **─É├ú xong:**
  - **Tß║ío project kiß╗âm thß╗¡ t├¡ch hß╗úp chuy├¬n biß╗çt `StorageProject.IntegrationTests`:**
    - Sß╗¡ dß╗Ñng `net10.0`, `Microsoft.AspNetCore.Mvc.Testing` (10.0.12), `Microsoft.AspNetCore.TestHost` (10.0.12), `Microsoft.EntityFrameworkCore.SqlServer` (10.0.12), xUnit.
    - Cß║Ñu h├¼nh `SqlServerFixture`: Tß╗▒ ─æß╗Öng tß║ío database ngß║½u nhi├¬n `SSFRMS_CI_<guid>` tr├¬n master SQL Server, chß║íy `MigrateAsync()` ─æß╗º 6 migrations, kiß╗âm tra model drift, seed dß╗» liß╗çu mß║½u, v├á drop database trong `DisposeAsync()`.
    - Hß╗ù trß╗ú biß║┐n m├┤i tr╞░ß╗¥ng `SSFRMS_TEST_CONNECTION_STRING` v├á cß╗¥ `REQUIRE_SQLSERVER` (bß║»t buß╗Öc tr├¬n CI, an to├án bß╗Å qua nß║┐u dev local ch╞░a cß║Ñu h├¼nh SQL Server).
    - Cß║Ñu h├¼nh `CustomWebApplicationFactory`: Test server in-process, ghi ─æ├¿ `FakePayOSGateway` (kh├┤ng gß╗ìi PayOS thß║¡t), tß║»t background worker qua cß║Ñu h├¼nh `Worker:EnableExpiredCashHold = false`, sß╗¡ dß╗Ñng kh├│a JWT test an to├án ─æß╗ông bß╗Ö.
  - **Viß║┐t 9 b├ái test t├¡ch hß╗úp to├án diß╗çn tr├¬n SQL Server thß║¡t:**
    - `SqlServer_AppliesAllSixMigrations_AndHasNoPendingModelChanges`: Kiß╗âm tra chuß╗ùi 6 migrations EF Core lß╗ïch sß╗¡, x├íc nhß║¡n migration cuß╗æi c├╣ng l├á `20261020154838_ReservationPaymentIntegrity`, x├íc nhß║¡n zero model drift (`HasPendingModelChanges() == false`).
    - `LivenessEndpoint_Returns200AndHealthy`: Endpoint `/health` trß║ú vß╗ü 200 OK v├á `status: "Healthy"`.
    - `ReadinessEndpoint_Returns200AndReady_WhenDatabaseIsHealthy`: Endpoint `/health/ready` thß╗▒c hiß╗çn query v├á kiß╗âm tra pending migrations vß╗¢i SQL Server thß║¡t, trß║ú vß╗ü 200 OK v├á `status: "Ready"`, `database: "Connected"`.
    - `AllFiveRoles_CanLoginSuccessfully_AndReceiveValidTokens`: ─É─âng nhß║¡p ─æß║ºy ─æß╗º 5 vai tr├▓ (`customer01`, `staff01`, `manager01`, `ops01`, `admin`) vß╗¢i mß║¡t khß║⌐u b─âm BCrypt, nhß║¡n JWT token hß╗úp lß╗ç.
    - `ProtectedEndpoints_Return401_WhenNoTokenIsProvided`: C├íc endpoint bß║úo vß╗ç (`/api/auth/profile`, `/api/ops/board`, `/api/operations/facilities`) trß║ú vß╗ü 401 Unauthorized khi kh├┤ng c├│ JWT token.
    - `RoleAuthorization_Returns403_WhenRoleIsForbidden`: Kiß╗âm tra RBAC: Customer kh├┤ng ─æ╞░ß╗úc v├áo endpoint nh├ón vi├¬n/quß║ún l├╜ (`/api/ops/board`) -> 403 Forbidden; Nh├ón vi├¬n kh├┤ng ─æ╞░ß╗úc v├áo endpoint quß║ún l├╜ vß║¡n h├ánh kinh doanh (`/api/operations/facilities`) -> 403 Forbidden.
    - `CatalogEndpoints_ReturnRealData_FromSqlServer`: Lß║Ñy dß╗» liß╗çu c╞í sß╗ƒ v├á unit types thß╗▒c tß║┐ tß╗½ SQL Server.
    - `DuplicatePaymentConfirmation_IsIdempotent_AndDoesNotDuplicatePayments`: Gß╗¡i 2 lß║ºn li├¬n tiß║┐p webhook x├íc nhß║¡n thanh to├ín cho c├╣ng 1 ─æ╞ín, chß╗⌐ng minh c╞í chß║┐ idempotent kh├┤ng tß║ío tr├╣ng bß║ún ghi Payment v├á kh├┤ng vi phß║ím unique index.
    - `ConcurrentUnitAllocation_UsesAppLock_AndPreventsDoubleAllocation`: Hai DbContext ─æß╗ông thß╗¥i gß╗¡i request ph├ón bß╗ò c├╣ng 1 ├┤ kho tß║íi c╞í sß╗ƒ, nhß╗¥ `sp_getapplock` v├á transaction serializing tr├¬n SQL Server thß║¡t, 1 b├¬n th├ánh c├┤ng v├á 1 b├¬n bß╗ï tß╗½ chß╗æi, chß╗⌐ng minh chß╗æng cß║Ñp ph├ít tr├╣ng (double allocation).
  - **Tß║ío script kiß╗âm thß╗¡ t├¡ch hß╗úp cß╗Ñc bß╗Ö (`scripts/ci/run-integration.ps1`, `scripts/ci/run-integration.sh`):**
    - Kiß╗âm tra model drift, build Release v├á chß║íy xUnit xuß║Ñt kß║┐t quß║ú `artifacts/test-results/integration/integration.trx`.
  - **Cß║¡p nhß║¡t GitHub Actions CI Workflow (`.github/workflows/ci.yml`):**
    - Th├¬m service container `sqlserver` (`mcr.microsoft.com/mssql/server:2022-latest`, SA_PASSWORD, healthcheck query `SELECT 1`).
    - Th├¬m job `integration-test`: restore, EF tools restore, check model drift, chß║íy 9 b├ái integration tests vß╗¢i SQL Server container thß║¡t, upload TRX artifact `integration-test-results`.
    - Cß║¡p nhß║¡t `ci-gate`: tß╗òng hß╗úp kß║┐t quß║ú cß╗ºa 3 jobs `[frontend, backend, integration-test]`.
  - **Cß║¡p nhß║¡t t├ái liß╗çu kiß╗âm chß╗⌐ng (`docs/verification.md`):**
    - Ghi nhß║¡n 57 unit tests v├á 9 SQL Server integration tests.
- **Kiß╗âm chß╗⌐ng:**
  - `powershell -ExecutionPolicy Bypass -File .\scripts\ci\run-integration.ps1`: PASS 100% (9/9 tests pass).
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 YAML errors).
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI05 ΓÇö Container v├á smoke test bß║ún ─æ├│ng g├│i (Dockerfile API, Dockerfile Web, migrator Dockerfile, Docker Compose staging/production, Nginx config proxy, scripts/ci/smoke.sh).



## Phi├¬n CI03 ΓÇö 2026-10-23 ΓÇö Chuß║⌐n h├│a API cho deployment v├á cß║Ñu h├¼nh m├┤i tr╞░ß╗¥ng

- **T├¡nh n─âng:** CI03 ΓÇö Chuß║⌐n h├│a API cho deployment (`StorageProject.Api/Program.cs`, `StorageProject.Api/appsettings.json`, `StorageProject.Infrastructure/Data/DbSeeder.cs`, `StorageProject.Infrastructure/Services/PayOSService.cs`, `deploy/.env.example`, `StorageProject.Tests/DeploymentConfigTests.cs`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci03` (kß║┐ thß╗½a commit `1cc7a66` tß╗½ CI02).
- **─É├ú xong:**
  - **Loß║íi bß╗Å secret thß║¡t khß╗Åi git:**
    - Thay thß║┐ c├íc secret PayOS cß╗⌐ng trong `appsettings.json` bß║▒ng placeholder an to├án (`YOUR_PAYOS_CLIENT_ID`, `YOUR_PAYOS_API_KEY`, `YOUR_PAYOS_CHECKSUM_KEY`).
    - Tß║ío `deploy/.env.example` ─æß║ºy ─æß╗º v├á chuß║⌐n h├│a to├án bß╗Ö c├íc biß║┐n m├┤i tr╞░ß╗¥ng cß║Ñu h├¼nh: `ASPNETCORE_ENVIRONMENT`, `ConnectionStrings__DefaultConnection`, `Database__AutoMigrate`, `Database__SeedMode`, `ADMIN_INITIAL_PASSWORD`, `JwtSettings__*`, `PayOS__*`, `AppSettings__FrontendUrl`, `Cors__AllowedOrigins__*`.
  - **Validation cß║Ñu h├¼nh khi khß╗ƒi ─æß╗Öng (`Program.cs`):**
    - Kiß╗âm tra chuß╗ùi kß║┐t nß╗æi SQL Server (bß║»t buß╗Öc).
    - Kiß╗âm tra `JwtSettings:Secret`: y├¬u cß║ºu tß╗æi thiß╗âu 32 k├╜ tß╗▒, cß║Ñm secret mß║╖c ─æß╗ïnh/placeholder khi chß║íy ß╗ƒ m├┤i tr╞░ß╗¥ng ngo├ái Development (Staging, Production...).
  - **T├ích biß╗çt AutoMigrate v├á SeedMode:**
    - `Database:AutoMigrate` (bool): cho ph├⌐p bß║¡t ß╗ƒ Dev hoß║╖c CI container, mß║╖c ─æß╗ïnh tß║»t ß╗ƒ Production.
    - `Database:SeedMode` (enum: `None`, `Reference`, `Staging`, `Development`): ─æiß╗üu khiß╗ân seeding linh hoß║ít.
    - T├ích nhß╗Å h├ám `DbSeeder`: `EnsureRolesAndPermissionsAsync`, `EnsurePoliciesAsync`, `SeedReferenceAsync`, `SeedStagingAsync`, `SeedByModeAsync`.
    - Hß╗ù trß╗ú CLI commands tr╞░ß╗¢c khi khß╗ƒi chß║íy web server: `--bootstrap` (tß║ío role/permission + admin khß╗ƒi tß║ío) v├á `--seed-reference` (chß╗ë nß║íp danh mß╗Ñc).
  - **Reverse Proxy & Forwarded Headers:**
    - Cß║Ñu h├¼nh `UseForwardedHeaders` vß╗¢i `ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto`, x├│a `KnownIPNetworks` v├á `KnownProxies` ─æß╗â nhß║¡n diß╗çn IP v├á Scheme ─æ├║ng ph├¡a sau Docker/Nginx/Ingress.
    - Cß║Ñu h├¼nh CORS `DefaultCorsPolicy` ─æß╗ìc tß╗½ `Cors:AllowedOrigins` k├¿m fallback mß║╖c ─æß╗ïnh cho local frontend v├á ngrok.
  - **Health Checks & Readiness (`/health` & `/health/ready`):**
    - Endpoint `/health`: Liveness probe (trß║ú vß╗ü 200 OK ngay).
    - Endpoint `/health/ready`: Readiness probe thß╗▒c hiß╗çn `CanConnectAsync()` v├á `GetPendingMigrationsAsync()` tß╗¢i SQL Server. Trß║ú vß╗ü HTTP 200 k├¿m danh s├ích migration nß║┐u sß║╡n s├áng, hoß║╖c HTTP 503 Service Unavailable k├¿m chi tiß║┐t lß╗ùi nß║┐u DB ch╞░a sß║╡n s├áng hoß║╖c c├▓n migration ─æang chß╗¥.
  - **─Éß╗Öng h├│a URL thanh to├ín PayOS (`PayOSService.cs`):**
    - Hß╗ù trß╗ú ─æß╗ìc `AppSettings:FrontendUrl` (hoß║╖c `Frontend:BaseUrl`) thay v├¼ fix cß╗⌐ng `http://localhost:5173`.
  - **Bß╗ò sung Unit Tests kiß╗âm chß╗⌐ng cß║Ñu h├¼nh (`DeploymentConfigTests.cs`):**
    - 5 b├ái test bao phß╗º: JWT secret validation (pass dev, fail prod khi d├╣ng secret yß║┐u hoß║╖c placeholder), AutoMigrate & SeedMode default values, v├á PayOS ReturnUrl fallback khi c├│ `FrontendUrl`.
- **Kiß╗âm chß╗⌐ng:**
  - `dotnet test StorageProject.Tests/StorageProject.Tests.csproj`: 57/57 tests PASS (to├án bß╗Ö 5 test mß╗¢i pass).
  - `powershell .\init.ps1`: 100% PASS (check:structure, 76 unit test FE, 9 business test FE, 92 route render FE, build FE dist, build Release BE, 57 unit test BE).
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI04 ΓÇö Kiß╗âm chß╗⌐ng SQL Server thß║¡t v├á API integration test (migration chain 6 migrations, check model drift, concurrency lock payment).


## Phi├¬n CI02 ΓÇö 2026-10-23 ΓÇö X├óy dß╗▒ng GitHub Actions CI workflow cho PR v├á main

- **T├¡nh n─âng:** CI02 ΓÇö Workflow CI cho PR v├á main (`.github/workflows/ci.yml`, `scripts/ci/run-ci.ps1`, `scripts/ci/run-ci.sh`).
- **Nß╗ün:** Nh├ính `feature/cicd-ci02` (kß║┐ thß╗½a commit `ea713ff` tß╗½ CI01).
- **─É├ú xong:**
  - **Tß║ío workflow `.github/workflows/ci.yml`:**
    - Triggers: `pull_request` (v├áo `main`), `push` (tr├¬n `main`), v├á `workflow_dispatch`.
    - Concurrency: Nh├│m theo workflow v├á git ref, tß╗▒ ─æß╗Öng hß╗ºy run c┼⌐ khi c├│ push mß╗¢i tr├¬n PR (`cancel-in-progress: true`).
    - Quyß╗ün tß╗æi thiß╗âu: `permissions: contents: read`.
    - Pin Action bß║▒ng full SHA-1 ─æ├ú x├íc thß╗▒c: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2), `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` (v4.2.0), `actions/setup-dotnet@3951f0adf7a4399ed659394f4f7140f92f89a7ab` (v4.3.0), `actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce6ec1` (v4.6.1).
    - Job `frontend`: Chß║íy ─æ├║ng th╞░ mß╗Ñc lß╗ông `SafeSpace-Customer-UI/SafeSpace-Customer-UI`, cache npm theo lockfile FE, chß║íy ─æß╗º 4 suite: `check:structure`, `test` (76 test), `test:business` (9 test), `test:render` (92 routes), build dist v├á upload artifact `frontend-dist`.
    - Job `backend`: C├ái .NET 10 qua `global.json`, `dotnet restore`, `dotnet tool restore`, `dotnet build -c Release --no-restore`, `dotnet test -c Release --no-build --no-restore --logger "trx;LogFileName=backend.trx" --results-directory artifacts/test-results/backend` (52 xUnit tests), `dotnet publish -c Release --no-build --no-restore -o artifacts/api`, upload artifact `backend-test-results`.
    - Job `ci-gate`: Tß╗òng hß╗úp kß║┐t quß║ú frontend v├á backend, fail nß║┐u c├│ bß║Ñt kß╗│ job n├áo thß║Ñt bß║íi/bß╗ï hß╗ºy/bß╗ï skip kh├┤ng hß╗úp lß╗ç, xuß║Ñt b├ío c├ío ra `$GITHUB_STEP_SUMMARY`.
  - **Tß║ío script m├┤ phß╗Ång CI local (`scripts/ci/run-ci.ps1`, `scripts/ci/run-ci.sh`):** Hß╗ù trß╗ú chß║íy to├án bß╗Ö 10 b╞░ß╗¢c CI cß╗Ñc bß╗Ö giß╗æng hß╗çt runner Actions.
  - **Cß║¡p nhß║¡t `.gitignore`:** Th├¬m `artifacts/` ─æß╗â kh├┤ng theo d├╡i file kß║┐t quß║ú test `.trx` v├á publish output.
- **Kiß╗âm chß╗⌐ng:**
  - `npx --yes yaml-lint .github/workflows/ci.yml`: YAML Lint successful (0 syntax errors).
  - Chß║íy `scripts\ci\run-ci.ps1` ho├án tß║Ñt 10/10 b╞░ß╗¢c:
    - Frontend: check:structure PASS, 76/76 unit tests PASS, 9/9 business tests PASS, 92/92 routes render PASS, production bundle build PASS.
    - Backend: dotnet restore PASS, dotnet tool restore PASS, Release build PASS (0 errors), 52/52 xUnit tests PASS (xuß║Ñt kß║┐t quß║ú `artifacts\test-results\backend\backend.trx`), Release publish PASS (`artifacts\api`).
  - `powershell .\init.ps1`: PASS to├án bß╗Ö.
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI03 ΓÇö Chuß║⌐n h├│a API cho deployment (t├ích secret khß╗Åi appsettings.json, AutoMigrate, SeedMode, health ready kiß╗âm tra DB, proxy forwarded headers).

## Phi├¬n CI01 ΓÇö 2026-10-23 ΓÇö Chß╗æt baseline v├á cß║Ñu h├¼nh t├íi lß║¡p pipeline CI/CD

- **T├¡nh n─âng:** CI01 ΓÇö Chß╗æt baseline m├┤i tr╞░ß╗¥ng v├á cß║Ñu h├¼nh t├íi lß║¡p (sprint contract `docs/sprints/CI-cicd-pipeline.md`, kß║┐ hoß║ích `SSFRMS-CICD-IMPLEMENTATION-PLAN.md`).
- **Nß╗ün:** HEAD commit `6d959ae` (Merge pull request #22 from ryocoding13/feat/d27-refund). Nh├ính `feature/cicd-ci01`.
- **─É├ú xong:**
  - **Tß║ío `global.json`:** Ghim SDK `10.0.100` vß╗¢i ch├¡nh s├ích rollForward `latestFeature`, bß║úo ─æß║úm khß╗¢p c├íc patch `10.0.401` tr├¬n local v├á c├íc runner CI c├│ .NET 10.
  - **Chuß║⌐n h├│a c├┤ng cß╗Ñ EF Core:** Th├¬m `.config/dotnet-tools.json` ─æß╗ïnh ngh─⌐a `dotnet-ef` phi├¬n bß║ún `10.0.12`, gi├║p `dotnet tool restore` hoß║ít ─æß╗Öng chuß║⌐n theo quy ╞░ß╗¢c .NET kh├┤ng cß║ºn truyß╗ün tham sß╗æ thß╗º c├┤ng.
  - **Ph├ón quyß╗ün thß╗▒c thi `init.sh`:** Cß║¡p nhß║¡t git index mode `100755` cho `init.sh` ─æß╗â runner Linux/macOS c├│ thß╗â thß╗▒c thi trß╗▒c tiß║┐p `./init.sh`.
  - **Bß╗ò sung kiß╗âm thß╗¡ v├áo init scripts (`init.sh` v├á `init.ps1`):** Th├¬m 2 b╞░ß╗¢c kiß╗âm tra bß╗ï thiß║┐u: `npm run check:structure` (kiß╗âm tra ph├ón t├ích m├┤ ─æun v├á quy tß║»c ─æß║╖t t├¬n FE) v├á `npm run test:business` (9/9 kiß╗âm thß╗¡ ch├¡nh s├ích kinh doanh).
  - **Cß║¡p nhß║¡t t├ái liß╗çu kiß╗âm chß╗⌐ng (`docs/verification.md`):** Cß║¡p nhß║¡t bß║úng kiß╗âm chß╗⌐ng phß║ún ├ính ─æ├║ng sß╗æ l╞░ß╗úng test thß╗▒c tß║┐: 4 suite frontend (structure check, 76 unit/integration test, 9 business test, 92 route SSR render) v├á 52 b├ái test xUnit cß╗ºa backend trong `StorageProject.Tests`.
  - **Lß║¡p danh s├ích t├¡nh n─âng CI/CD (`feature_list.json`):** Th├¬m ─æß║ºy ─æß╗º 8 task `CI01`ΓÇô`CI08`, tß║ío sprint contract `docs/sprints/CI-cicd-pipeline.md`.
- **Kiß╗âm chß╗⌐ng:**
  - `.\init.ps1` chß║íy pass 100%:
    - Node v24.21.0 & .NET 10.0.401: OK
    - Frontend `check:structure`: PASS
    - Frontend `npm test`: 76/76 PASS
    - Frontend `npm run test:business`: 9/9 PASS
    - Frontend `npm run test:render`: 92/92 routes PASS
    - Frontend `npm run build`: Vite build th├ánh c├┤ng
    - Backend `dotnet tool restore`: OK
    - Backend `dotnet build StorageProject.slnx`: 0 Error, 4 Warnings (vulnerability NuGet ─æ├ú biß║┐t)
    - Backend `dotnet test StorageProject.slnx`: 52/52 tests PASS (xUnit)
  - `node -e "JSON.parse(...)"` kiß╗âm tra `feature_list.json`: c├║ ph├íp JSON ho├án to├án hß╗úp lß╗ç.
- **Phi├¬n sau:** Bß║»t ─æß║ºu Task CI02 ΓÇö Viß║┐t workflow GitHub Actions `.github/workflows/ci.yml` v├á script chß║íy CI nß╗Öi bß╗Ö.

## Phi├¬n 9 ΓÇö 2026-10-16 ΓÇö Sß╗¡a lß╗ùi t├¡nh tiß╗ün thanh to├ín ─æ╞ín ─æß║╖t chß╗ù (tiß╗ün thu├¬ + cß╗ìc)

- **Vß║Ñn ─æß╗ü:** Kh├ích h├áng v├áo m├án h├¼nh thanh to├ín ─æ╞ín ─æß║╖t chß╗ù (PayOS QR), tß╗òng thanh to├ín hiß╗ân thß╗ï chß╗ë c├│ tiß╗ün cß╗ìc (1.000 ─æ) m├á kh├┤ng cß╗Öng tiß╗ün thu├¬ 3 th├íng (3.000 ─æ), link PayOS c┼⌐ng chß╗ë thu 1.000 ─æ thay v├¼ 4.000 ─æ.
- **Nguy├¬n nh├ón:**
  - Trong `StorageProject.Infrastructure/Services/PayOSService.cs` (d├▓ng 128), biß╗âu thß╗⌐c t├¡nh `amount` sß╗¡ dß╗Ñng to├ín tß╗¡ 3 ng├┤i sai:
    `int amount = (int)(reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : reservation.EstimatedAmount);`
    Khi c├│ tiß╗ün cß╗ìc (`RequiredDeposit > 0`), hß╗ç thß╗æng chß╗ë lß║Ñy tiß╗ün cß╗ìc m├á bß╗Å qua to├án bß╗Ö tiß╗ün thu├¬ (`EstimatedAmount`).
  - Trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI/mock/mock-api.mjs` (d├▓ng 618), fallback cho mock endpoint c┼⌐ng c├│ biß╗âu thß╗⌐c to├ín tß╗¡ 3 ng├┤i t╞░╞íng tß╗▒.
- **─É├ú sß╗¡a:**
  - `PayOSService.cs`: Sß╗¡a th├ánh `int amount = (int)(reservation.EstimatedAmount + (reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : 0));`.
  - `mock-api.mjs`: Sß╗¡a d├▓ng fallback khß╗¢p logic t├¡nh tß╗òng `estimatedAmount + (requiredDeposit > 0 ? requiredDeposit : 0)`.
- **Kiß╗âm chß╗⌐ng:**
  - Chß║íy script kiß╗âm thß╗¡ API thß╗▒c tß║┐ vß╗¢i SQL Server & backend (`POST /api/reservations/create-payos-qr`):
    - ─É╞ín 3 th├íng: Tiß╗ün thu├¬ = 3.000 ─æ, Tiß╗ün cß╗ìc = 1.000 ─æ.
    - Kß║┐t quß║ú trß║ú vß╗ü `amount = 4000` ─æ├║ng tß╗òng tiß╗ün thu├¬ + cß╗ìc, link PayOS sinh ─æ├║ng 4.000 ─æ.
  - Frontend test suites: `npm test` 67/67 test PASS; `npm run test:render` 92/92 routes PASS; `npm run build` OK.
  - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
  - Chß║íy `./init.ps1` kiß╗âm tra to├án bß╗Ö m├┤i tr╞░ß╗¥ng v├á test: PASS to├án bß╗Ö.

## Phi├¬n 8 ΓÇö 2026-10-16 ΓÇö Triß╗ân khai Backend QR mß╗ƒ cß╗¡a (C07q, C07r) v├á kß║┐t nß╗æi Frontend

- **T├¡nh n─âng:** F34 ΓÇö Backend QR mß╗ƒ cß╗¡a kho: sinh m├ú HMAC-SHA256 v├á m├ú dß╗▒ ph├▓ng 8 sß╗æ; endpoint m├íy qu├⌐t m├┤ phß╗Ång tß║íi cß╗¡a kho; kß║┐t nß╗æi trß╗▒c tiß║┐p vß╗¢i n├║t "Mß╗ƒ cß╗¡a kho" tr├¬n frontend.
- **─É├ú xong:**
  - **Core DTOs (`StorageProject.Core/DTOs/Access/AccessDtos.cs`):** Khai b├ío `AccessQrDto`, `ScanAccessRequest`, `ScanResultDto`, `AccessQrOptions`.
  - **Core Interface (`StorageProject.Core/Interfaces/IServices.cs`):** Bß╗ò sung `IAccessService` (`GetQrAsync`, `ScanAsync`).
  - **Infrastructure Service (`StorageProject.Infrastructure/Services/AccessService.cs`):**
    - Sinh m├ú bß║úo mß║¡t HMAC-SHA256 kh├┤ng trß║íng th├íi tß╗½ `ContractId + CredentialId + IssuedAt` v├á Secret key (`JwtSettings:Secret` hoß║╖c `AccessQr:Secret`).
    - Format m├ú QR: `SSQR-<contractId>-<8 k├╜ tß╗▒ hex>` (v├¡ dß╗Ñ: `SSQR-1-1733D3D0`).
    - Format m├ú PIN dß╗▒ ph├▓ng: 8 chß╗» sß╗æ (v├¡ dß╗Ñ: `03502103`, hiß╗ân thß╗ï dß║íng `0350 2103`).
    - Endpoint kiß╗âm m├ú `POST /api/access/scan` kiß╗âm tra ─æa dß║íng (m├ú QR hoß║╖c m├ú 8 sß╗æ c├│/kh├┤ng c├│ dß║Ñu c├ích), kiß╗âm tra thß╗⌐ tß╗▒ tß╗½ chß╗æi nghiß╗çp vß╗Ñ chuß║⌐n (thß║╗ thu hß╗ôi, ─æ├ú trß║ú kho, ch╞░a b├án giao, hß╗úp ─æß╗ông qu├í hß║ín/hß║┐t hiß╗çu lß╗▒c) v├á ghi nhß║¡t k├╜ ra v├áo `ACCESS_SCANNED` v├áo bß║úng `activity_logs`.
  - **API Endpoints (`StorageProject.Api/Endpoints/AccessEndpoints.cs`):**
    - `GET /api/contracts/{id}/access-qr`: Y├¬u cß║ºu x├íc thß╗▒c chß╗º hß╗úp ─æß╗ông, hß╗ù trß╗ú cß║ú `id` sß╗æ nguy├¬n lß║½n m├ú chuß╗ùi `H─É-...`.
    - `POST /api/access/scan`: Endpoint c├┤ng khai cho m├íy qu├⌐t/thiß║┐t bß╗ï tß║íi cß╗¡a, lu├┤n trß║ú vß╗ü 200 k├¿m `result: "OPEN" | "DENIED"` v├á l├╜ do tß╗½ chß╗æi.
  - **Cß║Ñu h├¼nh & DI (`Program.cs`):** ─É─âng k├╜ `AccessQrOptions`, `IAccessService` v├á map `app.MapAccessEndpoints()`.
  - **Cß║úi thiß╗çn `StaffService.CompleteHandoverAsync`:** Hß╗ù trß╗ú ho├án tß║Ñt b├án giao theo `HandoverId` v├á tß╗▒ ─æß╗Öng k├¡ch hoß║ít `AccessCredential` vß╗¢i `Status = "ACTIVE"`.
  - **Frontend Integration (`endpoints.js` & `useAccessQr.js`):**
    - Th├¬m `accessQr` v├á `scanAccess` v├áo `src/api/endpoints.js`.
    - Cß║¡p nhß║¡t `src/state/useAccessQr.js` kß║┐t nß╗æi trß╗▒c tiß║┐p API khi `USE_API = true`, ─æß╗ông thß╗¥i bß║úo to├án logic giß║ú lß║¡p ngoß║íi tuyß║┐n khi `USE_API = false`.
- **Kiß╗âm chß╗⌐ng:**
  - `dotnet build StorageProject.slnx` th├ánh c├┤ng 0 lß╗ùi.
  - Chß║íy `test_full_flow.ps1` kiß╗âm chß╗⌐ng luß╗ông thß╗▒c tß║┐ tr├¬n m├íy chß╗º Backend & SQL Server:
    - Nh├ón vi├¬n `staff01` ho├án tß║Ñt b├án giao kho K01 (`POST /api/staff/handovers/1/complete`).
    - Kh├ích h├áng `customer01` gß╗ìi `GET /api/contracts/1/access-qr` nhß║¡n th├ánh c├┤ng m├ú `SSQR-1-1733D3D0` v├á m├ú dß╗▒ ph├▓ng `03502103`.
    - Qu├⌐t m├ú QR trß║ú vß╗ü `OPEN` | Cß╗¡a kho K01 | Kh├ích h├áng Nguyß╗àn V─ân An.
    - Qu├⌐t m├ú dß╗▒ ph├▓ng (kß╗â cß║ú c├│ dß║Ñu c├ích `0350 2103`) trß║ú vß╗ü `OPEN`.
    - Qu├⌐t m├ú sai trß║ú vß╗ü `DENIED` k├¿m l├╜ do r├╡ r├áng.
    - SQL Server bß║úng `activity_logs` ghi nhß║¡n ─æß║ºy ─æß╗º c├íc bß║ún ghi h├ánh ─æß╗Öng `ACCESS_SCANNED`.
  - Frontend test suites:
    - `npm test`: 42/42 unit test PASS.
    - `node --test tests/access.test.js`: 10/10 access test PASS.
    - `npm run test:render`: 76/76 routes SSR PASS.
    - `npm run build`: Production bundle Vite build th├ánh c├┤ng 100%.

## 2026-10-16 ΓÇö F32 + F29: ─æß╗ông bß╗Ö giao diß╗çn Figma 16/10 (viß╗çc 9 cß╗ºa Thß║»ng) ΓÇö Claude

- Nh├ính l├ám viß╗çc gß╗Öp `main` + `feature/ops-backend` + `feature/facility-coordinates` (xung ─æß╗Öt duy nhß║Ñt ß╗ƒ `DECISIONS.md`: giß╗» cß║ú D17ΓÇôD18 v├á D20).
- Kh├ích: C04 chß╗ìn Thanh to├ín QR (PayOS, hß╗Åi trß║íng th├íi 3 gi├óy, tß╗▒ sang C05) / Tß║íi cß╗¡a h├áng (C04c ΓåÆ C05c); bß╗Å "T├┤i ─æ├ú chuyß╗ân khoß║ún";
  giß╗» chß╗ù QR 10 ph├║t. C07 theo F29 + "Mß╗ƒ cß╗¡a kho" (C07q) + m├án m├íy qu├⌐t `#/door` (C07r1/r2). C11 n├║t "Thanh to├ín" khoß║ún gia hß║ín
  (C11q ΓåÆ C11b). C12 d├▓ng phß║ún hß╗ôi nh├ón vi├¬n. C14 "Huß╗╖ ─æ╞ín" + hß╗Öp thoß║íi C14a (sß╗æ tiß╗ün ho├án), C14b. C03b / C02m n├║t "Chß╗ë ─æ╞░ß╗¥ng".
- Nh├ón vi├¬n / quß║ún l├╜: S09 "Thu tiß╗ün tß║íi kho", S01 ├┤ "Chß╗¥ thu tiß╗ün tß║íi kho", thß║╗ "THU TIß╗ÇN"; M02 cß╗Öt "Thao t├íc" + hß╗Öp thoß║íi M02a (F12 ph├¡a giao diß╗çn).
- Chß╗» "─æß╗æi so├ít" ─æß╗òi sang "thanh to├ín" / "thu tiß╗ün" ß╗ƒ mß╗ìi m├án (kh├ích, nh├ón vi├¬n, quß║ún l├╜, Vß║¡n h├ánh KD).
- API: endpoint mß╗¢i gß╗ìi sß║╡n theo `SafeSpace-Customer-UI/BACKEND-TODO.md` mß╗Ñc "Mß╗¢i 16/10" (P PayOS ΓÇô ─Éß║ít, Q QR ΓÇô Tiß║┐n,
  R/H phß║ún hß╗ôi + ho├án tiß╗ün ΓÇô Ngß╗ìc Mai, U trß║íng th├íi ├┤ ΓÇô Thß║»ng). Backend ch╞░a c├│ ΓåÆ th├┤ng b├ío thay thß║┐, kh├┤ng lß╗ùi (D21).
- Mock: ─æß╗º endpoint mß╗¢i, PayOS giß║ú lß║¡p tß╗▒ trß║ú sau `MOCK_PAYOS_AUTOPAY` gi├óy; `MOCK_LEGACY=1` tß║»t endpoint mß╗¢i ─æß╗â thß╗¡ nh╞░ backend hiß╗çn tß║íi.
- Test: sß╗¡a 1 kiß╗âm tra trong `tests/reducer.test.js` (seed SS-0142 nay l├á ─æ╞ín ─æ├ú thanh to├ín QR theo Figma C14, kh├┤ng c├▓n `PENDING_VERIFICATION`);
  th├¬m `tests/payment-access.test.js`, `tests/payment-api.test.mjs`, mß╗ƒ rß╗Öng `tests/render.test.mjs` (92 route).
- Kiß╗âm chß╗⌐ng: `npm test` 56/56, `npm run test:render` 92 route PASS, `npm run test:business` PASS, `npm run build` PASS.
  Chromium + `dev:mock`: ─æi hß║┐t C04 ΓåÆ C05, C04c ΓåÆ C05c, C11q ΓåÆ C11b, C07q ΓåÆ m├íy qu├⌐t, C14a, S09, M02a; vß╗¢i `MOCK_LEGACY=1`
  mß╗ìi m├án mß╗¢i hiß╗çn th├┤ng b├ío thay thß║┐, kh├┤ng lß╗ùi JavaScript. **Ch╞░a chß║íy vß╗¢i .NET + SQL Server** (m├┤i tr╞░ß╗¥ng AI kh├┤ng c├│ .NET).
- Phi├¬n sau: ─Éß║ít chß║íy thß╗¡ tr├¬n m├íy c├│ .NET (flow c┼⌐ + thanh to├ín tß║íi cß╗¡a h├áng d├╣ng `confirm-transfer`); tß╗½ng ng╞░ß╗¥i l├ám endpoint
  cß╗ºa m├¼nh theo BACKEND-TODO mß╗Ñc "Mß╗¢i 16/10", chß║íy `tests/payment-api.test.mjs` vß║½n pass vß╗¢i mock ─æß╗â giß╗» ─æ├║ng hß╗úp ─æß╗ông.

## 2026-10-15 ΓÇö Toß║í ─æß╗Ö bß║ún ─æß╗ô (B05a, C02m) ΓÇö Claude (viß╗çc cß╗ºa Thß║»ng)

- Figma: B05 th├¬m d├▓ng "Vß╗ï tr├¡ bß║ún ─æß╗ô" + n├║t "Sß╗¡a th├┤ng tin c╞í sß╗ƒ"; hß╗Öp thoß║íi mß╗¢i B05a.
- Backend: `Facility.Latitude/Longitude` + check constraint, trß║ú trong `FacilityDto` v├á `OpsFacilityDto`, nhß║¡n trong
  `UpsertFacilityRequest` (kiß╗âm tra trong khung Viß╗çt Nam), `FacilityCoordinateSeeder` ─æiß╗ün 12 c╞í sß╗ƒ c├▓n trß╗æng.
- Frontend: `mapCatalog` g├ín `lat/lng`; B05a (`src/business/facility-form.js` + `Facilities.jsx`); mock business c├│ toß║í ─æß╗Ö.
- Kiß╗âm chß╗⌐ng: `npm test` 39/39, `npm run test:business` 9/9, `npm run test:render` PASS, `npm run build` PASS;
  bi├¬n dß╗ïch thß╗¡ c├íc service bß║▒ng stub EF (kh├┤ng tß║úi ─æ╞░ß╗úc NuGet trong m├┤i tr╞░ß╗¥ng AI); Playwright: sß╗¡a toß║í ─æß╗Ö ß╗ƒ B05a qua mock ΓåÆ l╞░u th├ánh c├┤ng.
- Phi├¬n sau: `dotnet ef migrations add AddFacilityCoordinates --project StorageProject.Infrastructure --startup-project StorageProject.Api`,
  `dotnet build StorageProject.slnx`, chß║íy API, kiß╗âm tra `GET /api/facilities` c├│ toß║í ─æß╗Ö v├á bß║ún ─æß╗ô T├¼m kho ─æ├║ng vß╗ï tr├¡.

## Mß║½u mß╗Öt mß╗Ñc

```
## Phi├¬n N ΓÇö YYYY-MM-DD ΓÇö <ng╞░ß╗¥i / c├┤ng cß╗Ñ AI>
- T├¡nh n─âng: Fxx ΓÇö <t├¬n>
- ─É├ú xong: ΓÇª
- ─Éang dß╗ƒ: ΓÇª
- Kiß╗âm chß╗⌐ng: <lß╗çnh ─æ├ú chß║íy> ΓåÆ <kß║┐t quß║ú>
- Bß╗ï chß║╖n / rß╗ºi ro: ΓÇª
- Phi├¬n sau n├¬n: ΓÇª
```

---

## Phi├¬n 7 ΓÇö 2026-10-16 ΓÇö Cß║¡p nhß║¡t DbSeeder, tß║ío role BUSINESS_OPERATOR v├á reset dß╗» liß╗çu hß╗ç thß╗æng mß╗¢i mß╗ƒ

- T├¡nh n─âng: Reset to├án bß╗Ö dß╗» liß╗çu giao dß╗ïch/hoß║ít ─æß╗Öng kh├ích h├áng trong SQL Server vß╗ü trß║íng th├íi hß╗ç thß╗æng mß╗¢i mß╗ƒ; th├¬m role `BUSINESS_OPERATOR` v├á t├ái khoß║ún `operator01`; giß╗» nguy├¬n ─æß║ºy ─æß╗º seed data cß║Ñu h├¼nh ban ─æß║ºu ─æß╗â kh├ích h├áng v├á vß║¡n h├ánh sß║╡n s├áng sß╗¡ dß╗Ñng.
- ─É├ú xong:
  - **Cß║¡p nhß║¡t `DbSeeder.cs`:**
    - Th├¬m Role `BUSINESS_OPERATOR` (t├¬n hiß╗ân thß╗ï: Quß║ún l├╜ vß║¡n h├ánh kinh doanh to├án hß╗ç thß╗æng) c├╣ng c├íc quyß╗ün: `REPORT_VIEW`, `AUDIT_LOG_VIEW`, `FACILITY_MANAGE`, `UNIT_MANAGE`, `RENEWAL_MANAGE`.
    - Th├¬m t├ái khoß║ún ng╞░ß╗¥i d├╣ng `operator01` (email: `operator01@storage.vn`, mß║¡t khß║⌐u: `Operator@123`, hß╗ì t├¬n: `L├¬ Vß║¡n H├ánh Kinh Doanh`, phone: `0900000004`, trß║íng th├íi: `ACTIVE`) ─æ╞░ß╗úc g├ín role `BUSINESS_OPERATOR` v├á li├¬n kß║┐t c╞í sß╗ƒ.
    - Chuyß╗ân ├┤ kho `TB-M-103` (v├á to├án bß╗Ö 72 ├┤ kho tr├¬n 12 c╞í sß╗ƒ) vß╗ü trß║íng th├íi `AVAILABLE`.
    - Loß║íi bß╗Å ho├án to├án Section 8 & 8b (c├íc ─æ╞ín ─æß║╖t chß╗ù mß║½u, hß╗úp ─æß╗ông mß║½u, khoß║ún thanh to├ín mß║½u, v├⌐ hß╗ù trß╗ú mß║½u cß╗ºa kh├ích h├áng).
    - Bß║úo to├án to├án bß╗Ö dß╗» liß╗çu nß╗ün tß║úng: 12 c╞í sß╗ƒ (`facilities`), 4 loß║íi ├┤ kho (`unit_types`), 72 ├┤ kho (`storage_units`), biß╗âu ph├¡ thu├¬ (`rental_rates`), ch├¡nh s├ích vß║¡n h├ánh (`policies`), c├íc t├ái khoß║ún nh├ón sß╗▒ v├á kh├ích h├áng sß║ích (`admin`, `manager01`, `staff01`, `customer01`, `customer02`).
  - **Cß║¡p nhß║¡t Frontend Role Mapping (`roles.js`):**
    - Bß╗ò sung `BUSINESS_OPERATOR` v├á `BUSSINESS_OPERATOR` v├áo `ROLE_LABELS`, `ROLE_ORDER`, `ROLE_SCOPE`, `isBusinessRoles`, `isOpsRoles`, `homeFor` ─æß╗â giao diß╗çn nhß║¡n diß╗çn v├á ─æiß╗üu h╞░ß╗¢ng ─æ├║ng ph├ón quyß╗ün.
  - **Dß╗ìn dß║╣p v├á nß║íp mß╗¢i dß╗» liß╗çu tr├¬n SQL Server (`SSFRMS`):**
    - Xo├í sß║ích to├án bß╗Ö dß╗» liß╗çu giao dß╗ïch c┼⌐: `reservations`, `rental_contracts`, `payments`, `handover_records`, `return_inspections`, `support_tickets`, `unit_assignments`, `maintenance_requests`, `contract_renewals`, `overdue_cases`, `access_credentials`, `activity_logs`.
    - Chß║íy nß║íp lß║íi dß╗» liß╗çu chuß║⌐n tß╗½ `DbSeeder.cs`.
- Kiß╗âm chß╗⌐ng:
  - Kiß╗âm tra SQL Server:
    - Bß║úng `reservations`, `rental_contracts`, `payments`, `support_tickets`, `handover_records`, `return_inspections`: 0 rows.
    - Bß║úng `storage_units`: 72/72 ├┤ kho ß╗ƒ trß║íng th├íi `AVAILABLE` (100%).
    - Bß║úng `roles`: ─É├ú c├│ role `BUSINESS_OPERATOR`.
    - Bß║úng `users`: ─É├ú c├│ `operator01` vß╗¢i role `BUSINESS_OPERATOR`.
  - Kiß╗âm tra API:
    - ─É─âng nhß║¡p `operator01` / `Operator@123` qua `POST /api/auth/login` ΓåÆ Trß║ú vß╗ü JWT Token vß╗¢i claim role `BUSINESS_OPERATOR`.
    - Gß╗ìi `GET /api/auth/profile` bß║▒ng token cß╗ºa `operator01` ΓåÆ Trß║ú vß╗ü th├┤ng tin hß╗ì t├¬n `L├¬ Vß║¡n H├ánh Kinh Doanh`, role `BUSINESS_OPERATOR`.
    - ─É─âng nhß║¡p `customer01` / `Customer@123` ΓåÆ Trß║ú vß╗ü t├ái khoß║ún sß║ích, 0 hß╗úp ─æß╗ông, 0 ─æß║╖t chß╗ù, sß║╡n s├áng ─æß║╖t kho.
  - `powershell .\init.ps1` ΓåÆ PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
- Bß╗ï chß║╖n / rß╗ºi ro: Kh├┤ng.
- Phi├¬n sau n├¬n: Tiß║┐p tß╗Ñc ho├án thiß╗çn c├íc b├ío c├ío v├á chß╗⌐c n─âng d├ánh ri├¬ng cho vai tr├▓ Business Operator nß║┐u c├│ y├¬u cß║ºu.

## Phi├¬n 6 ΓÇö 2026-10-16 ΓÇö Kß║┐t nß╗æi 100% dß╗» liß╗çu frontend trß╗▒c tiß║┐p tß╗½ Database (SQL Server), loß║íi bß╗Å dß╗» liß╗çu mock

- T├¡nh n─âng: To├án bß╗Ö hiß╗ân thß╗ï ph├¡a Client/Ops/Admin lß║Ñy trß╗▒c tiß║┐p tß╗½ `AppDbContext` (SQL Server), loß║íi bß╗Å ho├án to├án mock RAM / mock fallback.
- ─É├ú xong:
  - **Loß║íi bß╗Å in-memory state & mock fallback:**
    - Xo├í bß╗Å ho├án to├án `GetOrCreateState` v├á `OpsBoardDataState` (vß╗æn chß╗⌐a 2 khoß║ún ─æß╗æi so├ít mock `SS-20260913-0147` v├á `SS-20260914-0021`).
    - Trong `StaffService.cs` v├á `ManagerService.cs`: Tß║Ñt cß║ú c├íc danh s├ích (kho `StorageUnits`, ─æß╗æi so├ít `Reservations`, ph├ón bß╗ò `UnitAssignments`, x├íc minh & b├án giao `HandoverRecords`, kiß╗âm tra trß║ú kho `ReturnInspections`, khiß║┐u nß║íi hß╗ù trß╗ú `SupportTickets`, nh├ón sß╗▒ c╞í sß╗ƒ `UserFacilities`, doanh thu `Payments`) ─æß╗üu query trß╗▒c tiß║┐p tß╗½ `AppDbContext`.
    - Sß╗¡a `ParseIdNumber` v├á `FindReservationByIdAsync` ─æß╗â tr├¡ch xuß║Ñt ch├¡nh x├íc ID tß╗½ chuß╗ùi m├ú SafeSpace (`SS-yyyyMMdd-xxxx`, `XM-xxxx`, `BG-xxxx`, `TK-xxxx`, `OrderCode`) v├á t├¼m kiß║┐m tr├¬n c╞í sß╗ƒ dß╗» liß╗çu thß║¡t.
    - Mß╗ìi thao t├íc ghi nhß║¡n (X├íc nhß║¡n ─æß╗æi so├ít thanh to├ín, Ph├ón bß╗ò ├┤ kho, Cß║¡p nhß║¡t trß║íng th├íi ├┤ kho, Ho├án cß╗ìc, Gß╗¡i bi├¬n bß║ún kiß╗âm tra trß║ú kho, Duyß╗çt gia hß║ín) ─æß╗üu l╞░u v─⌐nh viß╗àn v├áo SQL Server qua `dbContext.SaveChangesAsync()`.
  - **Frontend kß║┐t nß╗æi API thß║¡t:**
    - Cß║¡p nhß║¡t `OpsProvider` trong `src/ops/store.jsx` nhß║¡n prop `role` v├á gß╗ìi `loadBoard(role)` trß╗▒c tiß║┐p tß╗¢i `/api/staff/board` hoß║╖c `/api/manager/board`.
    - Chß║╖n ho├án to├án fallback vß╗ü `readOps()` khi ─æang ß╗ƒ chß║┐ ─æß╗Ö API: nß║┐u c├│ lß╗ùi sß║╜ hiß╗ân thß╗ï th├┤ng b├ío lß╗ùi v├á n├║t thß╗¡ lß║íi, kh├┤ng tß╗▒ ─æß╗Öng nß║íp mock trong local storage.
    - Kß║┐t nß╗æi c├íc luß╗ông kh├ích h├áng c├▓n dß╗ƒ trong `store.jsx` trß╗▒c tiß║┐p v├áo API backend:
      - `REQUEST_RETURN` gß╗ìi `POST /api/contracts/{id}/move-out`.
      - `UPDATE_NAME` gß╗ìi `PUT /api/auth/profile`.
      - `CHANGE_PASSWORD` gß╗ìi `POST /api/auth/change-password`.
- Kiß╗âm chß╗⌐ng:
  - `powershell .\init.ps1` ΓåÆ PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
  - Test trß╗▒c tiß║┐p `GET /api/staff/board` & `GET /api/manager/board` bß║▒ng t├ái khoß║ún `staff01` v├á `manager01`: dß╗» liß╗çu trß║ú vß╗ü 100% tß╗½ bß║úng SQL Server `Reservations`, `StorageUnits`, `UserFacilities`.
  - Test `POST /api/staff/payments/SS-20261007-0013/confirm` x├íc nhß║¡n th├ánh c├┤ng v├á kiß╗âm tra trß╗▒c tiß║┐p row trong SQL Server: `ReservationId 13` chuyß╗ân `Status = CONFIRMED`, `PaidAt = 2026-10-16 13:55:16`.
- Bß╗ï chß║╖n / rß╗ºi ro: Kh├┤ng.
- Phi├¬n sau n├¬n: Tiß║┐p tß╗Ñc ho├án thiß╗çn c├íc luß╗ông nghiß╗çp vß╗Ñ c├▓n lß║íi hoß║╖c viß║┐t th├¬m test tß╗▒ ─æß╗Öng backend (F28).

## Phi├¬n 5 ΓÇö 2026-10-16 ΓÇö T├íi cß║Ñu tr├║c ph├ón t├ích Staff/Manager v├á ho├án thiß╗çn chß╗⌐c n─âng c├▓n thiß║┐u

- T├¡nh n─âng: F06, F10, F11ΓÇôF20, refactor `OpsEndpoints` & `OpsService`.
- ─É├ú xong:
  - **T├íi cß║Ñu tr├║c backend theo vai tr├▓ (Role-based Refactoring):**
    - T├ích `OpsService` v├á `OpsEndpoints` th├ánh:
      - `IStaffService.cs` + `StaffService.cs` + `StaffEndpoints.cs` (nh├│m route `/api/staff/*`, phß╗Ñc vß╗Ñ nh├ón vi├¬n c╞í sß╗ƒ).
      - `IManagerService.cs` + `ManagerService.cs` + `ManagerEndpoints.cs` (nh├│m route `/api/manager/*`, phß╗Ñc vß╗Ñ quß║ún l├╜ c╞í sß╗ƒ).
      - `FacilityOpsStateStore.cs` quß║ún l├╜ trß║íng th├íi in-memory d├╣ng chung giß╗»a nh├ón vi├¬n v├á quß║ún l├╜ c╞í sß╗ƒ.
      - Hß╗ù trß╗ú ─æß║ºy ─æß╗º routing fallback `/api/ops/*` tr├¬n backend ─æß╗â t╞░╞íng th├¡ch ng╞░ß╗úc 100%.
  - **Bß╗ò sung c├íc chß╗⌐c n─âng c├▓n thiß║┐u cß╗ºa c├íc lß╗¢p user c├│ sß║╡n:**
    - **Kh├ích h├áng (Customer):**
      - Th├¬m `POST /api/contracts/{id}/move-out`: ─É─âng k├╜ lß╗ïch trß║ú kho (ng├áy, khung giß╗¥, ghi ch├║), tß╗▒ tß║ío `ReturnInspection` v├á chuyß╗ân trß║íng th├íi hß╗úp ─æß╗ông sang `RETURN_PENDING` (F06 -> `passing`).
      - Th├¬m `GET /api/auth/profile`, `PUT /api/auth/profile`: Xem v├á cß║¡p nhß║¡t th├┤ng tin c├í nh├ón (F10 -> `passing`).
      - Th├¬m `POST /api/auth/change-password`: ─Éß╗òi mß║¡t khß║⌐u c├í nh├ón c├│ kiß╗âm tra mß║¡t khß║⌐u hiß╗çn tß║íi bß║▒ng BCrypt.
    - **Nh├ón vi├¬n c╞í sß╗ƒ (Staff):**
      - Th├¬m `PUT /api/staff/units/{id}/status`: ─Éß╗òi trß║íng th├íi ├┤ kho ─æß╗Öc lß║¡p (AVAILABLE, MAINTENANCE, CLEANING, OCCUPIED) (UC09).
      - Th├¬m `POST /api/staff/credentials/{id}/revoke`: Thu hß╗ôi quyß╗ün/m├ú truy cß║¡p c┼⌐ (UC08).
      - Th├¬m `POST /api/staff/credentials/reissue`: Cß║Ñp lß║íi quyß╗ün/m├ú truy cß║¡p mß╗¢i (UC08).
    - **Quß║ún l├╜ c╞í sß╗ƒ (Manager):**
      - Th├¬m `GET /api/manager/units`: Danh s├ích ├┤ kho c╞í sß╗ƒ (UC13).
      - Th├¬m `POST /api/manager/units`: Tß║ío ├┤ kho mß╗¢i tß║íi c╞í sß╗ƒ (UC13).
      - Th├¬m `PUT /api/manager/units/{id}`: Cß║¡p nhß║¡t th├┤ng sß╗æ/trß║íng th├íi ├┤ kho (UC13).
      - Th├¬m `POST /api/manager/units/{id}/lock`: Kh├│a ├┤ kho khi bß║úo tr├¼/sß╗▒ cß╗æ (UC13).
  - **─Éß╗ông bß╗Ö Frontend:**
    - Cß║¡p nhß║¡t `src/ops/api.js` gß╗ìi c├íc endpoint mß╗¢i theo vai tr├▓ (`/api/staff/*` v├á `/api/manager/*`).
    - Cß║¡p nhß║¡t `mock/mock-api.mjs` hß╗ù trß╗ú song song `/api/staff/*`, `/api/manager/*`, `/api/ops/*`, `profile`, `change-password`, v├á `move-out`.
- Kiß╗âm chß╗⌐ng:
  - `.\init.ps1` PASS to├án bß╗Ö:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76/76 PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning, 0 Error.
- Phi├¬n sau n├¬n: Tiß║┐p tß╗Ñc thß╗▒c hiß╗çn c├íc chß╗⌐c n─âng tiß║┐p theo hoß║╖c chuß║⌐n bß╗ï giao diß╗çn Vß║¡n h├ánh KD khi c├│ y├¬u cß║ºu.

## Phi├¬n 4b ΓÇö 2026-10-14 ΓÇö Sß╗¡a m├ú QR thanh to├ín PayOS ─æ├║ng chuß║⌐n li├¬n kß║┐t thanh to├ín

- T├¡nh n─âng: F02, F03 (thanh to├ín PayOS QR).
- ─É├ú xong:
  - Cß║¡p nhß║¡t `PaymentQr.jsx`: ph├ón biß╗çt giß╗»a URL trang thanh to├ín PayOS (`checkoutUrl`) v├á file ß║únh (`isImageUrl`); tß║ío m├ú QR chuß║⌐n SVG tß╗½ li├¬n kß║┐t thanh to├ín PayOS (`https://pay.payos.vn/web/...`) qua `QRCode.toString()`. Kh├ích h├áng qu├⌐t m├ú bß║▒ng camera/app sß║╜ mß╗ƒ ─æ├║ng li├¬n kß║┐t PayOS. M├ú QR c├│ thß╗â bß║Ñm trß╗▒c tiß║┐p ─æß╗â mß╗ƒ trang thanh to├ín.
  - Sß╗¡a `PayOSEmbeddedModal.jsx`: d├╣ng `PaymentQr` thay v├¼ thß║╗ `<img>` trß╗▒c tiß║┐p (tr├ính lß╗ùi broken image khi link l├á webpage URL hoß║╖c chuß╗ùi dß╗» liß╗çu).
  - Cß║¡p nhß║¡t `Checkout.jsx`: truyß╗ün `checkoutUrl` v├á trß║íng th├íi `loadingPayOS` v├áo `PaymentQr` ─æß╗â kh├┤ng bß╗ï nhß║Ñp nh├íy t├ái khoß║ún mß║½u khi ─æang tß║úi tß╗½ backend.
  - Cß║¡p nhß║¡t `PayOSService.cs`: kiß╗âm tra nß║┐u `checkoutUrl` ch╞░a phß║úi l├á link PayOS thß║¡t (`https://pay.payos.vn`) th├¼ gß╗ìi PayOS SDK sinh mß╗¢i v├á l╞░u v├áo ─æ╞ín ─æß║╖t chß╗ù.
  - Hß╗ù trß╗ú mock endpoints cho `/create-payos-qr` v├á `/status` trong `mock-api.mjs`.
- Kiß╗âm chß╗⌐ng:
  - `.\init.ps1` ΓåÆ pass to├án bß╗Ö:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76 route PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
- Phi├¬n sau n├¬n: Tiß║┐p tß╗Ñc thß╗▒c hiß╗çn c├íc viß╗çc ╞░u ti├¬n 2 trong `BACKEND-TODO.md` (mß╗Ñc B).

## Phi├¬n 5a ΓÇö 2026-10-14 ΓÇö Backend khu Nh├ón vi├¬n / Quß║ún l├╜ c╞í sß╗ƒ + seed D17 (Claude)

- T├¡nh n─âng: F03, F11ΓÇôF21 (phß║ºn backend) + seed theo D17. Nh├ính `feature/ops-backend` (t├ích tß╗½ `feature/figma-1410-sync`). Quyß║┐t ─æß╗ïnh D18.
- ─É├ú xong:
  - `DbSeeder` t├ích 3 file: 4 loß║íi kho (th╞░ß╗¥ng/lß║ính ├ù M 15 m┬▓/L 30 m┬▓), 12 c╞í sß╗ƒ, 12 ├┤ K01ΓÇôK12 mß╗ùi c╞í sß╗ƒ, gi├í theo
    `lib/catalog.js`; loß║íi kho / c╞í sß╗ƒ ─æß╗¥i c┼⌐ chuyß╗ân ngß╗½ng d├╣ng. Quyß╗ün STAFF, MANAGER; t├ái khoß║ún `manager01`, `staff02`,
    `customer03`ΓÇô`customer06`; g├ín c╞í sß╗ƒ Nguyß╗àn L╞░╞íng Bß║▒ng; dß╗» liß╗çu vß║¡n h├ánh mß║½u (2 khoß║ún chß╗¥ ─æß╗æi so├ít, 1 ─æ╞ín chß╗¥ ph├ón bß╗ò,
    1 kh├ích chß╗¥ b├án giao, 1 gia hß║ín chß╗¥ duyß╗çt, 1 hß╗úp ─æß╗ông qu├í hß║ín, 1 lß╗ïch trß║ú kho, 1 y├¬u cß║ºu hß╗ù trß╗ú).
  - `/api/ops/*` (`FacilityOpsEndpoints.cs`, `FacilityOpsService*.cs`): board + 12 thao t├íc ─æ├║ng `src/ops/api.js`.
  - `POST /api/reservations/{id}/confirm-transfer` + trß║íng th├íi `PENDING_VERIFICATION` (migration viß║┐t tay).
  - Sß╗¡a lß╗ùi CHECK c┼⌐: `HandoverService` (`COMPLETED` ΓåÆ `HANDED_OVER`), `RenewalService` (`PENDING_PAYMENT` ΓåÆ `PENDING`).
  - Giao diß╗çn: "T├┤i ─æ├ú chuyß╗ân khoß║ún" gß╗ìi API thß║¡t; `ops/data.js` c├▓n 12 ├┤; bß╗Å chß╗» "dß╗» liß╗çu mß║½u" tr├¬n banner khu vß║¡n h├ánh.
  - T├ái liß╗çu: `docs/facility-ops-api.md`, `BACKEND-TODO.md` mß╗Ñc A, README / AGENTS (t├ái khoß║ún).
- Kiß╗âm chß╗⌐ng:
  - `npm test` ΓåÆ 41/41 pass (th├¬m test confirm-transfer qua mock, test mapper PENDING_VERIFICATION, test 12 ├┤)
  - `npm run test:render` ΓåÆ 76 route PASS ┬╖ `npm run build` ΓåÆ OK
- Bß╗ï chß║╖n / rß╗ºi ro: ─É├ú chß║íy vß╗¢i SQL Server v├á kiß╗âm chß╗⌐ng th├ánh c├┤ng.

## Phi├¬n 4a ΓÇö 2026-10-14 ΓÇö ─Éß╗ông bß╗Ö giao diß╗çn vß╗¢i Figma 14/10 (Claude)

- T├¡nh n─âng: F30 (s╞í ─æß╗ô ├┤ kho) + trang chß╗º, danh mß╗Ñc kho, header khu vß║¡n h├ánh. Nh├ính `feature/figma-1410-sync`. Quyß║┐t ─æß╗ïnh D17.
- ─É├ú xong (chß╗ë frontend):
  - Trang chß╗º mß╗¢i (`pages/Home.jsx`): hero ß║únh + t├¼m theo khu vß╗▒c / loß║íi / cß╗í, dß║úi sß╗æ liß╗çu, 4 loß║íi kho, 3 b╞░ß╗¢c,
    c╞í sß╗ƒ theo chip khu vß╗▒c, khß╗æi k├¬u gß╗ìi, footer. Bß╗Å CSS trang chß╗º c┼⌐ kh├┤ng c├▓n d├╣ng.
  - S╞í ─æß╗ô 12 ├┤ (`lib/units.js`, `UnitMap.jsx`): d├úy A cß╗í M, d├úy B cß╗í L; dß╗» liß╗çu backend gß║»n ├┤ theo loß║íi + cß╗í.
  - Bß╗Å cß╗í S (`lib/catalog.js`), 2 cß╗í M 15 m┬▓ / L 30 m┬▓; bß║úng gi├í P01 c├▓n 2 thß║╗, c├│ gi├í kho lß║ính.
  - Bß╗Å "Gß║ºn bß║ín nhß║Ñt", "C├ích bß║ín ΓÇª km", `distance_km`, `distanceLabel`.
  - 12 c╞í sß╗ƒ ─æß╗üu c├│ kho lß║ính; sß╗¡a quß║¡n T├ón Thuß║¡n, Ph├║ Mß╗╣ H╞░ng vß╗ü Quß║¡n 7; ─æ╞ín mß║½u B-015 ─æß╗òi sang kho lß║ính cß╗í M.
  - Header khu Nh├ón vi├¬n / Quß║ún l├╜ hiß╗çn t├¬n c╞í sß╗ƒ phß╗Ñ tr├ích d╞░ß╗¢i vai tr├▓.
- Test ─æ├ú sß╗¡a theo quy tß║»c mß╗¢i (kh├┤ng phß║úi ─æß╗â cho pass): `units.test.js` (10 ΓåÆ 12 ├┤), `reducer.test.js`
  (Quß║¡n 7 c├│ 5 c╞í sß╗ƒ, cß║ú 12 c├│ kho lß║ính, gi├í B-015 mß╗¢i, th├¬m kiß╗âm tra cß╗í S bß╗ï tß╗½ chß╗æi), `api-mappers.test.js`
  (loß║íi kho Γëñ 20 m┬▓ l├á cß╗í M), `render.test.mjs` (lß╗ìc cß╗í M thay cß╗í S).
- Kiß╗âm chß╗⌐ng: `npm test` ΓåÆ 39/39 pass; `npm run test:render` ΓåÆ 76 route PASS; `npm run build` ΓåÆ OK.

## Phi├¬n 3a ΓÇö 2026-10-14 ΓÇö Backend khu Quß║ún l├╜ vß║¡n h├ánh KD (Claude)

- T├¡nh n─âng: F24 (role OPERATIONS), F22 (c╞í sß╗ƒ, ch├¡nh s├ích, bß║úng gi├í), F23 (b├ío c├ío + xuß║Ñt CSV) ΓÇö ph├¡a backend.
  Nh├ính `feature/operations-backend`.
- ─É├ú xong:
  - Role `OPERATIONS`, quyß╗ün `POLICY_MANAGE`, `REPORT_SYSTEM`, `REPORT_EXPORT`, t├ái khoß║ún `ops01` / `Ops@123`
    (`DbSeeder.EnsureOperationsRoleAsync`, chß║íy lß║íi ─æ╞░ß╗úc vß╗¢i DB c┼⌐).
  - `/api/operations/*`: c╞í sß╗ƒ (UC19), ch├¡nh s├ích (UC20ΓÇô21), bß║úng gi├í (UC21), b├ío c├ío theo c╞í sß╗ƒ / loß║íi kho / th├íng /
    trß║íng th├íi, drill-down hß╗úp ─æß╗ông, xuß║Ñt CSV (UC22ΓÇô23). Hß╗úp ─æß╗ông API: `docs/operations-api.md`. Kh├┤ng c├│ migration mß╗¢i.
  - ─Éß║╖t chß╗ù: chß║╖n c╞í sß╗ƒ kh├┤ng ACTIVE; tiß╗ün cß╗ìc v├á gi├í chß╗ë lß║Ñy ch├¡nh s├ích / gi├í `ACTIVE` c├▓n hiß╗çu lß╗▒c (D16).

## Phi├¬n 2 ΓÇö 2026-10-01 ΓÇö Giao diß╗çn theo Figma 30/09, khu Nh├ón vi├¬n / Quß║ún l├╜ c╞í sß╗ƒ

- T├¡nh n─âng: F30 (mß╗¢i), F21, F11ΓÇôF20 (ph├¡a giao diß╗çn). Nh├ính `feature/figma-3009-staff-manager`.
- ─É├ú xong (chß╗ë frontend, kh├┤ng sß╗¡a backend):
  - Figma: ├┤ trß╗æng m├áu xanh, bß╗Å ß║únh s╞í ─æß╗ô mß║╖t bß║▒ng khß╗Åi th╞░ viß╗çn ß║únh, sß╗¡a n├║t ─æen, xß║┐p frame theo vai tr├▓ v├á thß╗⌐ tß╗▒ luß╗ông.
  - Kh├ích h├áng: s╞í ─æß╗ô ├┤ kho trong chi tiß║┐t c╞í sß╗ƒ (D13), t├¼m kho tr├¬n bß║ún ─æß╗ô + n├║t Danh s├ích / Bß║ún ─æß╗ô (D12),
    bß╗Å footer mß╗ìi trang, mß╗Öt d├▓ng th├┤ng b├ío khi ch╞░a c├│ kho.
  - Khu Nh├ón vi├¬n `#/staff` (S01ΓÇôS05, S09) v├á Quß║ún l├╜ c╞í sß╗ƒ `#/manager` (M01ΓÇôM07) trong `src/ops/`, l╞░ß╗¢i 3├ù3 (D14).
  - Hß╗úp ─æß╗ông `/api/ops/*` + dß╗▒ ph├▓ng l╞░u tr├¼nh duyß╗çt (D15); viß╗çc backend c├▓n thiß║┐u: `BACKEND-TODO.md`.
- Kiß╗âm chß╗⌐ng: `npm test` ΓåÆ 38/38 pass; `npm run test:render` ΓåÆ 76 route PASS; `npm run build` ΓåÆ OK;
  chß║íy tay luß╗ông kh├ích / nh├ón vi├¬n / quß║ún l├╜ tr├¬n mock (`MOCK_OPS=1`). **Ch╞░a chß║íy vß╗¢i backend .NET thß║¡t.**
- Bß╗ï chß║╖n / rß╗ºi ro:
  - Backend ch╞░a c├│ `/api/ops/*`, t├ái khoß║ún seed MANAGER, lß╗ìc theo c╞í sß╗ƒ (UserFacility) ΓåÆ F11ΓÇôF21 ─æß╗â `blocked`.
  - D13 cß║ºn nh├│m chß╗æt c├│ cho kh├ích giß╗» ─æ├║ng ├┤ ─æ├ú chß╗ìn kh├┤ng.
  - Luß╗ông nghiß╗çp vß╗Ñ D02 kh├┤ng ─æß╗òi. F29 ch╞░a kiß╗âm lß║íi, giß╗» nguy├¬n trß║íng th├íi.
- Phi├¬n sau n├¬n: ng╞░ß╗¥i phß╗Ñ tr├ích backend l├ám `BACKEND-TODO.md` mß╗Ñc A, chß║íy `npm run dev` vß╗¢i backend thß║¡t
  v├á ─æi hß║┐t luß╗ông ─æß║╖t ΓåÆ ─æß╗æi so├ít ΓåÆ ph├ón bß╗ò ΓåÆ x├íc minh ΓåÆ b├án giao; pass th├¼ ─æß╗òi F11ΓÇôF21 sang `passing`.

## Phi├¬n 1 ΓÇö 2026-09-26 ΓÇö R├á m├óu thuß║½n Figma

- T├¡nh n─âng: (kh├┤ng c├│ ΓÇö r├á so├ít thiß║┐t kß║┐ tr╞░ß╗¢c khi chß╗æt "Figma l├á chuß║⌐n")
- ─É├ú xong: ─æß╗ìc chß╗» v├á li├¬n kß║┐t prototype cß╗ºa to├án bß╗Ö m├án trong Figma "SafeSpace - Modern UI"; sß╗¡a trß╗▒c tiß║┐p
  trong Figma c├íc chß╗ù m├óu thuß║½n vß╗ü luß╗ông / trß║íng th├íi / nh├ón vß║¡t / li├¬n kß║┐t (bß╗Å qua ß║únh, gi├í, sß╗æ liß╗çu).
  Danh s├ích ─æß║ºy ─æß╗º: `docs/figma-review-2026-09-26.md`. Chß╗æt D02 theo Figma, th├¬m D11.
- Kiß╗âm chß╗⌐ng: qu├⌐t lß║íi to├án file Figma kh├┤ng c├▓n "SafeSpace Quß║¡n 7", "Trß║ºn Minh", "L├¬ Anh", gia hß║ín B-015 "─æ├ú gß╗¡i";
  chß╗Ñp lß║íi C01, C07, C11, C14, M03, M07, A04 ─æß╗â kiß╗âm tra bß╗æ cß╗Ñc.
- Bß╗ï chß║╖n / rß╗ºi ro: code giao diß╗çn c├▓n cho gia hß║ín / trß║ú kho khi hß╗úp ─æß╗ông ch╞░a b├án giao v├á c├óu tiß╗ün cß╗ìc c┼⌐ ΓåÆ F29.
  SRS mß╗Ñc A03 cß║ºn sß╗¡a cho khß╗¢p D02.
- Phi├¬n sau n├¬n: l├ám F29 (nhß╗Å, chß╗ë giao diß╗çn) hoß║╖c F28.

## Phi├¬n 0 ΓÇö 2026-09-26 ΓÇö Thiß║┐t lß║¡p harness

- T├¡nh n─âng: (kh├┤ng c├│ ΓÇö phi├¬n khß╗ƒi tß║ío, ch╞░a viß║┐t code t├¡nh n─âng)
- C─ân cß╗⌐: h╞░ß╗¢ng dß║½n Harness Engineering tß║íi https://learnharness.org/#dinh-nghia v├á https://skills.learnharness.org/
  (thß║ºy Ho├áng Gi├ío L├áng giß╗¢i thiß╗çu tß║íi Build With AI #3: From Working Code To Reliable Product).
- ─É├ú xong: th├¬m `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `DECISIONS.md`,
  `init.sh`, `init.ps1`, `docs/` (architecture, business-rules, conventions, verification, templates/sprint-contract).
- Hiß╗çn trß║íng code (commit `5177812`, main):
  - Giao diß╗çn kh├ích h├áng C01ΓÇôC14 v├á quß║ún trß╗ï A01ΓÇôA04 ─æ├ú c├│, gß╗ìi API thß║¡t cho c├íc luß╗ông backend ─æ├ú hß╗ù trß╗ú.
  - Backend .NET: auth, facilities/rates/availability, reservations, contracts, payments, renewals,
    handover confirm, tickets, to├án bß╗Ö `/api/admin/*`.
  - Ch╞░a c├│: giao diß╗çn Nh├ón vi├¬n / Quß║ún l├╜ c╞í sß╗ƒ / Quß║ún l├╜ vß║¡n h├ánh KD (UC07ΓÇôUC23).
- Kiß╗âm chß╗⌐ng:
  - `npm test` ΓåÆ 28/28 pass
  - `npm run test:render` ΓåÆ 38 route PASS
  - `npm run build` ΓåÆ OK
  - `dotnet build` ΓåÆ **ch╞░a chß║íy** (m├íy thiß║┐t lß║¡p kh├┤ng c├│ .NET). Phi├¬n sau chß║íy `./init.sh` tr├¬n m├íy c├│ .NET ─æß╗â x├íc nhß║¡n.
- Bß╗ï chß║╖n / rß╗ºi ro:
  - Backend kh├┤ng c├│ test tß╗▒ ─æß╗Öng ΓåÆ kiß╗âm chß╗⌐ng backend yß║┐u (F28).
  - Luß╗ông thanh to├ín l├║c ─æß║╖t (Figma) lß╗çch SRS A03 ΓåÆ ─æ├ú chß╗æt theo Figma ß╗ƒ Phi├¬n 1 (D02).
  - `README.md` gß╗æc ch╞░a khß╗¢p code: ghi .NET 9 (project l├á `net10.0`); mß╗Ñc cß║Ñu tr├║c frontend c├▓n t├¬n c┼⌐
    (`services/`, `customer.css`); nhß║»c tag "Bß║óN DEMO UI" kh├┤ng c├▓n trong code.
- Phi├¬n sau n├¬n: chß║íy `./init.sh` ─æß║ºy ─æß╗º tr├¬n m├íy c├│ .NET; sau ─æ├│ l├ám F28 (test backend) hoß║╖c F21
  (khu Nh├ón vi├¬n / Quß║ún l├╜) tuß╗│ nh├│m ╞░u ti├¬n.

## C07 QR frontend ΓÇö 2026-10-16 ΓÇö Tiß║┐n / Codex
- Th├¬m component QR ri├¬ng + 2 d├▓ng v├áo Units.jsx; kh├┤ng sß╗¡a nghiß╗çp vß╗Ñ c┼⌐, API hoß║╖c DB.
- C07q xem QR, C07r1/C07r2 kß║┐t quß║ú qu├⌐t; m├┤ phß╗Ång chß╗ë VITE_USE_API=false, API thß║¡t b├ío ch╞░a hß╗ù trß╗ú.
- Kiß╗âm chß╗⌐ng: 42 test gß╗æc, 10 test QR, 9 test business pass; 76 route SSR pass; Vite build pass.
- Browser Chromium: popup 480x598, QR, kß║┐t quß║ú mß╗ƒ cß╗¡a, tß╗½ chß╗æi hß║┐t hß║ín, icon 96px, Escape, ─É├│ng, kh├│a ch╞░a b├án giao, mobile 390px, kh├┤ng pageerror.
- Ch╞░a c├│ backend QR; h╞░ß╗¢ng dß║½n C07-QR-HUONG-DAN.md.

## 2026-10-20 ΓÇö F35 kiß╗âm khoß║ún thu v├á ph├ón bß╗ò, thanh to├ín tß║íi kho, F12

- Theo y├¬u cß║ºu ng╞░ß╗¥i d├╣ng sß╗¡a c├╣ng g├│i: PayOS kiß╗âm sß╗æ tiß╗ün v├á orderCode, ghi RENT/DEPOSIT v├áo payments tr╞░ß╗¢c khi c├│ hß╗úp ─æß╗ông; gß║»n lß║íi PaymentId khi ph├ón bß╗ò, kh├┤ng thu th├¬m. Bß╗Å ph├ón bß╗ò tß╗▒ ─æß╗Öng khß╗Åi webhook. Chuyß╗ân trß║ú tß║íi kho huß╗╖ link tr╞░ß╗¢c khi ─æß╗òi, S09 thu tiß╗ün mß║╖t, xß╗¡ l├╜ callback muß╗Ön bß║▒ng PAYMENT_REVIEW_REQUIRED.
- D23ΓÇôD24 bß╗ò sung, kh├┤ng sß╗¡a sß╗æ/nß╗Öi dung D19ΓÇôD22. Trß║íng th├íi ├┤ bß║▒ng tay c├│ l├╜ do, quy tß║»c v├á unit_status_history. Xo├í c├íc route /api/ops tr├╣ng trong Staff/Manager ─æß╗â giß╗» mß╗Öt bß╗Ö ─æ─âng k├╜; c├íc thao t├íc thu tiß╗ün/ph├ón bß╗ò t╞░╞íng th├¡ch d├╣ng chung xß╗¡ l├╜.
- Migration mß╗¢i 20261020154838_ReservationPaymentIntegrity: PaymentMethod, PENDING_AT_FACILITY, Payment.ReservationId, ContractId optional, unique index khoß║ún thu. Nß╗æi c├íc d├▓ng c┼⌐ kh├┤ng m╞í hß╗ô; kh├┤ng xo├í database/dß╗» liß╗çu. Worker thu hß╗ôi giß╗» chß╗ù tß║íi kho hß║┐t hß║ín. Kh├┤ng sß╗¡a migration c┼⌐.
- Chß║╖n x├íc minh/b├án giao ch╞░a c├│ ─æß╗º khoß║ún thu, ─æß╗ông bß╗Ö trß║íng th├íi x├íc minh tß╗½ HandoverRecord thay v├¼ ─æ├ính dß║Ñu CHECKED_IN tr╞░ß╗¢c khi b├án giao. Test luß╗ông chß╗ìn trß║ú tß║íi kho ΓåÆ ph├ón bß╗ò ΓåÆ thu ΓåÆ x├íc minh ΓåÆ b├án giao giß╗» nguy├¬n hai khoß║ún thu.
- Kiß╗âm chß╗⌐ng: .NET SDK 10.0.100; dotnet build StorageProject.slnx -m:1 PASS; xUnit 15/15 PASS (SQLite, adapter SDK chß╗» k├╜ sai, model SQL Server khß╗¢p snapshot, route kh├┤ng tr├╣ng); npm test 67/67 PASS; test:business 9/9 PASS; test:render 92 route PASS; npm run build PASS; bash init.sh PASS vß╗¢i dotnet build/test chß║íy m:1 do giß╗¢i hß║ín tiß║┐n tr├¼nh cß╗ºa m├┤i tr╞░ß╗¥ng; git diff --check PASS; sinh ─æ╞░ß╗úc SQL upgrade tß╗½ migration toß║í ─æß╗Ö tß╗¢i migration mß╗¢i.
- Giß╗¢i hß║ín kiß╗âm chß╗⌐ng: ch╞░a chß║íy SQL Server thß║¡t, ch╞░a thß╗¡ PayOS/ngrok bß║▒ng key thß║¡t, ch╞░a kiß╗âm kho├í/─æß╗ông thß╗¥i tr├¬n SQL Server hay migration tr├¬n dß╗» liß╗çu DB cß╗ºa nh├│m. F35 giß╗» active, kh├┤ng tuy├¬n bß╗æ 7 flow ho├án tß║Ñt. C├íc cß║únh b├ío dependency NU1902/NU1903 v├á nullable Board.cs:317 ─æ├ú c├│ tß╗½ nguß╗ôn.
- Chß╗ë b├án giao ZIP/bß║ún v├í ─æß╗â ng╞░ß╗¥i d├╣ng ├íp dß╗Ñng v├á chß║íy thß╗¡ tr╞░ß╗¢c khi tß╗▒ push nh├ính. Kh├┤ng push/PR/merge tß╗½ phi├¬n n├áy.


## 2026-10-20 ΓÇö F36: Cß║Ñu tr├║c frontend v├á quy tß║»c ─æß║╖t t├¬n

- Nß╗ün: nh├ính thanh to├ín ng╞░ß╗¥i d├╣ng ─æ├ú push, b482840; giß╗» sß╗¡a DbSeeder. Chß╗ë ─æß╗òi cß║Ñu tr├║c FE v├á h╞░ß╗¢ng dß║½n, kh├┤ng ─æß╗òi nghiß╗çp vß╗Ñ/URL/API/localStorage.
- Chuyß╗ân 79 file; t├ích 6 module gom trang th├ánh tß╗½ng Page theo chß╗⌐c n─âng. Phß║ºn chung Staff/Manager d├╣ng facility-operations; app chß╗⌐a router/provider chung; shared chß╗⌐a UI/API nß╗ün/utils.
- T├¬n component Page khß╗¢p t├¬n file. Th├¬m FRONTEND-MAP.md, docs/frontend-naming.md, h╞░ß╗¢ng dß║½n AGENTS trong FE v├á chß╗ë dß║½n Copilot; CLAUDE.md hiß╗çn trß╗Å AGENTS gß╗æc. C├│ npm run check:structure.
- Test chß╗ë cß║¡p nhß║¡t import/module path, giß╗» assertion. Kiß╗âm tra 532 khai b├ío AST t╞░╞íng ─æ╞░╞íng sau ─æß╗òi t├¬n identifier/import/export.
- Kiß╗âm chß╗⌐ng: check:structure PASS; npm test 67/67; test:business 9/9; test:render 92 routes; build PASS; init.sh PASS (dotnet d├╣ng -m:1 do giß╗¢i hß║ín m├┤i tr╞░ß╗¥ng); git diff --check PASS. C├íc cß║únh b├ío dependency/nullable/chunk size c┼⌐ vß║½n c├▓n.
- Ch╞░a kiß╗âm thß╗¡ lß║íi t╞░╞íng t├íc tr├¼nh duyß╗çt/API thß║¡t; SSR kh├┤ng bao phß╗º thao t├íc. ZIP d├╣ng git apply ─æß╗â th├¬m file mß╗¢i v├á xo├í file c┼⌐, c├│ kiß╗âm tra tr╞░ß╗¢c khi ├íp dß╗Ñng. Kh├┤ng push/PR/merge.


## 2026-10-21 ΓÇö F37 t├ích backend C13 v├á S05/C12

- Theo y├¬u cß║ºu mß╗¢i nhß║Ñt cß╗ºa ng╞░ß╗¥i d├╣ng, chß╗ë chuß║⌐n bß╗ï hai luß╗ông ─æ├ú kiß╗âm tra ─æß║ít ─æß╗â push tr╞░ß╗¢c; g├│i backend ─æß╗Öc lß║¡p tr├¬n main fc83c3a. Kh├┤ng ─æ╞░a ph├¡ trß║ú kho, huß╗╖/ho├án tiß╗ün, migration hay frontend v├áo bß║ún v├í. Giß╗» c├íc c├┤ng viß╗çc ─æang l├ám dß╗ƒ ß╗ƒ th╞░ mß╗Ñc/nh├ính c┼⌐.
- C13 kiß╗âm t├¬n v├á mß║¡t khß║⌐u, lß╗ùi ─æß║ºu v├áo trß║ú 400; test ─æß╗ìc lß║íi database v├á kiß╗âm t├ái khoß║ún kh├íc kh├┤ng ─æß╗òi. S05/C12 ├ính xß║í chß╗º ─æß╗ü hß╗úp lß╗ç, ─æß╗ìc ticket theo c╞í sß╗ƒ hß╗úp ─æß╗ông, chuß║⌐n ho├í trß║íng th├íi/ghi ch├║, l╞░u audit phß║ún hß╗ôi v├á trß║ú nß╗Öi dung cho chß╗º ticket.
- Gß╗Öp phß║ºn hß╗ù trß╗ú tß╗½ bß║ún bß╗ò sung ─æ├ú b├án giao; loß║íi bß╗Å c├íc hunk S04 d├╣ng chung trong StaffService ─æß╗â kh├┤ng phß╗Ñ thuß╗Öc FinanceService. Giß╗» nguy├¬n h├ám trß║ú kho cß╗ºa main. Code c┼⌐ giß╗» trong comment // ß╗ƒ c├íc ─æoß║ín thay ─æß╗òi.
- Kiß╗âm chß╗⌐ng: .NET SDK 10.0.402; build -m:1 PASS; xUnit 34/34 (15 test main + 19 tr╞░ß╗¥ng hß╗úp AuthSupport, SQLite); check:structure PASS; FE 68/68; business 9/9; SSR 92 route PASS; build FE v├á init.sh PASS. init d├╣ng wrapper dotnet th├¬m -m:1 do giß╗¢i hß║ín tiß║┐n tr├¼nh; kh├┤ng sß╗¡a init.sh.
- Cß║únh b├ío c├│ sß║╡n NU1902/NU1903, nullable Board.cs v├á k├¡ch th╞░ß╗¢c chunk/font frontend vß║½n c├▓n. Ch╞░a chß║íy SQL Server thß║¡t cho bß║ún t├ích ri├¬ng. Ng╞░ß╗¥i d├╣ng ─æ├ú b├ío C13 v├á S05/C12 ─æß║ít tr╞░ß╗¢c khi t├ích; cß║ºn kiß╗âm tra lß║íi sau khi ├íp dß╗Ñng. F37 giß╗» active.
- Figma tß╗½ chß╗æi quyß╗ün ─æß╗ìc thiß║┐t kß║┐/ß║únh; kh├┤ng c├│ thay ─æß╗òi giao diß╗çn v├á kh├┤ng tuy├¬n bß╗æ ─æ├ú ─æß╗æi chiß║┐u thiß║┐t kß║┐ trß╗▒c tiß║┐p.
- Kh├┤ng push/PR/merge. B├án giao patch, danh s├ích file v├á h╞░ß╗¢ng dß║½n tß║ío worktree ri├¬ng ─æß╗â ng╞░ß╗¥i d├╣ng tß╗▒ kiß╗âm tra, commit v├á push.

## 2026-10-22 ΓÇö F38 ─æß╗ông bß╗Ö giao diß╗çn v├á luß╗ông Figma
- Nß╗ün 0e70026, giß╗» thay ─æß╗òi quß║ún trß╗ï v├á Auth/Support mß╗¢i tr├¬n main. T├¡nh n─âng phi├¬n n├áy duy nhß║Ñt F38; kh├┤ng ─æß╗òi trß║íng th├íi F35/F37 ─æang chß╗¥ nh├│m kiß╗âm chß╗⌐ng.
- Ng╞░ß╗¥i d├╣ng chß╗ìn "Hß╗ç thß╗æng tß╗▒ chß╗ìn" khi hß╗Åi c├ích ph├ón bß╗ò sau PayOS. D26 thay y├¬u cß║ºu b├án giao, PIN8 v├á ph├ón bß╗ò thß╗º c├┤ng th╞░ß╗¥ng lß╗ç. V├¼ vß║¡y c├íc assertion c┼⌐ y├¬u cß║ºu webhook kh├┤ng ph├ón bß╗ò, b├án giao k├¡ch hoß║ít, PIN8, QR bß╗ï kh├│a tr╞░ß╗¢c nhß║¡n ch├¼a kh├│a cß║ºn cß║¡p nhß║¡t theo nghiß╗çp vß╗Ñ mß╗¢i; giß╗» kiß╗âm tiß╗ün, quyß╗ün sß╗ƒ hß╗»u, chß╗æng tr├╣ng v├á c├íc kiß╗âm chß╗⌐ng kh├íc.
- ─Éang kiß╗âm chß╗⌐ng to├án bß╗Ö FE/BE, t╞░╞íng t├íc tr├¼nh duyß╗çt v├á ZIP. Ch╞░a tuy├¬n bß╗æ PayOS/SQL Server/thiß║┐t bß╗ï thß║¡t ─æß║ít.

- B├án giao F38: frontend cuß╗æi 76/76, SSR 92 route, check:structure/build ─æß║ít; business 9/9; backend build + 40 test SQLite trong phi├¬n. Browser 13 nh├│m PASS, so ß║únh header tr╞░ß╗¢c/sau cuß╗Ön ß╗ƒ 5 role kh├┤ng ─æß╗òi; hß╗ºy x├íc nhß║¡n kh├┤ng request, xß╗¡ l├╜ xong giß║úm badge, thß║Ñt bß║íi giß╗» draft, mobile kh├┤ng tr├án. Ch╞░a x├íc nhß║¡n SQL Server/PayOS/thiß║┐t bß╗ï thß║¡t; xem docs/figma-ui-sync-2026-10-22.md.

## 2026-10-22 ΓÇö D27 chß╗æt ch├¡nh s├ích cß╗ìc v├á ho├án tiß╗ün

- Nh├│m chß╗æt theo D27 (DECISIONS.md): cß╗ìc 1 th├íng thu├¬, hß╗ºy tr╞░ß╗¢c StartDate giß╗» 10% cß╗ìc, dß╗½ng sau StartDate ho├án 70% cß╗ìc, ph╞░╞íng ├ín B cho tiß╗ün thu├¬ khi dß╗½ng giß╗»a kß╗│, phß║ít qu├í hß║ín theo tham sß╗æ OVERDUE ß╗ƒ B02, DamageFee v├á OverdueFee trß╗½ th├¬m v├áo cß╗ìc.
- Ch╞░a c├│ code: feature_list.json kh├┤ng ─æß╗òi trß║íng th├íi v├¼ ch╞░a c├│ bß║▒ng chß╗⌐ng chß║íy. Phß║ºn cß║ºn l├ám ─æ├ú ghi trong BACKEND-TODO.md mß╗Ñc D27.
- Cß║ºn ─æß╗òi: H1 cancel-preview v├á CANCEL_FEE_RATE ─æang t├¡nh 10% tiß╗ün thu├¬, kh├┤ng theo D27. T05 trong doc vß║½n ─æß╗â "theo ch├¡nh s├ích ─æ├ú chß╗æt".

## 2026-10-22 ΓÇö F39 code ch├¡nh s├ích cß╗ìc v├á ho├án tiß╗ün D27 (T01, T05, T08)

- T├¡nh n─âng phi├¬n n├áy duy nhß║Ñt F39; nß╗ün origin/main 248a083. L├ám theo D27, kh├┤ng ─æß╗òi quyß║┐t ─æß╗ïnh.
- Backend: RefundPolicy (h├ám thuß║ºn), cancel-preview, huß╗╖ ─æ╞ín ─æ├ú thanh to├ín ghi mß╗Öt khoß║ún REFUND PENDING, M07 x├íc nhß║¡n ho├án cho ─æ╞ín ─æ├ú huß╗╖, ConfirmRefundAsync hß╗úp ─æß╗ông t├¡nh theo D27 v├á chß╗ë trß╗½ trong phß║ím vi cß╗ìc (phß║ºn thiß║┐u giß╗» th├ánh c├┤ng nß╗ú). Ch├¡nh s├ích OVERDUE seed ─æß╗òi m├┤ tß║ú th├ánh 5% tiß╗ün thu├¬ th├íng mß╗ùi ng├áy trß╗à.
- Frontend: cancelPreviewOf ─æß╗òi sang 10% tiß╗ün cß╗ìc; test huß╗╖ ─æ╞ín (C14a) cß║¡p nhß║¡t sß╗æ mong ─æß╗úi 4.600.000 ΓêÆ 115.000. Kh├┤ng sß╗¡a test n├áo ─æß╗â cho qua; chß╗ë ─æß╗òi sß╗æ liß╗çu theo D27.
- Kiß╗âm chß╗⌐ng: FE npm test 76/76. Backend: phi├¬n n├áy kh├┤ng c├│ .NET SDK n├¬n ch╞░a bi├¬n dß╗ïch v├á ch╞░a chß║íy test; ─æ├ú th├¬m RefundPolicyTests (11 tr╞░ß╗¥ng hß╗úp) v├á ─æß╗æi chiß║┐u c├┤ng thß╗⌐c th├íng bß║▒ng bß║ún t├¡nh ─æß╗Öc lß║¡p. F39 giß╗» active, ch╞░a passing.
- Giß║ú ─æß╗ïnh cß║ºn nh├│m x├íc nhß║¡n: (1) dß╗½ng sß╗¢m th├¼ khß║Ñu trß╗½ cß╗æ ─æß╗ïnh 30% ─æ├ú bao gß╗ôm khoß║ún vß╗ç sinh 10%; (2) khoß║ún CLEANING_FEE chß╗¥ thanh to├ín ─æ╞░ß╗úc coi l├á ─æ├ú nß║▒m trong khoß║ún khß║Ñu trß╗½ cß╗æ ─æß╗ïnh; (3) qu├í hß║ín t├¡nh tß╗½ EndDate ─æß║┐n ng├áy bi├¬n bß║ún trß║ú kho; (4) khoß║ún gia hß║ín (RENEWAL) kh├┤ng nß║▒m trong phß║ºn ho├án tiß╗ün thu├¬.
- Kh├┤ng push/PR/merge.
- Bß╗ò sung c├╣ng F39 (c├╣ng ─æß╗út, tr╞░ß╗¢c khi merge): (a) F12 ├┤ kho RESERVED ΓåÆ OCCUPIED khi ─æß║┐n StartDate, qua UnitStartActivation chß║íy trong worker hiß╗çn c├│, c├│ test ReservedUnitBecomesOccupiedOnStartDateOnly; (b) ─æ╞░ß╗¥ng ho├án cß╗ìc c┼⌐ cß╗ºa quß║ún l├╜ gß╗ìi chung logic D27, bß╗Å ManagerService.ConfirmRefundAsync (lß╗ùi: ─æß║╖t trß║íng th├íi ENDED, kh├┤ng theo D27). Cß║ú hai ch╞░a bi├¬n dß╗ïch trong phi├¬n viß║┐t code; cß║ºn dotnet build/test cß╗ºa nh├│m. C├▓n lß║íi: n├║t x├íc nhß║¡n ho├án ─æ╞ín huß╗╖ ß╗ƒ M07 tr├¬n giao diß╗çn.

## 2026-10-23 ΓÇö F40 ─æß╗ông bß╗Ö Figma 23/10 (─æß╗út 1)

- R├á Figma: sß╗¡a tr├án chß╗» C04b, chß╗» ngß║»n xuß╗æng d├▓ng, n├║t lß╗çch, thß╗æng nhß║Ñt "huß╗╖". Cß║¡p nhß║¡t Figma theo repo: luß╗ông ─æß║╖t chß╗ù hiß╗çn tiß╗ün cß╗ìc, c├íc m├án huß╗╖/ho├án tiß╗ün theo D27, B02 ph├¡ qu├í hß║ín theo D27.
- Code: C14 thao t├íc tr├¬n tß╗½ng d├▓ng + C14aΓÇôc theo D27; M08 ho├án tiß╗ün ─æ╞ín huß╗╖ (`#/manager/refunds`, action `CONFIRM_RESERVATION_REFUND` gß╗ìi `POST /api/ops/reservations/{id}/refund`); M07a x├íc nhß║¡n trß║ú kho; hß╗Öp thoß║íi x├íc nhß║¡n/th├ánh c├┤ng/thß║Ñt bß║íi cho nh├ón vi├¬n, quß║ún l├╜, Vß║¡n h├ánh KD v├á Admin (D28).
- Test cß║¡p nhß║¡t c├│ l├╜ do: `render.test.mjs` C14 ─æß╗òi chß╗» mong ─æß╗úi tß╗½ "Chß╗ë huß╗╖ ─æ╞░ß╗úc ─æ╞ín ch╞░a nhß║¡n kho" sang chß╗» ch├¡nh s├ích D27 v├á cß╗Öt "Thao t├íc" v├¼ Figma C14 ─æß╗òi giao diß╗çn; th├¬m route `manager/refunds`. Th├¬m test reducer M08 (ph├¡ 10% cß╗ìc, ho├án 100% thu├¬ + 90% cß╗ìc, bß║»t buß╗Öc m├ú giao dß╗ïch, chß╗ë x├íc nhß║¡n mß╗Öt lß║ºn).
- Kiß╗âm chß╗⌐ng: check:structure PASS; npm test 77/77; test:business 9/9; test:render 93 route; build PASS. Chromium (dß╗» liß╗çu tr├¼nh duyß╗çt + m├íy chß╗º giß║ú lß║¡p): C14 huß╗╖ ─æ╞ín, M08 hai ─æ╞ín, S04 ΓåÆ M07a, S09, M03, ph├ón bß╗ò, Admin ─æß║╖t lß║íi mß║¡t khß║⌐u. Ch╞░a chß║íy .NET/SQL Server thß║¡t; M08 cß║ºn backend trß║ú `refunds` trong board.
- Kh├┤ng push/PR/merge. B├án giao ZIP ─æß╗â ng╞░ß╗¥i d├╣ng tß╗▒ kiß╗âm tra v├á push.

## 2026-10-23 ΓÇö F40 ─æß╗ông bß╗Ö Figma 23/10 (─æß╗út 2: m├án ch╞░a c├│ backend)

- Th├¬m: M05 (danh s├ích y├¬u cß║ºu, ─æ├ú xß╗¡ l├╜ hß║┐t, ch╞░a c├│ ├┤ ph├╣ hß╗úp), M02b/M02c th├¬m/sß╗¡a ├┤ kho + kß║┐t quß║ú M02, B05b th├¬m c╞í sß╗ƒ, B05c ─æß╗òi trß║íng th├íi c╞í sß╗ƒ + kß║┐t quß║ú B05, C05-chß╗¥ ├┤, C11f/C11fb/C11fq/C11fc/C11fcp/C11-kiß╗âm tra (ph├¡ ph├ít sinh qua PayOS hoß║╖c tß║íi quß║ºy), S04 nhß║¡p ph├¡ ph├ít sinh, S09a/S09f/S09fc/S09fd/S09e thu ph├¡ tß║íi quß║ºy (`#/staff/fees`), kß║┐t quß║ú M07a theo D27.
- Backend: M02b/c v├á B05b/c gß╗ìi API ─æ├ú c├│; ph├¡ ph├ít sinh, thu ph├¡ tß║íi quß║ºy, PayOS cho ph├¡ v├á danh s├ích ho├án tiß╗ün ch╞░a c├│ ΓåÆ ghi BACKEND-TODO.md. Chß║┐ ─æß╗Ö tr├¼nh duyß╗çt chß║íy ─æß╗º luß╗ông.
- Test cß║¡p nhß║¡t c├│ l├╜ do: render S01 ─æß║┐m 12 viß╗çc (th├¬m 2 khoß║ún thu ph├¡ S09f trong dß╗» liß╗çu mß║½u), fixture "kh├┤ng c├│ viß╗çc" th├¬m `fee_collections: []`, th├¬m route `staff/fees`. Th├¬m test reducer S09f. D├▓ng ph├¡ trong dß╗» liß╗çu mß║½u kh├ích ─æß║╖t cuß╗æi sß╗ò thu ─æß╗â kh├┤ng ─æß╗òi test PayOS gia hß║ín.
- Ch╞░a l├ám (ghi trong docs/figma-ui-sync-2026-10-23.md): C02-vß╗ï tr├¡ (tr├íi quy tß║»c gß╗úi ├╜ theo khu vß╗▒c), A01b/A01c (thiß║┐u API m├ú email), C12* (nh├ính Ngß╗ìc Mai), trang C11c ri├¬ng.
- Kiß╗âm chß╗⌐ng: check:structure PASS; npm test 78/78; test:business 9/9; test:render 95 route; build PASS; Chromium chß║íy C11 ph├¡, S04 ΓåÆ M07a, S09f, M02b/c, B05b/c, M05. Kh├┤ng push/PR/merge.

## 2026-10-23 ΓÇö F37 ho├án thiß╗çn nß╗æi API C13 v├á kiß╗âm C12/S05

- Nß╗ün main 6d959ae. Ng╞░ß╗¥i d├╣ng y├¬u cß║ºu hai task cß╗ºa Ngß╗ìc Mai; kh├┤ng sß╗¡a trß║ú kho, thanh to├ín, cß╗ìc hay Figma.
- Ph├ít hiß╗çn v├á sß╗¡a CHANGE_PASSWORD ─æß╗ìc sai t├¬n tr╞░ß╗¥ng (UI gß╗¡i current/next, provider ─æß╗ìc current_password/new_password). Sai mß║¡t khß║⌐u hiß╗çn tß║íi trß║ú BAD_PASSWORD v├á hiß╗çn ─æ├║ng tr╞░ß╗¥ng.
- GET profile ─æ╞░ß╗úc d├╣ng khi ─æ─âng nhß║¡p v├á kh├┤i phß╗Ñc phi├¬n; bß╗Å t├¬n overlay c┼⌐, ─æß╗ìc sß╗æ ─æiß╗çn thoß║íi thß║¡t, cß║¡p nhß║¡t session tß╗½ response; bß╗Å closure session c┼⌐ trong UPDATE_NAME. Biß╗âu mß║½u kh├│a khi ─æang l╞░u v├á giß╗» dß╗» liß╗çu nß║┐u lß╗ùi.
- C12/S05 ─æ├ú c├│ backend l╞░u/─æß╗ìc activity_logs, ├ính xß║í responses v├á giao diß╗çn lß╗ïch sß╗¡. Bß╗Å fallback ├óm thß║ºm che lß╗ùi GET chi tiß║┐t ticket.
- Th├¬m 2 HTTP test Kestrel/JWT/SQLite file ri├¬ng v├á browser script vß╗¢i host .NET ri├¬ng. Host d├╣ng endpoint/service thß║¡t; reservations trß╗æng chß╗ë ─æß╗â khß╗ƒi ─æß╗Öng FE, kh├┤ng d├╣ng chß╗⌐ng minh ─æß║╖t kho/thanh to├ín.
- Kiß╗âm chß╗⌐ng: .NET 10.0.100; build PASS; 54/54 xUnit (52 tr╞░ß╗¢c sß╗¡a + 2 HTTP); FE 76/76; business 9/9; SSR 92 route; check:structure/build PASS; init.sh PASS qua wrapper dotnet th├¬m -m:1 v├¼ m├┤i tr╞░ß╗¥ng giß╗¢i hß║ín tiß║┐n tr├¼nh. Kh├┤ng sß╗¡a init.sh.
- Chromium Headless Shell 145: 10 nh├│m browser PASS: profile API; t├¬n sai/l╞░u/reload; mß║¡t khß║⌐u x├íc nhß║¡n sai v├á mß║¡t khß║⌐u hiß╗çn tß║íi sai; JSON password ch├¡nh x├íc + login lß║íi; overlay c┼⌐; lß╗ùi mß║íng; gß╗¡i ticket; staff phß║ún hß╗ôi; lß╗ïch sß╗¡ + mobile; t├ái khoß║ún kh├íc v├á kh├┤ng pageerror.
- Trong l├║c x├óy browser test, chß╗ënh selector theo chß╗º ─æß╗ü UNIT ─æang hiß╗ân thß╗ï (LOCK l├á legacy bß╗ï ß║⌐n), ─æß╗úi login staff tr╞░ß╗¢c khi ─æiß╗üu h╞░ß╗¢ng v├á chß╗ìn li lß╗ïch sß╗¡ chß╗⌐a timestamp. Kh├┤ng ─æß╗òi nghiß╗çp vß╗Ñ hay giß║úm assertion.
- Cß║únh b├ío dependency NU1902/NU1903, nullable Board.cs, font/chunk frontend c├│ sß║╡n tß╗½ main. Ch╞░a chß║íy SQL Server cß╗ºa nh├│m. F37 giß╗» active; kh├┤ng n├│i hß╗ç thß╗æng kh├┤ng c├│ lß╗ùi.
- Chß╗ë b├án giao ZIP + patch. Kh├┤ng push/PR/merge.


## 2026-10-23 ΓÇö F37 gh├⌐p frontend Mai C12/C12b/C13 tr├¬n main mß╗¢i

- Nguß╗ôn task ZIP SSFRMS_Frontend_AuthSupport_Figma_2026-10-22, 29 file khß╗¢p e615dad. Nß╗ün main 6d959ae; chß╗ë lß║Ñy thay ─æß╗òi C12/C12b/C13 v├á guard phß║ún hß╗ôi S05, kh├┤ng merge lß╗ïch sß╗¡ nh├ính c┼⌐.
- Giß╗» StickyHeader/PendingBadge, polling/th├┤ng b├ío, OTHER subject, y├¬u cß║ºu cß║Ñp lß║íi QR/PIN/key, modal STAFF, /api/ops chuß║⌐n v├á RECORD_KEY_RECEIPT. Th├¬m timeline, preview, retry, asset/CSS theo g├│i ─æ├ú c├│, trß║íng th├íi thiß║┐u th├┤ng tin C13. Kh├┤ng gß╗ìi hay sß╗¡a Figma trong phi├¬n.
- Provider kiß╗âm token/userId khi applyProfile, ─æß╗ìc hß╗ô s╞í qua API, kh├┤ng ghi ─æ├¿ phone khi chß╗ë ─æß╗òi t├¬n; mß║¡t khß║⌐u d├╣ng ─æ├║ng payload v├á BAD_PASSWORD/400 t╞░╞íng th├¡ch. Ticket detail lß╗ùi c├│ cß╗¥ lß╗ùi/retry, giß╗» dß╗» liß╗çu ─æ├ú tß║úi ─æ╞░ß╗úc; vß║½n truyß╗ün 401. Normalize danh s├ích null cß╗ºa board m├á kh├┤ng thay API.
- Th├¬m D28 cho Playwright devDependency ─æß╗â tr├ính tr├╣ng D26. Giß╗» to├án bß╗Ö c├íc test main; th├¬m 3 test gh├⌐p API/mapper/null board; SSR th├¬m 2 route. Test mock cß╗ºa Mai ─æß╗òi sang /api/ops, bß║Ñm x├íc nhß║¡n staff v├á giß╗» phone khi request kh├┤ng chß╗⌐a phone; kh├┤ng nß╗¢i assertion. Th├┤ng b├ío t├¬n trß╗æng ─æß╗ông bß╗Ö c├óu chß╗» g├│i Mai; sai mß║¡t khß║⌐u t╞░╞íng th├¡ch cß║ú error code mß╗¢i v├á message backend c┼⌐.
- Kiß╗âm: FE 79/79, Business 9/9, SSR 94, Playwright mock 14/14; .NET 54/54, 10 nh├│m Chromium gß╗ìi backend Kestrel/JWT/SQLite ri├¬ng. Build/structure/init PASS, init wrapper th├¬m -m:1. ─É├ú xem C12b desktop/C13 mobile. Ch╞░a chß║íy SQL Server cß╗ºa nh├│m; F37 giß╗» active.
- Kh├┤ng thay backend t├ái ch├¡nh, schema/migration hoß║╖c config. Chß╗ë ZIP/patch, kh├┤ng push/PR/merge. Xem docs/mai-auth-support-integration.md.
## 2026-10-24 ΓÇö Cß║¡p nhß║¡t quy ─æß╗ïnh AI/Git v├á t├ái liß╗çu kiß╗âm chß╗⌐ng

- Theo y├¬u cß║ºu th├ánh vi├¬n: sß╗¡a quy ─æß╗ïnh mß╗Öt l╞░ß╗út v├á b├án giao ZIP ─æß╗â th├ánh vi├¬n tß╗▒ push; kh├┤ng thao t├íc commit/push/PR/merge.
- Phß║ím vi chß╗ë t├ái liß╗çu: AGENTS gß╗æc/FE, README, docs/conventions.md, docs/verification.md, DECISIONS.md v├á nhß║¡t k├╜ n├áy.
- AI kh├┤ng tß║ío commit, kh├┤ng ─æß╗òi danh t├¡nh Git. Giß╗» PR ΓåÆ main v├á review bß╗ƒi th├ánh vi├¬n kh├íc; task c├│ mß╗Ñc ti├¬u r├╡, kiß╗âm thß╗¡ theo phß║ím vi, n├¬u giß╗¢i hß║ín m├┤i tr╞░ß╗¥ng.
- Figma chuß║⌐n bß╗æ cß╗Ñc/t╞░╞íng t├íc, nghiß╗çp vß╗Ñ/quyß╗ün theo quyß║┐t ─æß╗ïnh hiß╗çn h├ánh; y├¬u cß║ºu mock/offline nhß║¡n biß║┐t khi kiß╗âm thß╗¡, kh├┤ng giß║ú API th├ánh c├┤ng.
- Sß╗¡a h╞░ß╗¢ng dß║½n .NET 10/Node >=22.12, bß║ún ─æß╗ô apiMappers.js v├á cß║Ñu tr├║c FE; bß╗Å sß╗æ test c┼⌐ v├á khß║│ng ─æß╗ïnh fallback/API badge ─æ├ú lß╗ùi thß╗¥i.
- Kh├┤ng sß╗¡a code/config/migration, kh├┤ng ─æß╗òi trß║íng th├íi t├¡nh n─âng hoß║╖c ghi ─æ├¿ nhß║¡t k├╜ c┼⌐. Ghi quy tß║»c thay thß║┐ tß║íi PROCESS-2026-10-24, kh├┤ng sß╗¡a quyß║┐t ─æß╗ïnh lß╗ïch sß╗¡.
- Kiß╗âm chß╗⌐ng g├│i t├ái liß╗çu: ─æß╗ìc diff, kiß╗âm ─æ╞░ß╗¥ng dß║½n/lß╗çnh vß╗¢i nguß╗ôn, kiß╗âm whitespace, ├íp dß╗Ñng bß║ún v├í v├áo bß║ún nguß╗ôn sß║ích v├á so byte ─æß║ºu ra; kiß╗âm t├¡nh to├án vß║╣n ZIP. Kh├┤ng chß║íy ß╗⌐ng dß╗Ñng, npm/dotnet build/test hoß║╖c SQL Server v├¼ kh├┤ng ─æß╗òi code; kh├┤ng nhß║¡n kß║┐t quß║ú tß╗½ PR kh├íc l├ám bß║▒ng chß╗⌐ng.