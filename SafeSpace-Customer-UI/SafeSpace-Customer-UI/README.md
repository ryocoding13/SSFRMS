# SafeSpace — Frontend Customer (React + Vite)

Module Customer có giao diện và thao tác frontend, xây theo ảnh SafeSpace và video bạn cung cấp. Chưa có source đăng nhập của nhóm để merge trực tiếp. Bản này chạy độc lập và có thể đưa vào project React hiện tại; không thay thế trang đăng nhập đã làm.

## Chạy ngay

**Xem nhanh, không cài đặt:** mở `SafeSpace-Customer-Preview.html` bằng Chrome/Edge. Toàn bộ mã và font đã nhúng trong file. Đây là bản demo tương tác, không chỉ là ảnh. Nếu trình xem file của ứng dụng chặn JavaScript, tải file về máy rồi mở bằng trình duyệt.

**Code và chạy dev:** dùng Node.js 22.12+ (khuyến nghị Node 24).

```bash
npm ci
npm run dev
```

Mở URL localhost do Vite in ra. Đường dẫn mặc định: `#/customer/overview`.

```bash
npm run build
npm run preview
npm test
```

`dist/` là bản build sẵn. Không mở trực tiếp `dist/index.html` bằng `file://` vì đây là build có ES module; dùng `npm run preview`. Muốn mở file trực tiếp, dùng bản Preview ở trên.

## Phạm vi đã code

| Trang / luồng                       | URL trong module                      | Thao tác có thể demo                                                           |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| Tổng quan Customer                  | `#/customer/overview`                 | Số kho, khoản cần trả, lịch hẹn, nhắc gia hạn, liên kết nhanh                  |
| Tìm cơ sở / loại kho                | `#/customer/find`                     | Lọc cơ sở, kích thước, giá; kiểm tra ngày và kỳ thuê; empty state              |
| Chi tiết cơ sở                      | `#/customer/find/1`                   | Địa chỉ, giờ hỗ trợ, bảng giá, diện tích, kích thước, chọn loại kho            |
| Đặt kho                             | Modal từ trang tìm / chi tiết         | Ngày thuê, số tháng, dự toán tiền thuê và cọc; xác nhận; tạo đơn               |
| Danh sách đơn đặt                   | `#/customer/reservations`             | Lọc trạng thái, xem đơn                                                        |
| Chi tiết đơn đặt                    | `#/customer/reservations/DC-2026-004` | Tiến độ phân bổ, kỳ thuê, dự toán; hủy đơn chưa phân bổ có lý do               |
| Kho của tôi                         | `#/customer/units`                    | Nhiều kho / hợp đồng; lọc đang sử dụng, chờ nhận, hoàn tất                     |
| Chi tiết kho / hợp đồng             | `#/customer/units/HD-2026-001`        | Giá thuê, ngày kết thúc, cọc, lịch sử gia hạn, thanh toán liên quan            |
| Gia hạn                             | Modal trong chi tiết kho              | Chọn số tháng, tính dự kiến, gửi yêu cầu chờ duyệt, chống gửi trùng            |
| Trả kho                             | Modal trong chi tiết kho              | Chọn ngày, ghi chú, xác nhận; chuyển sang chờ kiểm tra                         |
| Thanh toán                          | `#/customer/payments`                 | Khoản cần trả, đã trả, chờ xác minh; lọc theo hợp đồng                         |
| Chi tiết / gửi thông báo thanh toán | `#/customer/payments/TT-2026-008`     | Chuyển khoản hoặc tiền mặt; gửi thông báo mẫu; chặn gửi trùng                  |
| Lịch nhận kho / bàn giao            | `#/customer/appointments`             | Xem lịch, điều kiện nhận, biên bản; chỉ xác nhận sau khi nhân viên đã kiểm tra |
| Yêu cầu hỗ trợ                      | `#/customer/support`                  | Danh sách, lọc đang xử lý / đã giải quyết                                      |
| Tạo yêu cầu hỗ trợ                  | `#/customer/support/new`              | Chọn hợp đồng, loại vấn đề, nhập nội dung và gửi                               |
| Chi tiết hỗ trợ                     | `#/customer/support/HT-2026-012`      | Nội dung, loại vấn đề, hợp đồng và tiến độ xử lý                               |
| Hồ sơ cá nhân                       | `#/customer/profile`                  | Sửa họ tên, điện thoại; kiểm tra dữ liệu; email chỉ đọc                        |

Các trang có bố cục responsive. Menu bên trái đổi thành drawer trên điện thoại; bảng có vùng cuộn ngang riêng. Có trạng thái chưa có dữ liệu, thông báo thành công/lỗi, label cho input, focus modal và phím Escape.

## Nhận xét từ video và ảnh

- Đầu video thấy terminal **Vite v8.3.0**, các file `src/App.jsx`, `src/index.css`; cách dùng state là React. Vì vậy module dùng React + CSS, không thêm UI framework hay React Router.
- Khoảng giây 20–30: form đăng ký dạng modal trắng, nút xanh, label trên input; lỗi viền đỏ và thông báo bên dưới. Module đặt kho / gia hạn / hỗ trợ giữ cách phản hồi này.
- Khoảng giây 40–100: bộ tìm kiếm có cơ sở, loại kho, ngày bắt đầu, số tháng; video minh họa kiểm tra ngày và kỳ thuê. Module kiểm tra hai trường này trước khi tạo yêu cầu.
- Ảnh cung cấp chốt nhận diện **SafeSpace**: trắng, navy, xanh dương, card bo góc, search panel nổi ở chân hero. Các trang Customer kế thừa cùng hệ màu, khoảng cách và loại nút.
- Font chính xác không thể xác định chỉ qua video. Bản code chọn **Inter**, nhúng font tiếng Việt để hiển thị ổn định. Icon và minh họa kho là SVG cục bộ, không phụ thuộc ảnh mạng hoặc ảnh lỗi trong mẫu.
- Kích thước Small/Medium/Large theo video lần lượt **5 / 12 / 20 m²**, giá mẫu **500.000 / 1.200.000 / 2.000.000 đ/tháng** tại hai cơ sở đầu. Ảnh tĩnh có thông số khác, nên `src/data.js` gom tất cả để nhóm sửa theo dữ liệu cuối cùng.
- Header SafeSpace giữ nhận diện ảnh; sidebar là phần bổ sung cho khu vực đã đăng nhập. Video không cho thấy bộ trang Customer hoàn chỉnh, nên cách tổ chức các trang này được thiết kế từ chức năng giáo viên giao.

## Ghép vào phần đăng nhập của nhóm

### 1. Chép module

Chép các file sau từ `src/` của gói này vào `src/customer/` trong project nhóm, giữ cấu trúc tương đối:

- `CustomerApp.jsx`, `customer.css`, `context.js`, `data.js`, `domain.js`
- thư mục `components/`, `pages/`

Không ghi đè `App.jsx`, `main.jsx`, `index.css`, `package.json` hoặc `package-lock.json` của project nhóm.

Nếu nhóm đã có React/ReactDOM, chỉ thêm font:

```bash
npm install @fontsource/inter
```

Module dùng các React hook thông thường và `useId` (React 18+). Bản chạy độc lập đã được build với phiên bản khóa trong `package-lock.json` của gói này. Không cần nâng phiên bản project nhóm chỉ để copy UI.

### 2. Hiển thị Customer sau đăng nhập thành công

Ví dụ cách đặt vào `App.jsx` hiện tại — đây là đoạn minh họa tích hợp, không phải thay toàn bộ component của nhóm:

```jsx
import { useState } from "react";
import CustomerApp from "./customer/CustomerApp";

function App() {
  const [showCustomer, setShowCustomer] = useState(false);

  // Giữ TOÀN BỘ hook khác của nhóm trước mọi conditional return.
  // Trong nhánh xử lý đăng nhập thành công đang có:
  //   setShowCustomer(true);
  //   window.location.hash = '/customer/overview';
  // Chỉ làm điều này sau khi xác thực xong nếu đã có backend.

  if (showCustomer) {
    return (
      <CustomerApp
        storageKey="safespace.customer.demo.v1"
        onLogout={() => {
          // Gọi logic đăng xuất hiện tại của nhóm nếu đã có.
          setShowCustomer(false);
          window.location.hash = "";
        }}
      />
    );
  }

  // return JSX trang chủ / modal đăng nhập hiện có của nhóm;
}
```

- `showCustomer` chỉ là cờ chuyển màn hình để demo. Không coi cờ React hoặc hash URL là xác thực/phân quyền.
- Không tạo thêm `createRoot()` khi ghép; chỉ import component như trên.
- Không truyền thông tin đăng nhập thật vào dữ liệu demo. Hồ sơ Nguyễn Minh Anh là nhân vật mẫu, chưa phải người dùng lấy từ login/API.
- CSS được scope dưới `.ss-app` để hạn chế ảnh hưởng form đăng nhập. Module có header riêng; khi hiển thị Customer, không render thêm header công khai ở bên ngoài.
- Module hiện tự đọc hash `#/customer/...`. Nếu project đang dùng `HashRouter`, cần chuyển các đường dẫn sang router của nhóm trước khi ghép; không mount hai hash router cùng lúc.
- Khi chưa truyền `onLogout`, nút Đăng xuất hiển thị thông báo chưa nối phần đăng nhập. Khi ghép, callback phải gọi logic logout thực tế của nhóm.

## Cấu trúc source

| File                             | Vai trò                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `src/CustomerApp.jsx`            | Layout, header/sidebar, điều hướng hash, state demo, thông báo, callback logout |
| `src/customer.css`               | Toàn bộ style Customer, design tokens, responsive                               |
| `src/components/UI.jsx`          | Button, Field, Badge, Modal, card primitives, SVG icon/minh họa                 |
| `src/components/ActionModal.jsx` | Form đặt kho, hủy, thanh toán, gia hạn, trả kho, xác nhận bàn giao              |
| `src/pages/Overview.jsx`         | Dashboard và card kho dùng chung                                                |
| `src/pages/FindStorage.jsx`      | Tìm kho và chi tiết cơ sở                                                       |
| `src/pages/Records.jsx`          | Đơn đặt, kho/hợp đồng, thanh toán, lịch nhận                                    |
| `src/pages/Support.jsx`          | Hỗ trợ và hồ sơ                                                                 |
| `src/data.js`                    | Toàn bộ dữ liệu mẫu                                                             |
| `src/domain.js`                  | Format tiền/ngày, tính tháng, kiểm tra và lệnh Customer                         |
| `tests/domain.test.js`           | Kiểm tra các quy tắc quan trọng                                                 |
| `preview/`                       | Ảnh chụp thật từ trình duyệt và kết quả kiểm tra UI                             |

Đổi màu: các biến `--ss-primary`, `--ss-navy`, `--ss-bg` ở đầu `customer.css`. Đổi tên thương hiệu: phần `.ss-brand` trong `CustomerApp.jsx`. Đổi giá, diện tích, cơ sở: `data.js`.

## Ranh giới demo và phần backend cần nối

Bản này là **frontend UI có tương tác**, không phải hệ thống cho thuê hoàn chỉnh. State được lưu bằng `localStorage`, chỉ trên trình duyệt đang dùng. Có nút “Đặt lại dữ liệu mẫu” và hộp thoại xác nhận. Ngày của dữ liệu mới được tạo tương đối theo ngày mở demo, không cố định ngày quá khứ. Khi dữ liệu đã lưu, ngày trong mẫu giữ nguyên cho đến khi reset.

Tên trường chính bám Data Dictionary: `reservation_id`, `facility_id`, `unit_type_id`, `start_date`, `rental_period_months`, `contract_id`, `payment_id`, `issue_type`… Các quy tắc:

1. Đặt theo cơ sở + loại kho. Tạo reservation `PENDING_PAYMENT` và hiển thị “Chờ phân bổ” trong giai đoạn chưa có assignment/hợp đồng. Không tự tạo số kho, hợp đồng hoặc nghĩa vụ thanh toán từ browser.
2. Mức cọc 1 tháng và giới hạn 1–24 tháng là **giả định cho demo**, không phải chính sách đã xác nhận. Giá trên màn hình là dự toán.
3. Filter giá/cơ sở/kích thước hoạt động thực. Số lượng khả dụng là fixture, **chưa kiểm tra chồng lấn ngày thuê**. Khi nối API phải kiểm tra cả khoảng `[start_date, expected_end_date)` và giữ chỗ có thời hạn tại server.
4. Gia hạn tạo `PENDING`; không đổi `end_date` khi khách gửi. Cần manager duyệt, áp dụng giá, tạo khoản phí và xác nhận `PAID` trước khi cập nhật hợp đồng.
5. Khách gửi thông báo chuyển khoản/tiền mặt chỉ giữ payment `PENDING`. Bản demo không có tài khoản ngân hàng nhận tiền, QR thanh toán, hay kết nối cổng thanh toán.
6. `paymentNotices` là state UI riêng, không phải enum thanh toán mới trong database. “Chờ xác minh” là nhãn hiển thị, không gửi thành giá trị `payments.status`.
7. `returnRequests` là state UI cho yêu cầu trả kho, chưa có bảng riêng trong Data Dictionary. Khi nối backend, thống nhất API cập nhật hợp đồng/audit và để nhân viên tạo `return_inspections`. Không ghi `PENDING` của view này vào enum `return_inspections.status` (bảng đó dùng `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`). Không tự hoàn tiền cọc hoặc đánh dấu kho AVAILABLE.
8. Chỉ khách xác nhận phần `customer_confirmed` sau khi nhân viên đã kiểm tra; không tự đặt `staff_confirmed`, kích hoạt hợp đồng hay bàn giao khóa. Dữ liệu mẫu có một lịch chưa kiểm tra và một biên bản đã hoàn tất.
9. Đơn chưa phân bổ có thể hủy trực tiếp trong demo. Đơn đã phân bổ/xác nhận chuyển sang hỗ trợ để cơ sở xử lý theo chính sách, tránh tự hủy khoản phí hoặc hợp đồng liên quan.
10. Support chọn hợp đồng thuộc khách hàng và suy ra unit tương ứng. Không có file đính kèm, chat thread hoặc feedback rating vì Data Dictionary hiện tại chưa có cấu trúc cho các phần đó.
11. Hồ sơ chỉ thay họ tên và điện thoại trong demo. Đổi email, mật khẩu, xác thực, quyền truy cập, phân trang, cập nhật thời gian thực và quyền theo customer phải nối hệ thống thật.
12. Kiểm tra trong `domain.js` giúp UI phản hồi; **mọi kiểm tra quan trọng phải lặp lại ở server**, đặc biệt ownership, khả dụng, tiền và trạng thái.

Điểm thay mock: `command()` trong `CustomerApp.jsx` hiện gọi `reduceCustomer()`. Khi nối API, chuyển command thành async service, lấy dữ liệu mới từ server; thêm trạng thái loading/disabled và xử lý lỗi request. Không đồng bộ nguyên object localStorage vào database. Các collections `facilities`, `unitTypes`, `rates`, `units`, `contracts`, `payments`, `handovers`, `tickets`, `renewals` sẽ nhận dữ liệu API thay cho `createDemoData()`.

## Kịch bản demo ngắn

1. Tổng quan → Tìm & đặt kho → lọc cơ sở/loại/giá → Đặt chỗ → nhập kỳ thuê → đồng ý → gửi. Xem đơn “Chờ phân bổ”.
2. Tại chi tiết đơn mới → Hủy đơn → nhập lý do → xác nhận.
3. Thanh toán → khoản TT-2026-008 → Thanh toán → chọn phương thức → gửi thông báo mẫu. Trạng thái chuyển sang nhãn “Chờ xác minh”, không phải “Đã thanh toán”.
4. Kho A-102 → gia hạn 3 tháng → gửi → xem lịch sử chờ duyệt; ngày kết thúc chưa thay đổi.
5. Kho B-015 → yêu cầu trả kho → chọn ngày → xác nhận → xem trạng thái “Chờ trả kho”.
6. Yêu cầu hỗ trợ → tạo yêu cầu → chọn hợp đồng, nhập nội dung → xem tiến độ mới gửi.
7. Hồ sơ → thử số điện thoại sai rồi sửa đúng → lưu. Reload để kiểm tra dữ liệu được giữ lại.
8. Thu nhỏ trình duyệt về điện thoại → mở menu → kiểm tra điều hướng, form, bảng cuộn ngang.

## Kiểm tra đã thực hiện

- `npm run build`: build production thành công.
- `npm test`: 9 bài kiểm tra về tháng lịch, ngày thuê, đặt kho, thanh toán, gia hạn, trả kho, bàn giao, support và hủy đơn.
- Kết quả chạy trình duyệt và phạm vi viewport được ghi trong `preview/browser-checks.json`.
- Ảnh trong `preview/` là ảnh render thật của frontend, không phải bản vẽ wireframe.

Chưa kiểm thử trên Safari/iOS thật và chưa thể kiểm tra ghép với source nhóm vì source đó chưa được cung cấp.
