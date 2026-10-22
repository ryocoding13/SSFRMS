using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using StorageProject.Infrastructure.Data;

namespace StorageProject.Infrastructure.Services;

public static class CheckoutTransaction
{
    public static async Task<IDbContextTransaction> BeginAsync(AppDbContext db, string resource, CancellationToken ct)
    {
        var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try { await LockAsync(db, resource, ct); return tx; }
        catch { await tx.DisposeAsync(); throw; }
    }

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
