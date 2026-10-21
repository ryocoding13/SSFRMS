using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReservationPaymentIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations");

            migrationBuilder.AddColumn<string>(
                name: "PaymentMethod",
                table: "reservations",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "PAYOS");

            migrationBuilder.AlterColumn<long>(
                name: "ContractId",
                table: "payments",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "ReservationId",
                table: "payments",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations",
                sql: "[Status] IN ('PENDING_PAYMENT','PENDING_VERIFICATION','PENDING_AT_FACILITY','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");

            // Link unambiguous existing receipts to their reservation; never delete or fabricate money.
            migrationBuilder.Sql(@"UPDATE p SET ReservationId = c.ReservationId
                FROM payments p INNER JOIN rental_contracts c ON p.ContractId = c.ContractId
                WHERE p.PaymentType IN ('RENT','DEPOSIT') AND NOT EXISTS
                (SELECT 1 FROM payments other WHERE other.ContractId = p.ContractId
                 AND other.PaymentType = p.PaymentType AND other.PaymentId <> p.PaymentId)");

            migrationBuilder.CreateIndex(
                name: "IX_payments_ReservationId_PaymentType",
                table: "payments",
                columns: new[] { "ReservationId", "PaymentType" },
                unique: true,
                filter: "[ReservationId] IS NOT NULL AND [PaymentType] IN ('RENT','DEPOSIT')");

            migrationBuilder.AddForeignKey(
                name: "FK_payments_reservations_ReservationId",
                table: "payments",
                column: "ReservationId",
                principalTable: "reservations",
                principalColumn: "ReservationId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM payments WHERE ContractId IS NULL)
                OR EXISTS (SELECT 1 FROM reservations WHERE Status = 'PENDING_AT_FACILITY')
                THROW 51000, N'Không thể hạ migration khi còn khoản thu chưa gắn hợp đồng hoặc đơn chờ thu tại kho.', 1;");
            migrationBuilder.DropForeignKey(
                name: "FK_payments_reservations_ReservationId",
                table: "payments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations");

            migrationBuilder.DropIndex(
                name: "IX_payments_ReservationId_PaymentType",
                table: "payments");

            migrationBuilder.DropColumn(
                name: "PaymentMethod",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "ReservationId",
                table: "payments");

            migrationBuilder.AlterColumn<long>(
                name: "ContractId",
                table: "payments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_reservations_status",
                table: "reservations",
                sql: "[Status] IN ('PENDING_PAYMENT','PENDING_VERIFICATION','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");
        }
    }
}
