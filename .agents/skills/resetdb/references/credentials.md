# SafeSpace (SSFRMS) — Default Seed Accounts

After running `/resetdb`, the database is reset and initialized with live operational demo data (D55 / #60):
- **42 Active Rental Contracts** across all 12 facilities with QR & PIN credentials.
- **358,890,000 VND Rent Revenue & 60,760,000 VND Deposit** distributed across the last 6 months for Business Ops reporting.
- **102 Available Storage Units** ready for booking tests.
- **12/12 Facilities** with active Manager coverage.

---

## 1. System Leadership & Operations Accounts

| Role | Username | Password | Full Name | Facility Scope | Notes |
|---|---|---|---|---|---|
| **ADMIN** | `admin` | `Admin@123` | Hệ Thống Admin | Toàn hệ thống | Quản trị viên tối cao, toàn quyền cấu hình, tài khoản & phân quyền |
| **OPERATIONS** | `ops01` | `Ops@123` | Lê Vận Hành | Toàn hệ thống | Quản lý vận hành kinh doanh, báo cáo doanh thu & tỷ lệ lấp đầy |

## 2. Facility Management Accounts (12 Facilities)

Every active facility is assigned an active Manager and Staff (SRS A06):

| Facility | Manager Username | Staff Username | Password | Manager Name | Active Contracts |
|---|---|---|---|---|---|
| **SafeSpace Him Lam** | `Manager_HL` | `Staff_HL` | `Manager@123` / `Staff@123` | Quản lý Him Lam | 6 hợp đồng |
| **SafeSpace Phú Xuân** | `Manager_PX` | `Staff_PX` | `Manager@123` / `Staff@123` | Quản lý Phú Xuân | 5 hợp đồng |
| **SafeSpace Phú Mỹ Hưng** | `Manager_PMH` | `Staff_PMH` | `Manager@123` / `Staff@123` | Quản lý Phú Mỹ Hưng | 6 hợp đồng |
| **SafeSpace Thủ Đức** | `Manager_TD` | `Staff_TD` | `Manager@123` / `Staff@123` | Quản lý Thủ Đức | 5 hợp đồng |
| **SafeSpace Tân Bình** | `Manager_TB` | `Staff_TB` | `Manager@123` / `Staff@123` | Quản lý Tân Bình | 4 hợp đồng |
| **SafeSpace Bình Thạnh** | `Manager_BTH` | `Staff_BTH` | `Manager@123` / `Staff@123` | Quản lý Bình Thạnh | 4 hợp đồng |
| **SafeSpace Bình Chánh** | `Manager_BC` | `Staff_BC` | `Manager@123` / `Staff@123` | Quản lý Bình Chánh | 3 hợp đồng |
| **SafeSpace Bình Tân** | `Manager_BTA` | `Staff_BTA` | `Manager@123` / `Staff@123` | Quản lý Bình Tân | 3 hợp đồng |
| **SafeSpace Tân Thuận** | `Manager_TT` | `Staff_TT` | `Manager@123` / `Staff@123` | Quản lý Tân Thuận | 2 hợp đồng |
| **SafeSpace Gò Vấp** | `Manager_GV` | `Staff_GV` | `Manager@123` / `Staff@123` | Quản lý Gò Vấp | 2 hợp đồng |
| **SafeSpace Nhà Bè** | `Manager_NB` | `Staff_NB` | `Manager@123` / `Staff@123` | Quản lý Nhà Bè | 1 hợp đồng |
| **SafeSpace Nguyễn Lương Bằng** | `manager01` / `Manager_NLB` | `staff01` / `staff02` / `Staff_NLB` | `Manager@123` / `Staff@123` | Phạm Thu Hà | 1 hợp đồng |

## 3. Customer Seed Accounts

| Role | Username | Password | Full Name | Notes |
|---|---|---|---|---|
| **CUSTOMER** | `Customer<MÃ>01` | `Customer@123` | Khách hàng cơ sở | Khách hàng sở hữu 1–6 hợp đồng đang thuê tại từng cơ sở, có mã QR/PIN |
| **CUSTOMER** | `customer01` | `Customer@123` | Nguyễn Văn An | Khách hàng mới (0 đơn, 0 hợp đồng) để tự do đặt kho mới |
| **CUSTOMER** | `customer02` | `Customer@123` | Trần Thị Mai | Khách hàng mới (0 đơn, 0 hợp đồng) để tự do đặt kho mới |

## 4. Storage Units & Financial Status
- **Total Facilities:** 12
- **Total Physical Units:** 144 (12 units K01–K12 per facility)
- **Occupied Units:** 42 (29.2%)
- **Available Units:** 102 (70.8% - ready for booking)
- **Rent Revenue:** 358,890,000 VND (42 payments)
- **Deposit Held:** 60,760,000 VND (42 payments)
