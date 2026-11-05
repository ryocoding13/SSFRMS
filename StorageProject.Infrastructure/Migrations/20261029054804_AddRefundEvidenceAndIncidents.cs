using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRefundEvidenceAndIncidents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DamageItem",
                table: "return_inspections",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FeeReason",
                table: "return_inspections",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundAccountHolder",
                table: "return_inspections",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundAccountNumber",
                table: "return_inspections",
                type: "varchar(19)",
                unicode: false,
                maxLength: 19,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundBankName",
                table: "return_inspections",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundAccountHolder",
                table: "reservations",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundAccountNumber",
                table: "reservations",
                type: "varchar(19)",
                unicode: false,
                maxLength: 19,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RefundBankName",
                table: "reservations",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "evidence_photos",
                columns: table => new
                {
                    PhotoId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OwnerType = table.Column<string>(type: "varchar(30)", unicode: false, maxLength: 30, nullable: false),
                    OwnerId = table.Column<long>(type: "bigint", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ContentType = table.Column<string>(type: "varchar(20)", unicode: false, maxLength: 20, nullable: false),
                    SizeBytes = table.Column<int>(type: "int", nullable: false),
                    Data = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    UploadedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_evidence_photos", x => x.PhotoId);
                    table.CheckConstraint("CK_evidence_photos_content_type", "[ContentType] IN ('image/jpeg','image/png')");
                    table.CheckConstraint("CK_evidence_photos_owner_type", "[OwnerType] IN ('MOVE_OUT','RETURN_INSPECTION','INCIDENT')");
                    table.CheckConstraint("CK_evidence_photos_size", "[SizeBytes] > 0 AND [SizeBytes] <= 5242880");
                    table.ForeignKey(
                        name: "FK_evidence_photos_users_UploadedBy",
                        column: x => x.UploadedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "facility_incidents",
                columns: table => new
                {
                    IncidentId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CaseCode = table.Column<string>(type: "varchar(40)", unicode: false, maxLength: 40, nullable: false),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    OldUnitId = table.Column<long>(type: "bigint", nullable: false),
                    TargetUnitId = table.Column<long>(type: "bigint", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "DRAFT"),
                    Version = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    AffectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Confirmed = table.Column<bool>(type: "bit", nullable: false),
                    Proposal = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ChoiceOption = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ChoiceNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ChoiceAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RefundBankName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RefundAccountNumber = table.Column<string>(type: "varchar(19)", unicode: false, maxLength: 19, nullable: true),
                    RefundAccountHolder = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    MovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RefundPaymentId = table.Column<long>(type: "bigint", nullable: true),
                    CurrentMonthRent = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    UnusedRent = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_facility_incidents", x => x.IncidentId);
                    table.CheckConstraint("CK_facility_incidents_choice", "[ChoiceOption] IS NULL OR [ChoiceOption] IN ('TRANSFER','TERMINATE')");
                    table.CheckConstraint("CK_facility_incidents_proposal", "[Proposal] IS NULL OR [Proposal] IN ('TRANSFER','TERMINATE')");
                    table.CheckConstraint("CK_facility_incidents_status", "[Status] IN ('DRAFT','PROPOSED','TRANSFER_PENDING','TRANSFERRED','TERMINATION_PENDING','TERMINATED')");
                    table.CheckConstraint("CK_facility_incidents_version", "[Version] > 0");
                    table.ForeignKey(
                        name: "FK_facility_incidents_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_facility_incidents_storage_units_OldUnitId",
                        column: x => x.OldUnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_facility_incidents_storage_units_TargetUnitId",
                        column: x => x.TargetUnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_evidence_photos_OwnerType_OwnerId",
                table: "evidence_photos",
                columns: new[] { "OwnerType", "OwnerId" });

            migrationBuilder.CreateIndex(
                name: "IX_evidence_photos_UploadedBy",
                table: "evidence_photos",
                column: "UploadedBy");

            migrationBuilder.CreateIndex(
                name: "IX_facility_incidents_CaseCode",
                table: "facility_incidents",
                column: "CaseCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_facility_incidents_ContractId",
                table: "facility_incidents",
                column: "ContractId",
                unique: true,
                filter: "[Status] IN ('DRAFT','PROPOSED','TRANSFER_PENDING','TERMINATION_PENDING')");

            migrationBuilder.CreateIndex(
                name: "IX_facility_incidents_FacilityId_Status",
                table: "facility_incidents",
                columns: new[] { "FacilityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_facility_incidents_OldUnitId",
                table: "facility_incidents",
                column: "OldUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_facility_incidents_TargetUnitId",
                table: "facility_incidents",
                column: "TargetUnitId",
                unique: true,
                filter: "[TargetUnitId] IS NOT NULL AND [Status] IN ('PROPOSED','TRANSFER_PENDING')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "evidence_photos");

            migrationBuilder.DropTable(
                name: "facility_incidents");

            migrationBuilder.DropColumn(
                name: "DamageItem",
                table: "return_inspections");

            migrationBuilder.DropColumn(
                name: "FeeReason",
                table: "return_inspections");

            migrationBuilder.DropColumn(
                name: "RefundAccountHolder",
                table: "return_inspections");

            migrationBuilder.DropColumn(
                name: "RefundAccountNumber",
                table: "return_inspections");

            migrationBuilder.DropColumn(
                name: "RefundBankName",
                table: "return_inspections");

            migrationBuilder.DropColumn(
                name: "RefundAccountHolder",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "RefundAccountNumber",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "RefundBankName",
                table: "reservations");
        }
    }
}
