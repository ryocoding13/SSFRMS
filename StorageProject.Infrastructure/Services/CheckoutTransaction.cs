using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

/// <summary>
/// Quản lý giao dịch cấp cao và phân tán với khoá độc quyền tài nguyên (Distributed Application Lock).
/// Đảm bảo tính nhất quán dữ liệu (ACID) và ngăn chặn race condition khi thanh toán, giữ chỗ và xử lý hợp đồng.
/// </summary>
public static class CheckoutTransaction
{
    /// <summary>
    /// Bắt đầu một transaction với mức cô lập Serializable và chiếm giữ khoá độc quyền trên tài nguyên chỉ định.
    /// </summary>
    /// <param name="db">DbContext kết nối cơ sở dữ liệu hiện tại.</param>
    /// <param name="resource">Tên chuỗi định danh tài nguyên cần khoá (ví dụ: "reservation:123", "contract:456").</param>
    /// <param name="ct">Token hủy thao tác không đồng bộ.</param>
    /// <returns>Đối tượng giao dịch DbContextTransaction được quản lý.</returns>
    public static async Task<IDbContextTransaction> BeginAsync(AppDbContext db, string resource, CancellationToken ct)
    {
        var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try 
        { 
            await LockAsync(db, resource, ct); 
            return tx; 
        }
        catch 
        { 
            await tx.DisposeAsync(); 
            throw; 
        }
    }

    /// <summary>
    /// Chiếm giữ khoá ứng dụng độc quyền (Exclusive Lock) qua thủ tục sp_getapplock trên SQL Server.
    /// Giúp đồng bộ hoá giữa nhiều tiến trình/worker khác nhau, tự giải phóng khi transaction kết thúc hoặc timeout sau 10 giây.
    /// </summary>
    /// <param name="db">DbContext kết nối cơ sở dữ liệu hiện tại.</param>
    /// <param name="resource">Tên tài nguyên cần khoá.</param>
    /// <param name="ct">Token hủy thao tác không đồng bộ.</param>
    public static async Task LockAsync(AppDbContext db, string resource, CancellationToken ct)
    {
        // SQL Server transaction-owned lock works across processes, unlike an in-memory semaphore.
        if (db.Database.IsSqlServer())
            await db.Database.ExecuteSqlInterpolatedAsync($@"
                DECLARE @result int;
                EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive',
                    @LockOwner='Transaction', @LockTimeout=10000;
                IF @result < 0 THROW 51000, N'Không lấy được khoá giao dịch. Vui lòng thử lại.', 1;", ct);
    }
}
