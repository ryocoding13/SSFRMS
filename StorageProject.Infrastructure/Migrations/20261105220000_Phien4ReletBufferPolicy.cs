using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StorageProject.Infrastructure.Data;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <summary>
    /// Phiên 4 (05/11/2026) · D41: thêm loại chính sách RELET_BUFFER (số ngày đệm sau ngày hết hạn trước khi ô được
    /// đặt cho khách mới; không có chính sách thì mặc định 3 ngày). Chỉ đổi ràng buộc CHECK, không đổi cột, không thêm dữ liệu.
    /// Viết tay vì môi trường soạn chưa chạy được dotnet-ef; snapshot đã cập nhật cùng nội dung.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261105220000_Phien4ReletBufferPolicy")]
    public partial class Phien4ReletBufferPolicy : Migration
    {
        private const string Before = "[PolicyType] IN ('DEPOSIT','RENEWAL','CANCELLATION','RETURN','OVERDUE','EXTRA_FEE','DISCOUNT','FEE_WAIVER','PRICE_RANGE')";
        private const string After = "[PolicyType] IN ('DEPOSIT','RENEWAL','CANCELLATION','RETURN','OVERDUE','EXTRA_FEE','DISCOUNT','FEE_WAIVER','PRICE_RANGE','RELET_BUFFER')";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(name: "CK_policies_policy_type", table: "policies");
            migrationBuilder.AddCheckConstraint(name: "CK_policies_policy_type", table: "policies", sql: After);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(name: "CK_policies_policy_type", table: "policies");
            migrationBuilder.AddCheckConstraint(name: "CK_policies_policy_type", table: "policies", sql: Before);
        }
    }
}
