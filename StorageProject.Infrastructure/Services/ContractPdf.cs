using System.Net;
using System.Text.RegularExpressions;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// D68: PDF hợp đồng tiếng Việt đính kèm email phát hành hợp đồng (thay phần "không đính kèm" của D58).
/// Đọc lại đúng bản HTML "Hợp đồng giấy" (<see cref="ContractDocument.ToHtml"/>) để PDF, màn hình và bản in
/// luôn cùng một nội dung; chỉ đổi cách trình bày sang khổ A4. Font Liberation Serif (SIL OFL 1.1, nhúng trong
/// assembly, đủ dấu tiếng Việt) nên không phụ thuộc font của máy chủ.
/// </summary>
public static partial class ContractPdf
{
    private const string Family = "Liberation Serif";
    private static readonly object Gate = new();
    private static bool _ready;

    /// <summary>Tên tệp PDF đính kèm (không dấu để mọi hộp thư hiển thị đúng).</summary>
    public static string FileName(ContractDocument document) => $"SafeSpace-HD-{document.StartDate.Year:D4}-{document.Id:D4}.pdf";

    public static byte[] Render(ContractDocument document)
    {
        EnsureReady();
        var blocks = Parse(document.ToHtml());
        return Document.Create(container => container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.MarginVertical(18, Unit.Millimetre);
            page.MarginHorizontal(20, Unit.Millimetre);
            page.DefaultTextStyle(style => style.FontFamily(Family).FontSize(11.5f).LineHeight(1.35f).FontColor("#1A2233"));
            page.Content().Column(column =>
            {
                column.Spacing(3);
                foreach (var block in blocks) Draw(column, block);
            });
            page.Footer().AlignCenter().Text(text =>
            {
                text.DefaultTextStyle(style => style.FontSize(9).FontColor(Colors.Grey.Darken1));
                text.Span($"{document.Code} · Trang ");
                text.CurrentPageNumber();
                text.Span("/");
                text.TotalPages();
            });
        })).GeneratePdf();
    }

    private static void EnsureReady()
    {
        if (_ready) return;
        lock (Gate)
        {
            if (_ready) return;
            // Đồ án sinh viên, không doanh thu: thuộc diện giấy phép Community của QuestPDF.
            QuestPDF.Settings.License = LicenseType.Community;
            // Tên khách có ký tự ngoài bảng mã font (biểu tượng cảm xúc…) không được làm hỏng việc gửi hợp đồng.
            QuestPDF.Settings.CheckIfAllTextGlyphsAreAvailable = false;
            var assembly = typeof(ContractPdf).Assembly;
            foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)))
            {
                using var stream = assembly.GetManifestResourceStream(name)
                    ?? throw new InvalidOperationException($"Thiếu font nhúng {name}.");
                FontManager.RegisterFont(stream);
            }
            _ready = true;
        }
    }

    // ----------------------------------------------------------------- đọc bản HTML của hợp đồng

    public abstract record Block;
    public sealed record Paragraph(string Text, string Css) : Block;
    public sealed record Heading(int Level, string Text) : Block;
    public sealed record PairRow(IReadOnlyList<string> Cells, bool Bold) : Block;
    public sealed record MoneyTable(IReadOnlyList<(string Label, string Value, bool Total)> Rows) : Block;
    public sealed record Signatures(IReadOnlyList<(string Css, string Text)> Left, IReadOnlyList<(string Css, string Text)> Right) : Block;
    public sealed record Break : Block;

    [GeneratedRegex("^<p(?: class=\"([^\"]*)\")?>(.*)</p>$")] private static partial Regex ParagraphLine();
    [GeneratedRegex("^<h([123])>(.*)</h[123]>$")] private static partial Regex HeadingLine();
    [GeneratedRegex("^<div class=\"row( one)?( b)?\">(.*)</div>$")] private static partial Regex RowLine();
    [GeneratedRegex("<span>(.*?)</span>")] private static partial Regex Span();
    [GeneratedRegex("^<tr( class=\"total\")?><td>(.*?)</td><td>(.*?)</td></tr>$")] private static partial Regex TableRow();
    [GeneratedRegex("<(p|span) class=\"([^\"]*)\">(.*?)</(?:p|span)>")] private static partial Regex SignPart();

    public static IReadOnlyList<Block> Parse(string html)
    {
        var blocks = new List<Block>();
        var lines = html.Split('\n').Select(l => l.Trim()).ToList();
        var start = lines.FindIndex(l => l.StartsWith("<body>", StringComparison.Ordinal));
        List<(string, string, bool)>? table = null;
        var signs = new List<IReadOnlyList<(string, string)>>();
        var inSign = false;
        for (var i = start + 1; i < lines.Count; i++)
        {
            var line = lines[i];
            if (line.Length == 0) continue;
            // Đoạn chính sách ở phụ lục có thể xuống dòng bên trong <p>…</p>: gộp lại thành một đoạn.
            if (line.StartsWith("<p", StringComparison.Ordinal) && !line.EndsWith("</p>", StringComparison.Ordinal))
            {
                var joined = new System.Text.StringBuilder(line);
                while (i + 1 < lines.Count && !joined.ToString().EndsWith("</p>", StringComparison.Ordinal))
                    joined.Append("<br>").Append(lines[++i]);
                line = joined.ToString();
            }
            if (table != null)
            {
                var tr = TableRow().Match(line);
                if (tr.Success) table.Add((Decode(tr.Groups[2].Value), Decode(tr.Groups[3].Value), tr.Groups[1].Success));
                if (line.StartsWith("</table>", StringComparison.Ordinal)) { blocks.Add(new MoneyTable(table)); table = null; }
                continue;
            }
            if (line.StartsWith("<table>", StringComparison.Ordinal)) { table = []; continue; }
            if (line == "<div class=\"sign\">") { inSign = true; signs.Clear(); continue; }
            if (inSign)
            {
                if (line == "</div>")
                {
                    inSign = false;
                    if (signs.Count == 2) blocks.Add(new Signatures(signs[0], signs[1]));
                    continue;
                }
                signs.Add(SignPart().Matches(line).Select(m => (m.Groups[2].Value, Decode(m.Groups[3].Value))).ToList());
                continue;
            }
            if (line.StartsWith("<section class=\"annex\">", StringComparison.Ordinal)) { blocks.Add(new Break()); continue; }
            var p = ParagraphLine().Match(line);
            if (p.Success) { blocks.Add(new Paragraph(Decode(p.Groups[2].Value), p.Groups[1].Value)); continue; }
            var h = HeadingLine().Match(line);
            if (h.Success) { blocks.Add(new Heading(int.Parse(h.Groups[1].Value), Decode(h.Groups[2].Value))); continue; }
            var row = RowLine().Match(line);
            if (row.Success)
            {
                blocks.Add(new PairRow(Span().Matches(row.Groups[3].Value).Select(m => Decode(m.Groups[1].Value)).ToList(), row.Groups[2].Success));
            }
            // <div class="party">, </div>, </section>, </main>… chỉ là khung trình bày.
        }
        return blocks;
    }

    private static string Decode(string html) => WebUtility.HtmlDecode(html.Replace("<br>", "\n"));

    // ----------------------------------------------------------------- vẽ khổ A4

    private static void Draw(ColumnDescriptor column, Block block)
    {
        switch (block)
        {
            case Paragraph p:
                var css = p.Css.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToHashSet();
                column.Item().PaddingTop(css.Contains("party") ? 6 : 0).PaddingBottom(css.Contains("dash") ? 6 : 0).Text(text =>
                {
                    if (css.Contains("c")) text.AlignCenter();
                    else if (css.Contains("r")) text.AlignRight();
                    var span = text.Span(p.Text);
                    if (css.Contains("nation")) span.FontSize(12.5f);
                    if (css.Contains("b")) span.Bold();
                    if (css.Contains("i")) span.Italic();
                    if (css.Contains("m")) span.FontColor(Colors.Grey.Darken2);
                });
                break;
            case Heading { Level: 1 } h:
                column.Item().PaddingVertical(8).Text(text => { text.AlignCenter(); text.Span(h.Text).Bold().FontSize(15); });
                break;
            case Heading h:
                column.Item().PaddingTop(h.Level == 2 ? 6 : 4).Text(text => text.Span(h.Text).Bold());
                break;
            case PairRow r:
                column.Item().Row(row =>
                {
                    void Cell(IContainer cell, string value) => cell.Text(text => { var s = text.Span(value); if (r.Bold) s.Bold(); });
                    Cell(row.ConstantItem(78), r.Cells.ElementAtOrDefault(0) ?? "");
                    Cell(row.RelativeItem(1.3f), r.Cells.ElementAtOrDefault(1) ?? "");
                    if (r.Cells.Count >= 4)
                    {
                        Cell(row.ConstantItem(70).PaddingLeft(6), r.Cells[2]);
                        Cell(row.RelativeItem(), r.Cells[3]);
                    }
                });
                break;
            case MoneyTable t:
                column.Item().PaddingVertical(4).Table(table =>
                {
                    table.ColumnsDefinition(columns => { columns.RelativeColumn(3); columns.RelativeColumn(2); });
                    IContainer Box(IContainer cell) => cell.Border(0.75f).BorderColor("#1A2233").PaddingVertical(3).PaddingHorizontal(6);
                    table.Cell().Element(Box).Text(text => text.Span("Khoản").Bold());
                    table.Cell().Element(Box).AlignRight().Text(text => text.Span("Số tiền").Bold());
                    foreach (var (label, value, total) in t.Rows)
                    {
                        table.Cell().Element(Box).Text(text => { var s = text.Span(label); if (total) s.Bold(); });
                        table.Cell().Element(Box).AlignRight().Text(text => { var s = text.Span(value); if (total) s.Bold(); });
                    }
                });
                break;
            case Signatures s:
                column.Item().PaddingTop(22).ShowEntire().Row(row =>
                {
                    void Side(IContainer side, IReadOnlyList<(string Css, string Text)> parts) => side.Column(c =>
                    {
                        c.Spacing(3);
                        foreach (var (partCss, value) in parts)
                        {
                            if (partCss == "stamp")
                            {
                                c.Item().PaddingVertical(6).AlignCenter().Border(1.2f).BorderColor("#1C64D9").PaddingVertical(4).PaddingHorizontal(10)
                                    .Text(text => { text.AlignCenter(); text.Span(value).Bold().FontSize(10).FontColor("#1C64D9"); });
                                continue;
                            }
                            c.Item().Text(text =>
                            {
                                text.AlignCenter();
                                var span = text.Span(value);
                                if (partCss.Contains('b')) span.Bold();
                                if (partCss.Contains('i')) span.Italic();
                                if (partCss.Contains('m')) span.FontColor(Colors.Grey.Darken2);
                            });
                        }
                    });
                    Side(row.RelativeItem(), s.Left);
                    row.ConstantItem(28);
                    Side(row.RelativeItem(), s.Right);
                });
                break;
            case Break:
                column.Item().PageBreak();
                break;
        }
    }
}
