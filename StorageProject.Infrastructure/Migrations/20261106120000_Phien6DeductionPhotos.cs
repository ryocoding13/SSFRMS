using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StorageProject.Infrastructure.Data;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <summary>
    /// Phiên 6 (06/11/2026): khách đính kèm ảnh hoá đơn / vật dụng thay thế khi phản hồi khấu trừ trả kho
    /// (loại ảnh RETURN_DEDUCTION, ownerId = InspectionId). Chỉ đổi ràng buộc CHECK, không đổi cột, không xoá dữ liệu.
    /// Viết tay vì môi trường soạn chưa chạy được dotnet-ef; snapshot đã cập nhật cùng nội dung.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261106120000_Phien6DeductionPhotos")]
    public partial class Phien6DeductionPhotos : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos");

            migrationBuilder.AddCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos",
                sql: "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT','OVERDUE_BEFORE','OVERDUE_AFTER','SUPPORT_TICKET','RETURN_DEDUCTION')");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos");

            migrationBuilder.AddCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos",
                sql: "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT','OVERDUE_BEFORE','OVERDUE_AFTER','SUPPORT_TICKET')");
        }
    }
}
