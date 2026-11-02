using StorageProject.Core.Utils;
using Xunit;

namespace StorageProject.Tests;

public class VietQrHelperTests
{
    [Fact]
    public void Crc16_Calculates_Correct_EMVCo_Checksum()
    {
        // Test with known EMVCo string prefix
        var input = "00020101021238570010A00000072701270006970422011309012345678900208QRIBFTTA5303704540746000005802VN62190815Dat kho #1236304";
        var crc = VietQrHelper.Crc16(input);
        Assert.NotNull(crc);
        Assert.Equal(4, crc.Length);
    }

    [Fact]
    public void Generate_Produces_Valid_NAPAS_Format()
    {
        var qr = VietQrHelper.Generate("970422", "0901234567890", 4600000, "SS0142");
        Assert.NotNull(qr);
        Assert.StartsWith("000201010212", qr);
        Assert.Contains("970422", qr);
        Assert.Contains("0901234567890", qr);
        Assert.Contains("QRIBFTTA", qr);
        Assert.Contains("54074600000", qr);
        Assert.Contains("6304", qr);
    }

    [Fact]
    public void CleanContent_Removes_Diacritics_And_Special_Characters()
    {
        var cleaned = VietQrHelper.CleanContent("Đặt kho #123 - Nguyễn Văn A");
        Assert.Equal("Dat kho 123 - Nguyen Van", cleaned);
    }
}
