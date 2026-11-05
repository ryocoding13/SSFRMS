using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StorageProject.Infrastructure.Data;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <summary>
    /// Phiên 3 (05/11/2026): S06 tách ảnh hồ sơ quá hạn (OVERDUE_BEFORE/OVERDUE_AFTER) khỏi RETURN_INSPECTION;
    /// D35 lưu ảnh yêu cầu hỗ trợ (SUPPORT_TICKET). Chỉ đổi ràng buộc CHECK, không đổi cột.
    /// Ảnh quá hạn cũ được chuyển loại khi khởi động (DbSeeder.ApplyPhien3DataFixesAsync), không xoá dữ liệu.
    /// Viết tay vì môi trường soạn chưa chạy được dotnet-ef; snapshot đã cập nhật cùng nội dung.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261105120000_Phien3EvidenceOwnerTypes")]
    public partial class Phien3EvidenceOwnerTypes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos");

            migrationBuilder.AddCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos",
                sql: "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT','OVERDUE_BEFORE','OVERDUE_AFTER','SUPPORT_TICKET')");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos");

            migrationBuilder.AddCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos",
                sql: "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT')");
        }
    }
}
