using System.Globalization;
using System.Text;

namespace StorageProject.Core.Utils;

/// <summary>
/// Hỗ trợ tạo chuỗi mã VietQR chuẩn EMVCo / NAPAS 247 để quét bằng ứng dụng ngân hàng.
/// </summary>
public static class VietQrHelper
{
    private static string Tlv(string id, string value) => $"{id}{value.Length:D2}{value}";

    public static string Crc16(string input)
    {
        ushort crc = 0xFFFF;
        foreach (var c in input)
        {
            crc ^= (ushort)(c << 8);
            for (var b = 0; b < 8; b++)
            {
                crc = (crc & 0x8000) != 0 ? (ushort)((crc << 1) ^ 0x1021) : (ushort)(crc << 1);
            }
        }
        return crc.ToString("X4");
    }

    public static string Generate(string bin, string accountNo, long amount, string content)
    {
        var beneficiary = Tlv("00", bin) + Tlv("01", accountNo);
        var merchant = Tlv("00", "A000000727") + Tlv("01", beneficiary) + Tlv("02", "QRIBFTTA");
        var body = Tlv("00", "01") +
                   Tlv("01", "12") +
                   Tlv("38", merchant) +
                   Tlv("53", "704") +
                   (amount > 0 ? Tlv("54", amount.ToString()) : "") +
                   Tlv("58", "VN") +
                   (!string.IsNullOrWhiteSpace(content) ? Tlv("62", Tlv("08", CleanContent(content))) : "") +
                   "6304";
        return body + Crc16(body);
    }

    public static string CleanContent(string s)
    {
        var normalized = s.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(c);
            if (uc != UnicodeCategory.NonSpacingMark)
            {
                if (c is >= 'A' and <= 'Z' or >= 'a' and <= 'z' or >= '0' and <= '9' or ' ' or '-')
                {
                    sb.Append(c);
                }
                else if (c is 'đ' or 'Đ')
                {
                    sb.Append(c == 'đ' ? 'd' : 'D');
                }
            }
        }
        var res = sb.ToString().Trim();
        return res.Length > 25 ? res[..25].Trim() : res;
    }
}
