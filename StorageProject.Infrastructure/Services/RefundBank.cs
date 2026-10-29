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
    private static readonly Regex AccountNumberPattern = new(@"^\d{6,19}$");

    public sealed record Account(string BankName, string AccountNumber, string AccountHolder);

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
