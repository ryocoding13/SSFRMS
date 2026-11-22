using System;
using System.Collections.Generic;
using System.Linq;
using StorageProject.Infrastructure.Services;
using Xunit;

namespace StorageProject.Tests;

/// <summary>D68 (21/11/2026): PDF hợp đồng tiếng Việt đính kèm email, dựng từ đúng bản "Hợp đồng giấy" (ToHtml).</summary>
public class D68ContractPdfTests
{
    private static ContractDocument Sample() => new(
        7, "Nguyễn Văn An", "SafeSpace Nguyễn Lương Bằng", "K07", "Kho thường cỡ M",
        new DateOnly(2026, 11, 21), new DateOnly(2027, 5, 21), 1_005_000m, 1_005_000m, "11/2026",
        new Dictionary<string, string> { ["return"] = "Trả kho theo lịch hẹn; phí thuê tính đến ngày hẹn trả." })
    {
        CustomerPhone = "0901234567", CustomerEmail = "an@example.com", FacilityAddress = "12 Nguyễn Lương Bằng, Quận 7",
        ManagerName = "Trần Thị Bình", Area = 15, Months = 6, IssuedAtUtc = new DateTime(2026, 11, 21, 3, 0, 0, DateTimeKind.Utc),
        AcceptedAtUtc = new DateTime(2026, 11, 21, 2, 55, 0, DateTimeKind.Utc)
    };

    [Fact]
    public void Parse_KeepsEveryArticleTableSignatureAndAnnex_WithVietnameseText()
    {
        var blocks = ContractPdf.Parse(Sample().ToHtml());

        Assert.Contains(blocks, b => b is ContractPdf.Paragraph p && p.Text == "CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM");
        Assert.Contains(blocks, b => b is ContractPdf.Heading { Level: 1 } h && h.Text == "HỢP ĐỒNG THUÊ KHO LƯU TRỮ TỰ PHỤC VỤ");
        Assert.Equal(10, blocks.OfType<ContractPdf.Heading>().Count(h => h.Level == 2)); // Điều 1 … Điều 10
        var table = Assert.Single(blocks.OfType<ContractPdf.MoneyTable>());
        Assert.Equal(4, table.Rows.Count);
        Assert.True(table.Rows[^1].Total);
        var sign = Assert.Single(blocks.OfType<ContractPdf.Signatures>());
        Assert.Contains(sign.Left, part => part.Css == "stamp" && part.Text.Contains('\n'));
        Assert.Contains(sign.Right, part => part.Text == "Nguyễn Văn An");
        Assert.Single(blocks.OfType<ContractPdf.Break>()); // phụ lục sang trang mới
        Assert.Contains(blocks, b => b is ContractPdf.PairRow r && r.Bold && r.Cells.Contains(": CÔNG TY TNHH SAFESPACE VIỆT NAM"));
    }

    [Fact]
    public void Parse_DecodesHtmlEntities()
    {
        var doc = Sample() with { CustomerName = "A & B <test>" };
        var blocks = ContractPdf.Parse(doc.ToHtml());
        Assert.Contains(ContractPdf.Parse(doc.ToHtml()).OfType<ContractPdf.Signatures>().Single().Right, p => p.Text == "A & B <test>");
        Assert.DoesNotContain(blocks.OfType<ContractPdf.Paragraph>(), p => p.Text.Contains("&amp;"));
    }

    [Fact]
    public void Render_ProducesPdf_WithAsciiFileName()
    {
        var doc = Sample();
        var pdf = ContractPdf.Render(doc);
        Assert.True(pdf.Length > 2_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
        Assert.Equal("SafeSpace-HD-2026-0007.pdf", ContractPdf.FileName(doc));
    }
}
