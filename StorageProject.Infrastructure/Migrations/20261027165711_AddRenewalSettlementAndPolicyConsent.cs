using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRenewalSettlementAndPolicyConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_payments_RenewalId",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_contract_renewals_ContractId",
                table: "contract_renewals");

            migrationBuilder.DropCheckConstraint(
                name: "CK_contract_renewals_status",
                table: "contract_renewals");

            migrationBuilder.AddColumn<DateTime>(
                name: "AcceptedAt",
                table: "contract_renewals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AppliedAt",
                table: "contract_renewals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpiredAt",
                table: "contract_renewals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentDeadlineAt",
                table: "contract_renewals",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PolicyVersion",
                table: "contract_renewals",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "payment_checkouts",
                columns: table => new
                {
                    CheckoutId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PaymentId = table.Column<long>(type: "bigint", nullable: false),
                    OrderCode = table.Column<long>(type: "bigint", nullable: false),
                    Provider = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "PAYOS"),
                    Amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    CheckoutUrl = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    QrCode = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payment_checkouts", x => x.CheckoutId);
                    table.CheckConstraint("CK_payment_checkouts_amount", "[Amount] >= 0");
                    table.CheckConstraint("CK_payment_checkouts_status", "[Status] IN ('PENDING','PAID','CANCELLED','EXPIRED')");
                    table.ForeignKey(
                        name: "FK_payment_checkouts_payments_PaymentId",
                        column: x => x.PaymentId,
                        principalTable: "payments",
                        principalColumn: "PaymentId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "rental_policy_versions",
                columns: table => new
                {
                    PolicyVersionId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Version = table.Column<int>(type: "int", nullable: false),
                    DisplayVersion = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Rate = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    SectionsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PublishedBy = table.Column<long>(type: "bigint", nullable: false),
                    PublishedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsCurrent = table.Column<bool>(type: "bit", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_policy_versions", x => x.PolicyVersionId);
                    table.CheckConstraint("CK_rental_policy_versions_rate", "[Rate] >= 0 AND [Rate] <= 100");
                    table.CheckConstraint("CK_rental_policy_versions_version", "[Version] > 0");
                    table.ForeignKey(
                        name: "FK_rental_policy_versions_users_PublishedBy",
                        column: x => x.PublishedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "policy_consents",
                columns: table => new
                {
                    ConsentId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<long>(type: "bigint", nullable: false),
                    PolicyVersionId = table.Column<long>(type: "bigint", nullable: false),
                    ReservationId = table.Column<long>(type: "bigint", nullable: true),
                    ContractId = table.Column<long>(type: "bigint", nullable: true),
                    RenewalId = table.Column<long>(type: "bigint", nullable: true),
                    AcceptedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Channel = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "WEB_CUSTOMER")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policy_consents", x => x.ConsentId);
                    table.ForeignKey(
                        name: "FK_policy_consents_contract_renewals_RenewalId",
                        column: x => x.RenewalId,
                        principalTable: "contract_renewals",
                        principalColumn: "RenewalId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_policy_consents_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_policy_consents_rental_policy_versions_PolicyVersionId",
                        column: x => x.PolicyVersionId,
                        principalTable: "rental_policy_versions",
                        principalColumn: "PolicyVersionId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_policy_consents_reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalTable: "reservations",
                        principalColumn: "ReservationId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_policy_consents_users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_payments_RenewalId",
                table: "payments",
                column: "RenewalId",
                unique: true,
                filter: "[PaymentType] = 'RENEWAL' AND [RenewalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_contract_renewals_ContractId",
                table: "contract_renewals",
                column: "ContractId",
                unique: true,
                filter: "[Status] IN ('PENDING','APPROVED')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_contract_renewals_status",
                table: "contract_renewals",
                sql: "[Status] IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED','EXPIRED')");

            migrationBuilder.CreateIndex(
                name: "IX_payment_checkouts_OrderCode",
                table: "payment_checkouts",
                column: "OrderCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payment_checkouts_PaymentId",
                table: "payment_checkouts",
                column: "PaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_policy_consents_ContractId",
                table: "policy_consents",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_policy_consents_CustomerId_PolicyVersionId",
                table: "policy_consents",
                columns: new[] { "CustomerId", "PolicyVersionId" });

            migrationBuilder.CreateIndex(
                name: "IX_policy_consents_PolicyVersionId",
                table: "policy_consents",
                column: "PolicyVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_policy_consents_RenewalId",
                table: "policy_consents",
                column: "RenewalId",
                filter: "[RenewalId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_policy_consents_ReservationId",
                table: "policy_consents",
                column: "ReservationId",
                filter: "[ReservationId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_rental_policy_versions_IsCurrent",
                table: "rental_policy_versions",
                column: "IsCurrent",
                filter: "[IsCurrent] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_rental_policy_versions_PublishedBy",
                table: "rental_policy_versions",
                column: "PublishedBy");

            migrationBuilder.CreateIndex(
                name: "IX_rental_policy_versions_Version",
                table: "rental_policy_versions",
                column: "Version",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "payment_checkouts");

            migrationBuilder.DropTable(
                name: "policy_consents");

            migrationBuilder.DropTable(
                name: "rental_policy_versions");

            migrationBuilder.DropIndex(
                name: "IX_payments_RenewalId",
                table: "payments");

            migrationBuilder.DropIndex(
                name: "IX_contract_renewals_ContractId",
                table: "contract_renewals");

            migrationBuilder.DropCheckConstraint(
                name: "CK_contract_renewals_status",
                table: "contract_renewals");

            migrationBuilder.DropColumn(
                name: "AcceptedAt",
                table: "contract_renewals");

            migrationBuilder.DropColumn(
                name: "AppliedAt",
                table: "contract_renewals");

            migrationBuilder.DropColumn(
                name: "ExpiredAt",
                table: "contract_renewals");

            migrationBuilder.DropColumn(
                name: "PaymentDeadlineAt",
                table: "contract_renewals");

            migrationBuilder.DropColumn(
                name: "PolicyVersion",
                table: "contract_renewals");

            migrationBuilder.CreateIndex(
                name: "IX_payments_RenewalId",
                table: "payments",
                column: "RenewalId");

            migrationBuilder.CreateIndex(
                name: "IX_contract_renewals_ContractId",
                table: "contract_renewals",
                column: "ContractId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_contract_renewals_status",
                table: "contract_renewals",
                sql: "[Status] IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')");
        }
    }
}
