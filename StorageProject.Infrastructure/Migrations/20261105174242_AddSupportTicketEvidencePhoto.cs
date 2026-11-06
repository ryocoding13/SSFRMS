using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSupportTicketEvidencePhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos");

            migrationBuilder.AddCheckConstraint(
                name: "CK_evidence_photos_owner_type",
                table: "evidence_photos",
                sql: "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT','SUPPORT_TICKET')");
        }

        /// <inheritdoc />
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
