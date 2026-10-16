using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StorageProject.Infrastructure.Data;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <summary>
    /// F03 / BACKEND-TODO A4: đơn đặt chỗ có thêm trạng thái PENDING_VERIFICATION
    /// (khách đã bấm "Tôi đã chuyển khoản", chờ nhân viên đối soát).
    /// Viết tay vì chỉ đổi một ràng buộc CHECK; AppDbContextModelSnapshot đã cập nhật tương ứng.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261014150000_ReservationPendingVerification")]
    public partial class ReservationPendingVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations");

            migrationBuilder.AddCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations",
                sql: "[Status] IN ('PENDING_PAYMENT','PENDING_VERIFICATION','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Đơn đang chờ đối soát quay về chờ chuyển khoản trước khi bỏ trạng thái
            migrationBuilder.Sql("UPDATE [reservations] SET [Status] = 'PENDING_PAYMENT' WHERE [Status] = 'PENDING_VERIFICATION'");

            migrationBuilder.DropCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations");

            migrationBuilder.AddCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations",
                sql: "[Status] IN ('PENDING_PAYMENT','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");
        }
    }
}
