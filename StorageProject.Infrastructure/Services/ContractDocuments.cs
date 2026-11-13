using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Hợp đồng giấy (Figma C07g · 13/11): bản in của hợp đồng điện tử, dùng chung cho màn "Hợp đồng giấy"
/// của khách và tệp đính kèm email sau thanh toán. Một mẫu duy nhất để hai nơi luôn giống nhau.
/// </summary>
public sealed record ContractDocument(long Id, string CustomerName, string Facility, string Unit, string UnitType,
    DateOnly StartDate, DateOnly EndDate, decimal Rent, decimal Deposit, string? PolicyVersion,
    IReadOnlyDictionary<string, string> PolicySections)
{
    // Bên A giả lập theo Figma C07g (D58).
    public const string CompanyName = "CÔNG TY TNHH SAFESPACE VIỆT NAM";
    public const string CompanyTaxCode = "0318 246 802";
    public const string Hotline = "0825123676";

    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");
    private static readonly Dictionary<string, string> SectionNames = new()
    {
        ["payment"] = "Thanh toán", ["access"] = "Ra vào kho", ["renewal"] = "Gia hạn",
        ["overdue"] = "Quá hạn", ["return"] = "Trả kho", ["cancellation"] = "Hủy đặt kho", ["support"] = "Hỗ trợ"
    };

    public string? CustomerPhone { get; init; }
    public string? CustomerEmail { get; init; }
    public string? FacilityAddress { get; init; }
    public string? ManagerName { get; init; }
    public decimal? Area { get; init; }
    public bool ClimateControlled { get; init; }
    public string? Floor { get; init; }
    public string? Zone { get; init; }
    /// <summary>Số tháng thuê lúc đặt kho; 0 khi hồ sơ cũ không có đơn đặt chỗ.</summary>
    public int Months { get; init; }
    /// <summary>Ngày hết hạn ban đầu; khác <see cref="EndDate"/> khi đã gia hạn.</summary>
    public DateOnly? OriginalEndDate { get; init; }
    /// <summary>Tiền thuê đã thanh toán cho kỳ ban đầu (không gồm cọc).</summary>
    public decimal? RentPaid { get; init; }
    public DateTime? PaidAtUtc { get; init; }
    public string? PaymentMethod { get; init; }
    public DateTime IssuedAtUtc { get; init; }
    public DateTime? AcceptedAtUtc { get; init; }
    /// <summary>% tiền cọc trừ mỗi ngày quá hạn; null khi chính sách không tính theo % cọc.</summary>
    public decimal? OverdueRatePerDay { get; init; } = OpsRules.DefaultOverdueRatePerDay;
    public decimal CleaningFeeRate { get; init; } = OpsRules.DefaultCleaningFeeRate;

    public string Code => $"HĐ-{StartDate.Year:D4}-{Id:D4}";
    public string FileName => $"SafeSpace-HD-{StartDate.Year:D4}-{Id:D4}.html";
    internal static string Money(decimal amount) => $"{amount.ToString("N0", Vietnamese)} đồng";
    internal static string Date(DateOnly date) => date.ToString("dd/MM/yyyy", Vietnamese);
    private static string Vnd(decimal amount) => $"{amount.ToString("N0", Vietnamese)} đ";
    private static string Percent(decimal value) => $"{value.ToString("0.##", Vietnamese)}%";
    private static DateTime Local(DateTime utc) => utc + OpsRules.ReportOffset;
    private static string Day(DateTime utc) => Local(utc).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
    private static string Clock(DateTime utc) => Local(utc).ToString("HH:mm", CultureInfo.InvariantCulture);
    private static string E(string? value) => Html(value);

    /// <summary>
    /// Mã hoá HTML chỉ các ký tự đặc biệt, giữ nguyên chữ tiếng Việt (WebUtility.HtmlEncode đổi Á, À… thành &amp;#193;).
    /// </summary>
    internal static string Html(string? value) => (value ?? "")
        .Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&#39;");

    private DateOnly InitialEnd => OriginalEndDate ?? EndDate;
    private decimal RentTotal => RentPaid ?? Rent * Math.Max(Months, 1);
    private DateOnly SignedDate => DateOnly.FromDateTime(Local(PaidAtUtc ?? IssuedAtUtc));
    private string MonthsText => Months > 0 ? $"{Months:D2} tháng" : "theo kỳ đã đặt";
    private string PaymentLabel => PaymentMethod == "AT_FACILITY" ? "tại quầy cơ sở" : "qua cổng PayOS";

    private string UnitDescription
    {
        get
        {
            var parts = new List<string> { $"ô kho {Unit}", ClimateControlled ? "kho lạnh" : "kho thường" };
            if (Area is > 0) parts.Add($"diện tích {Area.Value.ToString("0.##", Vietnamese)} m²");
            if (!string.IsNullOrWhiteSpace(Floor)) parts.Add(Floor.StartsWith("Tầng", StringComparison.OrdinalIgnoreCase) ? Floor : $"Tầng {Floor}");
            if (!string.IsNullOrWhiteSpace(Zone)) parts.Add(Zone.StartsWith("Dãy", StringComparison.OrdinalIgnoreCase) ? Zone : $"Dãy {Zone}");
            return string.Join(", ", parts);
        }
    }

    /// <summary>Tóm tắt dạng chữ cho nội dung email.</summary>
    public string Summary =>
        $"Hợp đồng {Code}\nKhách hàng: {CustomerName}\nCơ sở: {Facility}\nÔ kho: {Unit} ({UnitType})\n" +
        $"Kỳ thuê: {Date(StartDate)} – {Date(EndDate)}\nTiền thuê: {Money(Rent)}/tháng\n" +
        $"Tiền cọc: {Money(Deposit)}\nPhiên bản chính sách ban đầu: {PolicyVersion ?? "Chưa lưu phiên bản"}";

    public string ToHtml()
    {
        var html = new StringBuilder();
        void P(string text, string? css = null) =>
            html.Append(css is null ? "<p>" : $"<p class=\"{css}\">").Append(E(text)).Append("</p>\n");
        void Article(string title) => html.Append("<h2>").Append(E(title)).Append("</h2>\n");
        void Row(string label, string? value, string? label2 = null, string? value2 = null, bool bold = false)
        {
            html.Append(label2 is null ? "<div class=\"row one" : "<div class=\"row").Append(bold ? " b\">" : "\">")
                .Append("<span>").Append(E(label)).Append("</span><span>: ").Append(E(value)).Append("</span>");
            if (label2 is not null)
                html.Append("<span>").Append(E(label2)).Append("</span><span>: ").Append(E(value2)).Append("</span>");
            html.Append("</div>\n");
        }

        html.Append($$$"""
            <!doctype html>
            <html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Hợp đồng {{{E(Code)}}} | SafeSpace</title>
            <style>
            @page{size:A4;margin:18mm 20mm}
            *{box-sizing:border-box}
            html{background:#eef2f7}
            body{margin:0;padding:32px 16px;font:15px/1.5 "Times New Roman",Tinos,"Liberation Serif",serif;color:#1a2233}
            .sheet{max-width:210mm;margin:0 auto;background:#fff;padding:18mm 20mm 22mm;border:1px solid #dde3ec;box-shadow:0 4px 16px rgba(15,23,42,.08)}
            p{margin:4px 0}.c{text-align:center}.r{text-align:right}.b{font-weight:700}.i{font-style:italic}.m{color:#5b6b82}
            .nation{font-size:16px}.dash{margin-bottom:10px}
            h1{font-size:22px;line-height:1.3;text-align:center;margin:14px 0 12px}
            h2{font-size:15px;margin:14px 0 4px}
            .row{display:grid;grid-template-columns:110px minmax(0,1.3fr) 96px minmax(0,1fr);column-gap:6px;margin:3px 0}
            .row.one{grid-template-columns:110px minmax(0,1fr)}
            .party{margin-top:10px}.party+p{margin-top:10px}
            table{width:100%;border-collapse:collapse;margin:6px 0}
            th,td{border:1px solid #1a2233;padding:5px 10px;text-align:left}
            th:last-child,td:last-child{text-align:right;white-space:nowrap}
            tr.total td{font-weight:700}
            .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:28px;text-align:center;break-inside:avoid}
            .stamp{display:inline-block;margin:8px 0 14px;padding:6px 12px;border:1.5px dashed #1c64d9;border-radius:6px;color:#1c64d9;font-size:13px;font-weight:700;line-height:1.4}
            .annex{margin-top:32px;padding-top:24px;border-top:1px dashed #c8d1de;break-before:page}
            .annex h3{font-size:15px;margin:12px 0 2px}.annex p{white-space:pre-wrap}
            @media (max-width:640px){body{padding:12px 0}.sheet{padding:24px 18px}.row{grid-template-columns:96px minmax(0,1fr)}.sign{gap:16px}}
            @media print{html{background:#fff}body{padding:0}.sheet{max-width:none;padding:0;border:0;box-shadow:none}.annex{margin-top:0;padding-top:0;border-top:0}}
            </style></head>
            <body><main class="sheet">

            """);

        P("CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM", "c b nation");
        P("Độc lập – Tự do – Hạnh phúc", "c b");
        P("----------oOo----------", "c dash");
        P($"Số: {Code}", "r i");
        html.Append("<h1>HỢP ĐỒNG THUÊ KHO LƯU TRỮ TỰ PHỤC VỤ</h1>\n");
        P("- Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24 tháng 11 năm 2015;", "i");
        P("- Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14 tháng 06 năm 2005;", "i");
        P("- Căn cứ Luật Giao dịch điện tử số 20/2023/QH15 ngày 22 tháng 06 năm 2023;", "i");
        P(PolicyVersion is null
            ? "- Căn cứ Chính sách dịch vụ SafeSpace và nhu cầu của hai bên."
            : $"- Căn cứ Chính sách dịch vụ SafeSpace phiên bản {PolicyVersion} và nhu cầu của hai bên.", "i");
        P($"Hôm nay, ngày {SignedDate.Day:D2} tháng {SignedDate.Month:D2} năm {SignedDate.Year}, tại {Facility}, chúng tôi gồm:", "i party");

        html.Append("<div class=\"party\">\n");
        Row("BÊN A", CompanyName, bold: true);
        P("(Bên cho thuê)", "i m");
        Row("Đại diện", ManagerName ?? "Quản lý cơ sở", "Chức vụ", "Quản lý cơ sở");
        Row("Địa chỉ", FacilityAddress ?? Facility);
        Row("Điện thoại", Hotline, "Mã số thuế", CompanyTaxCode);
        html.Append("</div>\n<div class=\"party\">\n");
        Row("BÊN B", CustomerName.ToUpper(Vietnamese), bold: true);
        P("(Bên thuê)", "i m");
        if (!string.IsNullOrWhiteSpace(CustomerPhone) || !string.IsNullOrWhiteSpace(CustomerEmail))
            Row("Điện thoại", string.IsNullOrWhiteSpace(CustomerPhone) ? "—" : CustomerPhone, "Email", CustomerEmail ?? "—");
        Row("Tài khoản", "Đăng ký trên ứng dụng SafeSpace");
        html.Append("</div>\n");
        P("Hai bên thống nhất ký kết hợp đồng thuê kho với các điều khoản sau:");

        Article("Điều 1. Đối tượng hợp đồng");
        P($"1.1. Bên A cho Bên B thuê {UnitDescription} tại cơ sở {Facility}" +
          (FacilityAddress is null ? "." : $", địa chỉ {FacilityAddress}."));
        P("1.2. Bên B dùng ô kho để lưu trữ đồ dùng, hàng hoá hợp pháp. Không lưu chất cháy nổ, hoá chất độc hại, hàng cấm, động vật sống hoặc thực phẩm dễ hư hỏng không đóng gói.");

        Article("Điều 2. Thời hạn thuê và gia hạn");
        P($"2.1. Thời hạn thuê là {MonthsText}, từ 00:00 ngày {Date(StartDate)} đến hết ngày {Date(InitialEnd)}.");
        P("2.2. Bên B gửi yêu cầu gia hạn trên ứng dụng trước ngày hết hạn. Hệ thống tự kiểm tra lịch trống và chốt giá; hợp đồng chỉ được kéo dài sau khi Bên B thanh toán đủ tiền gia hạn.");
        if (EndDate > InitialEnd) P($"2.3. Hợp đồng đã được gia hạn đến hết ngày {Date(EndDate)}.");

        Article("Điều 3. Giá thuê, tiền cọc và thanh toán");
        P("3.1. Các khoản tiền của hợp đồng:");
        html.Append("<table><tr><th>Khoản</th><th>Số tiền</th></tr>\n")
            .Append($"<tr><td>Giá thuê</td><td>{E(Vnd(Rent))} / tháng</td></tr>\n")
            .Append($"<tr><td>Tiền thuê {E(MonthsText)}</td><td>{E(Vnd(RentTotal))}</td></tr>\n")
            .Append($"<tr><td>Tiền cọc (bằng 01 tháng thuê)</td><td>{E(Vnd(Deposit))}</td></tr>\n")
            .Append($"<tr class=\"total\"><td>{(PaidAtUtc is null ? "Tổng cần thanh toán" : "Tổng đã thanh toán")}</td><td>{E(Vnd(RentTotal + Deposit))}</td></tr>\n</table>\n");
        P(PaidAtUtc is DateTime paid
            ? $"3.2. Bên B đã thanh toán đủ ngày {Day(paid)} {PaymentLabel}. Giá thuê giữ nguyên trong suốt thời hạn thuê."
            : "3.2. Giá thuê giữ nguyên trong suốt thời hạn thuê.");

        Article("Điều 4. Ra vào kho");
        P("4.1. Bên B ra vào bằng mã QR hoặc mã PIN 6 số trên ứng dụng, từ 06:00 đến 22:00 hằng ngày, kể từ 00:00 ngày bắt đầu thuê.");
        P("4.2. Chìa khoá vật lý nhận tại quầy sau khi nhân viên xác minh. Bên B tự bảo quản mã và chìa khoá, không giao cho người khác sử dụng.");
        P("4.3. Mã hết hiệu lực khi hết thời hạn thuê hoặc khi Bên B gửi yêu cầu trả kho thành công.");

        Article("Điều 5. Huỷ đơn và dừng thuê trước hạn");
        P("5.1. Huỷ trước ngày bắt đầu thuê: miễn phí huỷ, Bên B được hoàn 100% tiền thuê và 100% tiền cọc.");
        P("5.2. Từ ngày bắt đầu thuê, Bên B dừng thuê theo thủ tục trả kho. Tiền thuê tính tròn theo các tháng đã bắt đầu; các tháng nguyên chưa bắt đầu được hoàn lại; tiền cọc xử lý theo Điều 6.");

        Article("Điều 6. Trả kho và hoàn cọc");
        P("6.1. Bên B gửi yêu cầu trả kho và chọn ngày trả trên ứng dụng. Nhân viên Bên A kiểm tra ô kho và lập biên bản kèm ảnh hiện trạng.");
        P($"6.2. Ô kho sạch, không hư hỏng: hoàn 100% tiền cọc. Vi phạm vệ sinh: trừ {Percent(CleaningFeeRate)} tiền cọc. Hư hỏng: trừ theo biên bản kiểm tra.");
        P("6.3. Tổng các khoản khấu trừ không vượt quá tiền cọc; Bên B không phải trả thêm khoản nào ngoài tiền cọc.");
        P("6.4. Tiền hoàn được chuyển trong 3–5 ngày làm việc vào tài khoản Bên B khai báo, hoặc nhận tiền mặt tại quầy nếu Bên B chọn.");

        Article("Điều 7. Quá hạn");
        P(OverdueRatePerDay is decimal rate
            ? $"7.1. Quá ngày hết hạn mà Bên B chưa gửi yêu cầu trả kho hoặc gia hạn, từ 00:00 ngày kế tiếp, mỗi ngày trễ trừ {Percent(rate)} tiền cọc ban đầu, tối đa 100% tiền cọc."
            : "7.1. Quá ngày hết hạn mà Bên B chưa gửi yêu cầu trả kho hoặc gia hạn, phí quá hạn trừ vào tiền cọc theo Chính sách dịch vụ, tối đa 100% tiền cọc.");
        P($"7.2. Bên A nhắc Bên B từ ngày quá hạn thứ {OpsRules.DefaultOverdueReminderStartDay} đến thứ {OpsRules.DefaultOverdueReminderEndDay}. " +
          $"Đến ngày thứ {OpsRules.DefaultOverdueDisposalDay}, Bên A lập biên bản, chụp ảnh và chuyển đồ đến Khu tạm giữ đồ quá hạn; Bên B tự chịu trách nhiệm với đồ đã chuyển.");

        Article("Điều 8. Sự cố do cơ sở");
        P("Khi ô kho gặp sự cố do Bên A, Bên B chọn một trong hai phương án: chuyển sang ô tương đương, không phụ phí, giữ nguyên thời hạn và giá thuê; hoặc kết thúc hợp đồng và được hoàn 100% tiền tháng đang thuê, các tháng chưa dùng và 100% tiền cọc.");

        Article("Điều 9. Quyền và nghĩa vụ của các bên");
        P($"9.1. Bên A: bàn giao đúng ô kho, bảo đảm an ninh{(ClimateControlled ? ", nhiệt độ kho lạnh" : "")} và hỗ trợ Bên B qua ứng dụng hoặc hotline {Hotline}.");
        P("9.2. Bên B: sử dụng ô kho đúng mục đích, không cho thuê lại, giữ vệ sinh và trả kho đúng hạn.");

        Article("Điều 10. Điều khoản chung");
        P("10.1. Hợp đồng được xác lập điện tử và có hiệu lực từ khi Bên B thanh toán đủ. " +
          (AcceptedAtUtc is DateTime accepted && PolicyVersion is not null
              ? $"Bên B đã đồng ý Chính sách dịch vụ phiên bản {PolicyVersion} lúc {Clock(accepted)} ngày {Day(accepted)}. "
              : "") +
          "Bản giấy này là bản in của hợp đồng điện tử, có giá trị như nhau.");
        P("10.2. Tranh chấp phát sinh được hai bên thương lượng; không thương lượng được thì đưa ra Toà án có thẩm quyền giải quyết.");

        var buyerStamp = AcceptedAtUtc is DateTime at
            ? $"ĐÃ ĐỒNG Ý ĐIỆN TỬ<br>{Day(at)} · {Clock(at)}"
            : $"ĐÃ XÁC LẬP ĐIỆN TỬ<br>{Date(SignedDate)}";
        html.Append("<div class=\"sign\">\n")
            .Append("<div><p class=\"b\">ĐẠI DIỆN BÊN A</p><p class=\"i m\">(Ký, ghi rõ họ tên)</p>")
            .Append($"<span class=\"stamp\">ĐÃ XÁC LẬP ĐIỆN TỬ<br>{Date(SignedDate)} · SafeSpace</span>")
            .Append($"<p class=\"b\">{E(ManagerName ?? "Quản lý cơ sở")}</p></div>\n")
            .Append("<div><p class=\"b\">BÊN B</p><p class=\"i m\">(Ký, ghi rõ họ tên)</p>")
            .Append($"<span class=\"stamp\">{buyerStamp}</span>")
            .Append($"<p class=\"b\">{E(CustomerName)}</p></div>\n</div>\n");

        // Phụ lục: đúng nội dung phiên bản chính sách khách đã chấp thuận khi đặt kho (bằng chứng D32).
        html.Append("<section class=\"annex\">\n");
        P(PolicyVersion is null ? "PHỤ LỤC · CHÍNH SÁCH DỊCH VỤ ĐÃ ĐỒNG Ý" : $"PHỤ LỤC · CHÍNH SÁCH DỊCH VỤ PHIÊN BẢN {PolicyVersion} ĐÃ ĐỒNG Ý", "c b");
        if (PolicySections.Count == 0)
            P("Hồ sơ chưa có nội dung phiên bản chính sách đã chấp thuận.", "i m");
        foreach (var section in PolicySections)
        {
            html.Append("<h3>").Append(E(SectionNames.GetValueOrDefault(section.Key, section.Key))).Append("</h3>\n");
            P(section.Value);
        }
        html.Append("</section>\n</main></body></html>\n");
        return html.ToString();
    }
}

public static class ContractDocuments
{
    public static async Task<ContractDocument?> LoadAsync(AppDbContext db, long customerId, long contractId,
        CancellationToken ct)
    {
        var contract = await db.RentalContracts.AsNoTracking()
            .Where(c => c.ContractId == contractId && c.CustomerId == customerId && c.Status != "DRAFT")
            .Where(c => c.Status != "CANCELLED" || c.ActivatedAt != null)
            .Select(c => new
            {
                c.ContractId, c.ReservationId, c.Customer.FullName, c.Customer.Phone, c.Customer.Email,
                c.Unit.FacilityId, Facility = c.Unit.Facility.Name, FacilityAddress = c.Unit.Facility.Address,
                Unit = c.Unit.UnitNumber, c.Unit.Floor, c.Unit.Zone, c.Unit.UnitTypeId,
                UnitType = c.Unit.UnitType.TypeName, c.Unit.UnitType.Area, c.Unit.UnitType.ClimateControlled,
                c.StartDate, c.EndDate, c.AgreedMonthlyRate, c.DepositAmount, c.CreatedAt
            })
            .SingleOrDefaultAsync(ct);
        if (contract is null) return null;

        // Đơn đặt chỗ đọc riêng: hồ sơ cũ có thể không còn đơn, hợp đồng vẫn xem được.
        var reservation = contract.ReservationId > 0
            ? await db.Reservations.AsNoTracking().Where(r => r.ReservationId == contract.ReservationId)
                .Select(r => new { r.RentalPeriodMonths, r.ExpectedEndDate, r.EstimatedAmount, r.PaidAt, r.PaymentMethod })
                .FirstOrDefaultAsync(ct)
            : null;

        var policy = await db.PolicyConsents.AsNoTracking()
            .Where(c => c.CustomerId == customerId && c.RenewalId == null &&
                (c.ContractId == contractId || (contract.ReservationId > 0 && c.ReservationId == contract.ReservationId)))
            .OrderByDescending(c => c.AcceptedAt).ThenByDescending(c => c.ConsentId)
            .Select(c => new { c.PolicyVersion.DisplayVersion, c.PolicyVersion.SectionsJson, c.AcceptedAt })
            .FirstOrDefaultAsync(ct);
        var sections = new Dictionary<string, string>();
        if (policy is not null)
        {
            try { sections = JsonSerializer.Deserialize<Dictionary<string, string>>(policy.SectionsJson) ?? sections; }
            catch (JsonException) { /* Hồ sơ cũ có dữ liệu không đọc được. */ }
        }

        var manager = await db.UserFacilities.AsNoTracking()
            .Where(uf => uf.FacilityId == contract.FacilityId && uf.Status == "ACTIVE" && uf.User.Status == "ACTIVE"
                && uf.User.UserRoles.Any(r => r.Role.RoleName == "MANAGER"))
            .OrderBy(uf => uf.AssignedFrom).ThenBy(uf => uf.UserFacilityId)
            .Select(uf => uf.User.FullName)
            .FirstOrDefaultAsync(ct);

        // Phí quá hạn theo chính sách OVERDUE áp dụng cho cơ sở/loại kho (D32, P1); mặc định 5% cọc mỗi ngày.
        var overdue = await OpsRules.FindApplicablePolicyAsync(db, "OVERDUE", contract.FacilityId, contract.UnitTypeId,
            contract.StartDate, ct);
        decimal? overdueRate = OpsRules.DefaultOverdueRatePerDay;
        if (overdue is not null)
            overdueRate = overdue.CalculationType is null or "DEPOSIT_PERCENT_PER_DAY"
                ? overdue.Value ?? OpsRules.DefaultOverdueRatePerDay
                : null;

        return new ContractDocument(contract.ContractId, contract.FullName, contract.Facility, contract.Unit, contract.UnitType,
            contract.StartDate, contract.EndDate, contract.AgreedMonthlyRate, contract.DepositAmount,
            policy?.DisplayVersion, sections)
        {
            CustomerPhone = contract.Phone,
            CustomerEmail = contract.Email,
            FacilityAddress = string.IsNullOrWhiteSpace(contract.FacilityAddress) ? null : contract.FacilityAddress,
            ManagerName = manager,
            Area = contract.Area,
            ClimateControlled = contract.ClimateControlled,
            Floor = contract.Floor,
            Zone = contract.Zone,
            Months = reservation?.RentalPeriodMonths ?? 0,
            OriginalEndDate = reservation?.ExpectedEndDate,
            RentPaid = reservation?.EstimatedAmount,
            PaidAtUtc = reservation?.PaidAt,
            PaymentMethod = reservation?.PaymentMethod,
            IssuedAtUtc = contract.CreatedAt,
            AcceptedAtUtc = policy?.AcceptedAt,
            OverdueRatePerDay = overdueRate
        };
    }
}
