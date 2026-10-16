using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPayOSFieldsToReservation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CheckoutUrl",
                table: "reservations",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OrderCode",
                table: "reservations",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaidAt",
                table: "reservations",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentQrUrl",
                table: "reservations",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_reservations_OrderCode",
                table: "reservations",
                column: "OrderCode",
                unique: true,
                filter: "[OrderCode] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_reservations_OrderCode",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "CheckoutUrl",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "OrderCode",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "PaidAt",
                table: "reservations");

            migrationBuilder.DropColumn(
                name: "PaymentQrUrl",
                table: "reservations");
        }
    }
}
