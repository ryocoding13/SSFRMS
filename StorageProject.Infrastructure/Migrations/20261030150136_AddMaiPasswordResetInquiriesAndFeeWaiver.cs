using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMaiPasswordResetInquiriesAndFeeWaiver : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_payments_status",
                table: "payments");

            migrationBuilder.CreateTable(
                name: "password_reset_challenges",
                columns: table => new
                {
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Nonce = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PasswordFingerprint = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FailedAttempts = table.Column<int>(type: "int", nullable: false),
                    WindowStartedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RequestCount = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_challenges", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_password_reset_challenges_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "support_inquiries",
                columns: table => new
                {
                    InquiryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<long>(type: "bigint", nullable: false),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    ClientRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_inquiries", x => x.InquiryId);
                    table.CheckConstraint("CK_support_inquiries_status", "[Status] IN ('OPEN','WAITING_CUSTOMER','CLOSED')");
                    table.CheckConstraint("CK_support_inquiries_version", "[Version] > 0");
                    table.ForeignKey(
                        name: "FK_support_inquiries_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_support_inquiries_users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "support_inquiry_replies",
                columns: table => new
                {
                    ReplyId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InquiryId = table.Column<long>(type: "bigint", nullable: false),
                    AuthorId = table.Column<long>(type: "bigint", nullable: false),
                    ClientRequestId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CloseRequested = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_inquiry_replies", x => x.ReplyId);
                    table.ForeignKey(
                        name: "FK_support_inquiry_replies_support_inquiries_InquiryId",
                        column: x => x.InquiryId,
                        principalTable: "support_inquiries",
                        principalColumn: "InquiryId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_support_inquiry_replies_users_AuthorId",
                        column: x => x.AuthorId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_payments_status",
                table: "payments",
                sql: "[Status] IN ('PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED','CANCELLED')");

            migrationBuilder.CreateIndex(
                name: "IX_support_inquiries_CustomerId_ClientRequestId",
                table: "support_inquiries",
                columns: new[] { "CustomerId", "ClientRequestId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_support_inquiries_FacilityId_Status",
                table: "support_inquiries",
                columns: new[] { "FacilityId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_support_inquiry_replies_AuthorId",
                table: "support_inquiry_replies",
                column: "AuthorId");

            migrationBuilder.CreateIndex(
                name: "IX_support_inquiry_replies_InquiryId_AuthorId_ClientRequestId",
                table: "support_inquiry_replies",
                columns: new[] { "InquiryId", "AuthorId", "ClientRequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "password_reset_challenges");

            migrationBuilder.DropTable(
                name: "support_inquiry_replies");

            migrationBuilder.DropTable(
                name: "support_inquiries");

            migrationBuilder.DropCheckConstraint(
                name: "CK_payments_status",
                table: "payments");

            migrationBuilder.AddCheckConstraint(
                name: "CK_payments_status",
                table: "payments",
                sql: "[Status] IN ('PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')");
        }
    }
}
