using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using StorageProject.Core.DTOs.Evidence;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D32 / T08: tài khoản ngân hàng chính chủ nhận hoàn tiền (kể cả khi khách đã trả tiền mặt).
/// Số tài khoản 6–19 chữ số (giữ số 0 đầu); tên chủ tài khoản trùng tên trên hợp đồng, không phân biệt dấu/hoa thường.
/// </summary>
public static class RefundBank
{
    private static readonly Regex AccountNumberPattern = new(@"\A[0-9]{6,19}\z");

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
            if (!allowCash) throw new ArgumentException("Khoản hoàn này chỉ chuyển khoản vào tài khoản chính chủ.");
            return new Account(CashMethod, "", Regex.Replace(expectedName.Trim(), @"\s+", " "));
        }
        return Validate(input, expectedName);
    }

    public static Account Validate(RefundBankInput? input, string expectedName)
    {
        var bank = (input?.BankName ?? "").Trim();
        var number = (input?.AccountNumber ?? "").Trim();
        var holder = Regex.Replace((input?.AccountHolder ?? "").Trim(), @"\s+", " ");
        if (bank.Length == 0) throw new ArgumentException("Vui lòng nhập tên ngân hàng.");
        if (bank.Length > 100) throw new ArgumentException("Tên ngân hàng tối đa 100 ký tự.");
        if (!AccountNumberPattern.IsMatch(number)) throw new ArgumentException("Số tài khoản phải có từ 6 đến 19 chữ số.");
        if (holder.Length == 0) throw new ArgumentException("Vui lòng nhập tên chủ tài khoản.");
        if (holder.Length > 150) throw new ArgumentException("Tên chủ tài khoản tối đa 150 ký tự.");
        if (NormalizeHolder(holder) != NormalizeHolder(expectedName))
            throw new ArgumentException("Tên chủ tài khoản phải trùng tên trên hợp đồng.");
        return new Account(bank, number, holder);
    }

    /// <summary>Giống normalizeHolder của FE: bỏ dấu, Đ → D, gộp khoảng trắng, viết hoa.</summary>
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

    public static bool IsComplete(string? bankName, string? accountNumber, string? accountHolder) =>
        !string.IsNullOrWhiteSpace(bankName) && accountNumber != null && AccountNumberPattern.IsMatch(accountNumber)
        && !string.IsNullOrWhiteSpace(accountHolder);
}
