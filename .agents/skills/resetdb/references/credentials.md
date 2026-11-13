# SafeSpace (SSFRMS) — Default Seed Accounts

After running `/resetdb`, the database is reset and initialized with live operational demo data (D55 / #60, D61):
- **45 Active Rental Contracts** across all 12 facilities with QR & PIN credentials — **all owned by `customer01`** (the only customer).
- **~384,780,000 VND Rent Revenue & ~65,710,000 VND Deposit** distributed across the last 6 months for Business Ops reporting (theo bảng giá gốc; sẽ khác nếu đã đổi giá).
- **99 Available Storage Units** ready for booking tests.
- **12/12 Facilities** with active Manager and Staff coverage.

---

## 1. System Leadership & Operations Accounts

| Role | Username | Password | Full Name | Facility Scope |
|---|---|---|---|---|
| **ADMIN** | `admin` | `Admin@123` | Hệ Thống Admin | Toàn hệ thống |
| **OPERATIONS** | `ops01` | `Ops@123` | Lê Hoàng Vy | Toàn hệ thống |

## 2. Facility Management Accounts (12 Facilities)

Password: Manager `Manager@123`, Staff `Staff@123`.

| Facility | Manager | Manager Name | Staff | Staff Name | Contracts of customer01 |
|---|---|---|---|---|---|
| **SafeSpace Nguyễn Lương Bằng** | `Manager_NLB` | Đỗ Ngọc Hân | `Staff_NLB` | Võ Thanh Tùng | 4 hợp đồng |
| **SafeSpace Him Lam** | `Manager_HL` | Lý Thanh Hương | `Staff_HL` | Bùi Đức Thịnh | 6 hợp đồng |
| **SafeSpace Phú Xuân** | `Manager_PX` | Mai Phương Thảo | `Staff_PX` | Huỳnh Gia Khang | 5 hợp đồng |
| **SafeSpace Tân Thuận** | `Manager_TT` | Tô Mỹ Linh | `Staff_TT` | Đặng Quốc Việt | 2 hợp đồng |
| **SafeSpace Phú Mỹ Hưng** | `Manager_PMH` | Trương Bảo Ngọc | `Staff_PMH` | Ngô Hoàng Phúc | 6 hợp đồng |
| **SafeSpace Bình Thạnh** | `Manager_BTH` | Hồ Thị Kim Oanh | `Staff_BTH` | Phan Minh Nhật | 4 hợp đồng |
| **SafeSpace Nhà Bè** | `Manager_NB` | Dương Hải Yến | `Staff_NB` | Lâm Tấn Phát | 1 hợp đồng |
| **SafeSpace Bình Chánh** | `Manager_BC` | Vũ Thị Thanh Tâm | `Staff_BC` | Châu Văn Lộc | 3 hợp đồng |
| **SafeSpace Thủ Đức** | `Manager_TD` | Nguyễn Hoài Thương | `Staff_TD` | Kiều Anh Dũng | 5 hợp đồng |
| **SafeSpace Gò Vấp** | `Manager_GV` | Lê Ngọc Trâm | `Staff_GV` | Cao Thành Đạt | 2 hợp đồng |
| **SafeSpace Tân Bình** | `Manager_TB` | Phùng Thị Diễm | `Staff_TB` | La Minh Khôi | 4 hợp đồng |
| **SafeSpace Bình Tân** | `Manager_BTA` | Tạ Quỳnh Như | `Staff_BTA` | Hà Đức Trọng | 3 hợp đồng |

`staff01`, `staff02`, `manager01` không còn nữa (reset sẽ xoá).

## 3. Customer Account

| Role | Username | Password | Full Name | Notes |
|---|---|---|---|---|
| **CUSTOMER** | `customer01` | `Customer@123` | Nguyễn Văn An | Khách hàng duy nhất, đứng tên cả 45 hợp đồng đang thuê ở 12 cơ sở (có QR/PIN) |

`customer02`–`customer06` và `Customer<MÃ>01` không còn nữa (reset sẽ xoá).

## 4. Storage Units & Financial Status
- **Total Facilities:** 12
- **Total Physical Units:** 144 (12 units K01–K12 per facility)
- **Occupied Units:** 45 (31.3%)
- **Available Units:** 99 (68.7% - ready for booking)
- **Rent Revenue:** ~384,780,000 VND (45 payments)
- **Deposit Held:** ~65,710,000 VND (45 payments)
