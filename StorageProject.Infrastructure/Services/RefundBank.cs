using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D32 / T08 / Task #10: thông tin tài khoản ngân hàng nhận hoàn tiền (cho phép tài khoản người thân hoặc người khác).
/// Chỉ kiểm tra định dạng/độ dài số tài khoản theo ngân hàng và giữ số 0 đầu; không coi đây là xác minh tài khoản tồn tại thực tế.
/// </summary>
public static class RefundBank
{
    public sealed record BankRule(string Name, string ShortCode, int MinDigits, int MaxDigits, params string[] Aliases);

    public static readonly IReadOnlyList<BankRule> Catalog =
    [
        new("Vietcombank", "VCB", 10, 13, "ngoai thuong"),
        new("VietinBank", "CTG", 12, 14, "icb", "vietin"),
        new("BIDV", "BIDV", 10, 14, "bid"),
        new("Agribank", "VBA", 13, 13),
        new("Techcombank", "TCB", 10, 14),
        new("MB Bank", "MB", 9, 15, "mbb", "mbbank"),
        new("ACB", "ACB", 8, 15),
        new("VPBank", "VPB", 8, 12),
        new("TPBank", "TPB", 11, 12),
        new("Sacombank", "STB", 12, 16),
        new("HDBank", "HDB", 11, 14),
        new("VIB", "VIB", 9, 12),
        new("SHB", "SHB", 10, 14),
        new("MSB", "MSB", 11, 15),
        new("OCB", "OCB", 10, 16),
        new("SeABank", "SEAB", 12, 15),
        new("Eximbank", "EIB", 13, 15),
        new("LPBank", "LPB", 12, 14, "lienvietpostbank"),
    ];

    private static readonly Regex DigitsOnlyPattern = new(@"\A[0-9]+\z");
    private static readonly Regex FallbackAccountPattern = new(@"\A[0-9]{6,19}\z");

    public static BankRule? FindBank(string? bankName)
    {
        var raw = (bankName ?? "").Trim();
        if (raw.Length == 0) return null;
        return Catalog.FirstOrDefault(b =>
            string.Equals(b.Name, raw, StringComparison.OrdinalIgnoreCase)
            || string.Equals(b.ShortCode, raw, StringComparison.OrdinalIgnoreCase)
            || b.Aliases.Any(a => string.Equals(a, raw, StringComparison.OrdinalIgnoreCase)));
    }

    public sealed record Account(string BankName, string AccountNumber, string AccountHolder);

    /// <summary>D42: giá trị lưu ở cột RefundBankName khi khách chọn nhận tiền mặt tại quầy (số tài khoản để trống).</summary>
    public const string CashMethod = "CASH";

    public static bool WantsCash(RefundBankInput? input) =>
        string.Equals((input?.Method ?? "").Trim(), CashMethod, StringComparison.OrdinalIgnoreCase);

    public static bool IsCash(string? bankName) => string.Equals(bankName, CashMethod, StringComparison.Ordinal);

    /// <summary>
    /// allowCash = true ở huỷ đơn và trả kho (D42): khách chọn tiền mặt thì không cần tài khoản, người nhận là khách trên hợp đồng.
    /// </summary>
    public static Account Validate(RefundBankInput? input, string expectedName, bool allowCash)
    {
        var method = (input?.Method ?? "").Trim().ToUpperInvariant();
        if (method.Length > 0 && method is not (CashMethod or "BANK_TRANSFER"))
            throw new ArgumentException("Chọn cách nhận hoàn: chuyển khoản hoặc tiền mặt tại quầy.");
        if (method == CashMethod)
        {
            if (!allowCash) throw new ArgumentException("Khoản hoàn này chỉ hỗ trợ chuyển khoản ngân hàng.");
            return new Account(CashMethod, "", Regex.Replace(expectedName.Trim(), @"\s+", " "));
        }
        return Validate(input, expectedName);
    }

    public static Account Validate(RefundBankInput? input, string expectedName)
    {
        var bank = (input?.BankName ?? "").Trim();
        var number = (input?.AccountNumber ?? "").Trim();
        var holder = Regex.Replace((input?.AccountHolder ?? "").Trim(), @"\s+", " ");
        if (bank.Length == 0) throw new ArgumentException("Vui lòng chọn ngân hàng nhận tiền.");
        if (bank.Length > 100) throw new ArgumentException("Tên ngân hàng tối đa 100 ký tự.");
        var rule = FindBank(bank) ?? throw new ArgumentException("Ngân hàng chưa có trong danh sách hỗ trợ. Vui lòng chọn ngân hàng từ danh sách.");
        if (!DigitsOnlyPattern.IsMatch(number) || number.Length < rule.MinDigits || number.Length > rule.MaxDigits)
        {
            var range = rule.MinDigits == rule.MaxDigits ? $"{rule.MinDigits}" : $"{rule.MinDigits}–{rule.MaxDigits}";
            throw new ArgumentException($"Số tài khoản {rule.Name} phải có {range} chữ số (giữ số 0 đầu).");
        }
        if (holder.Length == 0) throw new ArgumentException("Vui lòng nhập tên chủ tài khoản nhận tiền.");
        if (holder.Length > 150) throw new ArgumentException("Tên chủ tài khoản tối đa 150 ký tự.");
        // Task #10: Không bắt tên người nhận trùng tên đăng ký SafeSpace; cho phép nhận vào tài khoản người thân/người khác.
        _ = expectedName;
        return new Account(rule.Name, number, holder);
    }

    /// <summary>Chuẩn hoá chuỗi tên (bỏ dấu, Đ → D, gộp khoảng trắng, viết hoa).</summary>
    public static string NormalizeHolder(string? value)
    {
        var text = (value ?? "").Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(text.Length);
        foreach (var c in text)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(c is 'đ' or 'Đ' ? 'D' : c);
        }
        return Regex.Replace(sb.ToString().Trim(), @"\s+", " ").ToUpperInvariant();
    }

    public static bool IsComplete(string? bankName, string? accountNumber, string? accountHolder)
    {
        if (string.IsNullOrWhiteSpace(bankName) || accountNumber == null || string.IsNullOrWhiteSpace(accountHolder))
            return false;
        var rule = FindBank(bankName);
        if (rule != null)
            return DigitsOnlyPattern.IsMatch(accountNumber) && accountNumber.Length >= rule.MinDigits && accountNumber.Length <= rule.MaxDigits;
        return FallbackAccountPattern.IsMatch(accountNumber);
    }
}
