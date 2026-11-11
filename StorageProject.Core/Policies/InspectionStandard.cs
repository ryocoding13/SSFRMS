namespace StorageProject.Core.Policies;

/// <summary>
/// D38: quy chuẩn đánh giá biên bản trả kho theo 3 tiêu chí chọn từ danh sách (Figma D30-08).
/// Tiêu chí "đạt tiêu chuẩn" là lựa chọn bắt đầu bằng "Đạt" hoặc "Đã nhận đủ chìa".
/// Chỉ khi đạt tối thiểu 2/3 mục mới được xem là đủ điều kiện cho thuê lại.
/// </summary>
public static class InspectionStandard
{
    /// <summary>
    /// Kiểm tra xem một tiêu chí cụ thể có đạt chuẩn hay không.
    /// </summary>
    /// <param name="value">Văn bản đánh giá của nhân viên.</param>
    /// <returns>True nếu đạt chuẩn, ngược lại false.</returns>
    public static bool Passed(string? value)
    {
        var v = (value ?? string.Empty).Trim();
        return v.StartsWith("Đạt", StringComparison.OrdinalIgnoreCase)
               || v.StartsWith("Đã nhận đủ chìa", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Đếm tổng số tiêu chí đạt chuẩn trên tổng số 3 tiêu chí kiểm tra (Đồ đạc, Tường kho, Chìa khóa).
    /// </summary>
    /// <param name="items">Hiện trạng đồ đạc trong kho (đã dọn sạch hay chưa).</param>
    /// <param name="walls">Hiện trạng tường, sàn, trần kho.</param>
    /// <param name="keys">Hiện trạng bàn giao khóa / thẻ từ.</param>
    /// <returns>Số lượng mục đạt chuẩn (từ 0 đến 3).</returns>
    public static int PassedCount(string? items, string? walls, string? keys) =>
        (Passed(items) ? 1 : 0) + (Passed(walls) ? 1 : 0) + (Passed(keys) ? 1 : 0);
}
