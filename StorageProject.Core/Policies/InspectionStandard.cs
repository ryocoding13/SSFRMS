namespace StorageProject.Core.Policies;

/// <summary>
/// D38: biên bản trả kho có 3 mục chọn từ danh sách (Figma D30-08). Mục "đạt tiêu chuẩn" là lựa chọn bắt đầu bằng
/// "Đạt" hoặc "Đã nhận đủ chìa". Biên bản cũ ghi tay không khớp mẫu thì coi như chưa đạt (không tự nâng kết luận).
/// </summary>
public static class InspectionStandard
{
    public static bool Passed(string? value)
    {
        var v = (value ?? string.Empty).Trim();
        return v.StartsWith("Đạt", StringComparison.OrdinalIgnoreCase)
               || v.StartsWith("Đã nhận đủ chìa", StringComparison.OrdinalIgnoreCase);
    }

    public static int PassedCount(string? items, string? walls, string? keys) =>
        (Passed(items) ? 1 : 0) + (Passed(walls) ? 1 : 0) + (Passed(keys) ? 1 : 0);
}
