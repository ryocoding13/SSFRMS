# Bản đồ frontend SafeSpace

Đường dẫn trong bảng tính từ thư mục này. Mở `src/features/` rồi chọn vai trò và chức năng. Quy tắc: `../../docs/frontend-naming.md`.

## Điểm bắt đầu

| Việc cần tìm | File |
|---|---|
| Khởi động React | `src/main.jsx` |
| Route tổng và phân quyền trang | `src/app/App.jsx` |
| Đọc/chuyển URL hash | `src/app/router.js` |
| Phiên đăng nhập, dữ liệu chung, lệnh khách hàng | `src/app/state/AppProvider.jsx` |
| API khách hàng và HTTP/JWT | `src/shared/api/customerApi.js`, `src/shared/api/httpClient.js` |
| Chuyển dữ liệu BE sang FE | `src/shared/api/apiMappers.js` |
| Staff/Manager: route, dữ liệu và thao tác | `src/features/facility-operations/FacilityOperationsRoutes.jsx`, `state/FacilityOperationsProvider.jsx`, `api/facilityOperationsApi.js` |
| Admin: route và API | `src/features/admin/AdminRoutes.jsx`, `api/adminApi.js` |
| Business: route và API | `src/features/business/BusinessRoutes.jsx`, `api/businessApi.js` |

## Tìm màn hình theo chức năng

| Vai trò / chức năng | File màn hình |
|---|---|
| Quản trị / Nhật ký — AuditLogPage | `src/features/admin/logs/AuditLogPage.jsx` |
| Quản trị / Phân quyền — PermissionListPage | `src/features/admin/permissions/PermissionListPage.jsx` |
| Quản trị / Tài khoản — CreateUserPage | `src/features/admin/users/CreateUserPage.jsx` |
| Quản trị / Tài khoản — UserDetailPage | `src/features/admin/users/UserDetailPage.jsx` |
| Quản trị / Tài khoản — UserListPage | `src/features/admin/users/UserListPage.jsx` |
| Đăng nhập / đăng ký — LoginPage | `src/features/auth/LoginPage.jsx` |
| Đăng nhập / đăng ký — RegisterPage | `src/features/auth/RegisterPage.jsx` |
| Vận hành kinh doanh / Tổng quan — BusinessDashboardPage | `src/features/business/dashboard/BusinessDashboardPage.jsx` |
| Vận hành kinh doanh / Cơ sở kho — FacilityManagementPage | `src/features/business/facilities/FacilityManagementPage.jsx` |
| Vận hành kinh doanh / Chính sách — PolicySettingsPage | `src/features/business/policies/PolicySettingsPage.jsx` |
| Vận hành kinh doanh / Bảng giá — PricingPage | `src/features/business/pricing/PricingPage.jsx` |
| Vận hành kinh doanh / Báo cáo — BusinessReportPage | `src/features/business/reports/BusinessReportPage.jsx` |
| Khách hàng / Mở cửa kho — DoorScannerPage | `src/features/customer/access/DoorScannerPage.jsx` |
| Khách hàng / Hợp đồng / kho đang thuê — RenewalRequestPage | `src/features/customer/contracts/RenewalRequestPage.jsx` |
| Khách hàng / Hợp đồng / kho đang thuê — RentedUnitDetailPage | `src/features/customer/contracts/RentedUnitDetailPage.jsx` |
| Khách hàng / Hợp đồng / kho đang thuê — RentedUnitListPage | `src/features/customer/contracts/RentedUnitListPage.jsx` |
| Khách hàng / Hợp đồng / kho đang thuê — ReturnRequestPage | `src/features/customer/contracts/ReturnRequestPage.jsx` |
| Khách hàng / Tổng quan — CustomerDashboardPage | `src/features/customer/dashboard/CustomerDashboardPage.jsx` |
| Khách hàng / Cơ sở kho — FacilityDetailPage | `src/features/customer/facilities/FacilityDetailPage.jsx` |
| Khách hàng / Cơ sở kho — FacilityListPage | `src/features/customer/facilities/FacilityListPage.jsx` |
| Khách hàng / Cơ sở kho — FacilityMapPage | `src/features/customer/facilities/FacilityMapPage.jsx` |
| Khách hàng / Hướng dẫn — HelpPage | `src/features/customer/help/HelpPage.jsx` |
| Khách hàng / Trang chủ — HomePage | `src/features/customer/home/HomePage.jsx` |
| Khách hàng / Thanh toán — CheckoutFailedPage | `src/features/customer/payments/CheckoutFailedPage.jsx` |
| Khách hàng / Thanh toán — CheckoutPage | `src/features/customer/payments/CheckoutPage.jsx` |
| Khách hàng / Thanh toán — PaymentListPage | `src/features/customer/payments/PaymentListPage.jsx` |
| Khách hàng / Bảng giá — PublicPricingPage | `src/features/customer/pricing/PublicPricingPage.jsx` |
| Khách hàng / Hồ sơ — CustomerProfilePage | `src/features/customer/profile/CustomerProfilePage.jsx` |
| Khách hàng / Yêu cầu — RequestSentPage | `src/features/customer/requests/RequestSentPage.jsx` |
| Khách hàng / Đặt chỗ — ReservationDetailPage | `src/features/customer/reservations/ReservationDetailPage.jsx` |
| Khách hàng / Đặt chỗ — ReservationListPage | `src/features/customer/reservations/ReservationListPage.jsx` |
| Khách hàng / Hỗ trợ — SupportPage | `src/features/customer/support/SupportPage.jsx` |
| Khách hàng / Tiến trình hỗ trợ — SupportTicketDetailPage | `src/features/customer/support/SupportTicketDetailPage.jsx` |
| Quản lý cơ sở / Phân bổ kho — UnitAllocationPage | `src/features/manager/allocations/UnitAllocationPage.jsx` |
| Quản lý cơ sở / Phân công — StaffAssignmentPage | `src/features/manager/assignments/StaffAssignmentPage.jsx` |
| Quản lý cơ sở / Hợp đồng / kho đang thuê — ContractListPage | `src/features/manager/contracts/ContractListPage.jsx` |
| Quản lý cơ sở / Tổng quan — ManagerDashboardPage | `src/features/manager/dashboard/ManagerDashboardPage.jsx` |
| Quản lý cơ sở / Gia hạn — RenewalApprovalPage | `src/features/manager/renewals/RenewalApprovalPage.jsx` |
| Quản lý cơ sở / Báo cáo — FacilityReportPage | `src/features/manager/reports/FacilityReportPage.jsx` |
| Quản lý cơ sở / Hoàn tiền đơn huỷ — CancellationRefundPage | `src/features/manager/refunds/CancellationRefundPage.jsx` |
| Quản lý cơ sở / Kết quả — ManagerResultPage | `src/features/manager/results/ManagerResultPage.jsx` |
| Quản lý cơ sở / Quản lý ô kho — UnitManagementPage | `src/features/manager/units/UnitManagementPage.jsx` |
| Nhân viên / Tổng quan — StaffDashboardPage | `src/features/staff/dashboard/StaffDashboardPage.jsx` |
| Nhân viên / Xác minh / nhận chìa khóa — CustomerVerificationPage | `src/features/staff/handovers/CustomerVerificationPage.jsx` |
| Nhân viên / Xác minh / nhận chìa khóa — KeyReceiptPage | `src/features/staff/keys/KeyReceiptPage.jsx` |
| Nhân viên / Thanh toán — PaymentConfirmationPage | `src/features/staff/payments/PaymentConfirmationPage.jsx` |
| Nhân viên / Kết quả — StaffResultPage | `src/features/staff/results/StaffResultPage.jsx` |
| Nhân viên / Trả kho — ReturnInspectionPage | `src/features/staff/returns/ReturnInspectionPage.jsx` |
| Nhân viên / Hỗ trợ — StaffSupportPage | `src/features/staff/support/StaffSupportPage.jsx` |

## Các URL thường dùng

| Muốn mở | URL hash |
|---|---|
| Tìm cơ sở / bản đồ / chi tiết | `#/find`, `#/find/map`, `#/find/:id` |
| Đặt chỗ / thanh toán / kết quả | `#/reservations`, `#/checkout/:id`, `#/confirmation/:id` |
| Hỗ trợ / tiến trình / hồ sơ | `#/support`, `#/support/:id`, `#/profile` |
| Kho thuê / gia hạn / trả kho | `#/units`, `#/units/:id/renew`, `#/units/:id/return` |
| Nhân viên thu tiền / xác minh / nhận chìa khóa | `#/staff/reconcile`, `#/staff/verify`, `#/staff/keys` (alias cũ: `#/staff/handover`) |
| Quản lý ô / phân bổ / gia hạn | `#/manager/units`, `#/manager/allocate`, `#/manager/renewals` |
| Hoàn tiền đơn huỷ (M08) | `#/manager/refunds` |
| Vận hành kinh doanh / quản trị | `#/business`, `#/admin` |

## Ví dụ lần theo code

- Chỉ đường: `features/customer/facilities/FacilityDetailPage.jsx`; bản đồ tìm cơ sở: `FacilityMapPage.jsx`; toạ độ mặc định: `app/config/geo.js`.
- Thanh toán khách: `features/customer/payments/CheckoutPage.jsx` → `app/state/AppProvider.jsx` → `shared/api/customerApi.js` → BE.
- Thu tiền tại quầy: `features/staff/payments/PaymentConfirmationPage.jsx` → `features/facility-operations/state/FacilityOperationsProvider.jsx` → `api/facilityOperationsApi.js`.
- Các đường dẫn rút gọn trong ví dụ tính theo thư mục feature được nêu; bảng màn hình phía trên có đường dẫn đầy đủ.

## Chuyển từ đường dẫn cũ

| File cũ | Vị trí mới |
|---|---|
| `src/CustomerApp.jsx` | `src/app/App.jsx` |
| `src/admin/AdminApp.jsx` | `src/features/admin/AdminRoutes.jsx` |
| `src/admin/AdminCreateUser.jsx` | `src/features/admin/users/CreateUserPage.jsx` |
| `src/admin/AdminLogs.jsx` | `src/features/admin/logs/AuditLogPage.jsx` |
| `src/admin/AdminPermissions.jsx` | `src/features/admin/permissions/PermissionListPage.jsx` |
| `src/admin/AdminShell.jsx` | `src/features/admin/AdminLayout.jsx` |
| `src/admin/AdminUserDetail.jsx` | `src/features/admin/users/UserDetailPage.jsx` |
| `src/admin/AdminUsers.jsx` | `src/features/admin/users/UserListPage.jsx` |
| `src/admin/util.js` | `src/features/admin/utils/adminUtils.js` |
| `src/api/admin.js` | `src/features/admin/api/adminApi.js` |
| `src/api/business.js` | `src/features/business/api/businessApi.js` |
| `src/api/endpoints.js` | `src/shared/api/customerApi.js` |
| `src/api/http.js` | `src/shared/api/httpClient.js` |
| `src/api/mappers.js` | `src/shared/api/apiMappers.js` |
| `src/api/payment-access.js` | `src/features/customer/access/accessApi.js` |
| `src/business/BusinessApp.jsx` | `src/features/business/BusinessRoutes.jsx` |
| `src/business/BusinessShell.jsx` | `src/features/business/BusinessLayout.jsx` |
| `src/business/Facilities.jsx` | `src/features/business/facilities/FacilityManagementPage.jsx` |
| `src/business/Overview.jsx` | `src/features/business/dashboard/BusinessDashboardPage.jsx` |
| `src/business/Policies.jsx` | `src/features/business/policies/PolicySettingsPage.jsx` |
| `src/business/Pricing.jsx` | `src/features/business/pricing/PricingPage.jsx` |
| `src/business/Reports.jsx` | `src/features/business/reports/BusinessReportPage.jsx` |
| `src/business/actions.js` | `src/features/business/policies/policyActions.js` |
| `src/business/design.css` | `src/features/business/business.css` |
| `src/business/export.js` | `src/features/business/reports/reportExport.js` |
| `src/business/facility-form.js` | `src/features/business/facilities/facilityForm.js` |
| `src/business/format.js` | `src/features/business/utils/businessFormat.js` |
| `src/business/parts.jsx` | `src/features/business/components/BusinessComponents.jsx` |
| `src/business/policy-fields.js` | `src/features/business/policies/policyFields.js` |
| `src/components/AccessQr.jsx` | `src/shared/components/AccessQr.jsx` |
| `src/components/Header.jsx` | `src/shared/components/Header.jsx` |
| `src/components/Inline.jsx` | `src/shared/components/Inline.jsx` |
| `src/components/PayOSEmbeddedModal.jsx` | `src/shared/components/PayOSEmbeddedModal.jsx` |
| `src/components/PaymentQr.jsx` | `src/shared/components/PaymentQr.jsx` |
| `src/components/PayosModal.jsx` | `src/shared/components/PayosModal.jsx` |
| `src/components/Photo.jsx` | `src/shared/components/Photo.jsx` |
| `src/components/Pickers.jsx` | `src/shared/components/Pickers.jsx` |
| `src/components/QrCode.jsx` | `src/shared/components/QrCode.jsx` |
| `src/components/SearchBar.jsx` | `src/shared/components/SearchBar.jsx` |
| `src/components/UI.jsx` | `src/shared/components/UI.jsx` |
| `src/components/UnitMap.jsx` | `src/shared/components/UnitMap.jsx` |
| `src/config/api.js` | `src/app/config/api.js` |
| `src/config/geo.js` | `src/app/config/geo.js` |
| `src/config/media.js` | `src/app/config/media.js` |
| `src/config/payment.js` | `src/app/config/payment.js` |
| `src/data/seed.js` | `src/app/data/appSeed.js` |
| `src/lib/access.js` | `src/shared/utils/access.js` |
| `src/lib/catalog.js` | `src/shared/utils/catalog.js` |
| `src/lib/format.js` | `src/shared/utils/format.js` |
| `src/lib/hooks.js` | `src/shared/hooks/useBrowserEvents.js` |
| `src/lib/roles.js` | `src/shared/utils/roles.js` |
| `src/lib/router.js` | `src/app/router.js` |
| `src/lib/status.js` | `src/shared/utils/status.js` |
| `src/lib/units.js` | `src/shared/utils/units.js` |
| `src/lib/vietqr.js` | `src/shared/utils/vietqr.js` |
| `src/ops/OpsApp.jsx` | `src/features/facility-operations/FacilityOperationsRoutes.jsx` |
| `src/ops/OpsShell.jsx` | `src/features/facility-operations/FacilityOperationsLayout.jsx` |
| `src/ops/api.js` | `src/features/facility-operations/api/facilityOperationsApi.js` |
| `src/ops/data.js` | `src/features/facility-operations/data/facilityOperationsSeed.js` |
| `src/ops/reducer.js` | `src/features/facility-operations/state/facilityOperationsReducer.js` |
| `src/ops/store.jsx` | `src/features/facility-operations/state/FacilityOperationsProvider.jsx` |
| `src/ops/tasks.jsx` | `src/features/facility-operations/components/StaffTasks.jsx` |
| `src/ops/util.jsx` | `src/features/facility-operations/components/FacilityOperationsComponents.jsx` |
| `src/pages/Door.jsx` | `src/features/customer/access/DoorScannerPage.jsx` |
| `src/pages/FacilityDetail.jsx` | `src/features/customer/facilities/FacilityDetailPage.jsx` |
| `src/pages/FindList.jsx` | `src/features/customer/facilities/FacilityListPage.jsx` |
| `src/pages/FindMap.jsx` | `src/features/customer/facilities/FacilityMapPage.jsx` |
| `src/pages/Home.jsx` | `src/features/customer/home/HomePage.jsx` |
| `src/pages/Overview.jsx` | `src/features/customer/dashboard/CustomerDashboardPage.jsx` |
| `src/pages/Payments.jsx` | `src/features/customer/payments/PaymentListPage.jsx` |
| `src/pages/Profile.jsx` | `src/features/customer/profile/CustomerProfilePage.jsx` |
| `src/pages/Reservations.jsx` | `src/features/customer/reservations/ReservationListPage.jsx` |
| `src/pages/Support.jsx` | `src/features/customer/support/SupportPage.jsx` |
| `src/state/reducer.js` | `src/app/state/appReducer.js` |
| `src/state/selectors.js` | `src/app/state/appSelectors.js` |
| `src/state/store.jsx` | `src/app/state/AppProvider.jsx` |
| `src/state/useAccessQr.js` | `src/features/customer/access/useAccessQr.js` |
| `src/styles/access-qr.css` | `src/shared/styles/access-qr.css` |
| `src/styles/ss.css` | `src/shared/styles/ss.css` |
| `src/ops/StaffPages.jsx` | `src/features/staff/hooks/useStaffIdentity.js`, `src/features/staff/dashboard/StaffDashboardPage.jsx`, `src/features/staff/payments/PaymentConfirmationPage.jsx`, `src/features/staff/handovers/CustomerVerificationPage.jsx`, `src/features/staff/keys/KeyReceiptPage.jsx`, `src/features/staff/returns/ReturnInspectionPage.jsx`, `src/features/staff/support/StaffSupportPage.jsx`, `src/features/staff/results/StaffResultPage.jsx`, `src/features/facility-operations/utils/unitStateTag.js` |
| `src/ops/ManagerPages.jsx` | `src/features/manager/dashboard/ManagerDashboardPage.jsx`, `src/features/manager/units/UnitManagementPage.jsx`, `src/features/manager/allocations/UnitAllocationPage.jsx`, `src/features/manager/components/PageHeaderBlock.jsx`, `src/features/manager/assignments/StaffAssignmentPage.jsx`, `src/features/manager/renewals/RenewalApprovalPage.jsx`, `src/features/manager/contracts/ContractListPage.jsx`, `src/features/manager/reports/FacilityReportPage.jsx`, `src/features/manager/results/ManagerResultPage.jsx` |
| `src/pages/Units.jsx` | `src/features/customer/contracts/components/ContractNotFound.jsx`, `src/features/customer/contracts/RentedUnitListPage.jsx`, `src/features/customer/access/AccessQrModal.jsx`, `src/features/customer/contracts/RentedUnitDetailPage.jsx`, `src/features/customer/contracts/RenewalRequestPage.jsx`, `src/features/customer/contracts/ReturnRequestPage.jsx`, `src/features/customer/requests/RequestSentPage.jsx` |
| `src/pages/Checkout.jsx` | `src/features/customer/reservations/components/ReservationNotFound.jsx`, `src/features/customer/payments/CheckoutPage.jsx`, `src/features/customer/payments/CheckoutFailedPage.jsx`, `src/features/customer/reservations/ReservationDetailPage.jsx` |
| `src/pages/Auth.jsx` | `src/features/auth/utils/safeNext.js`, `src/features/auth/components/ForgotPasswordDialog.jsx`, `src/features/auth/LoginPage.jsx`, `src/features/auth/RegisterPage.jsx` |
| `src/pages/Public.jsx` | `src/features/customer/pricing/PublicPricingPage.jsx`, `src/features/customer/help/HelpPage.jsx` |


## FE bổ sung 25/10/2026

Xem `SafeSpace-Customer-UI/SafeSpace-Customer-UI/APPROVED-FE-README.md` để có bảng route đầy đủ. Các API dự kiến, giới hạn demo và yêu cầu BE ở `APPROVED-FE-API-GAPS.md`. Feature dùng chung: `src/features/facility-operations/workflows`; style: `src/shared/styles/workflows.css`.

## D32 — 26/10/2026

`#/staff/fees` ngừng phục vụ (404 nội bộ); không có nút/queue thu phí trả kho. C11 giữ gia hạn, ẩn phí trả kho chờ thu. Quy tắc FE nằm ở `src/shared/utils/returnPolicy.js`; test `tests/return-policy.test.js`, browser `node scripts/check-return-policy.mjs`. M07 có điều kiện mở theo capability máy chủ, xem BACKEND-TODO T10.
