using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDepositPercentPerDayCalculationType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_policies_calculation_type",
                table: "policies");

            migrationBuilder.AlterColumn<string>(
                name: "CalculationType",
                table: "policies",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_policies_calculation_type",
                table: "policies",
                sql: "[CalculationType] IS NULL OR [CalculationType] IN ('FIXED','PERCENTAGE','RANGE','RULE','DEPOSIT_PERCENT_PER_DAY')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_policies_calculation_type",
                table: "policies");

            migrationBuilder.AlterColumn<string>(
                name: "CalculationType",
                table: "policies",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(30)",
                oldMaxLength: 30,
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_policies_calculation_type",
                table: "policies",
                sql: "[CalculationType] IS NULL OR [CalculationType] IN ('FIXED','PERCENTAGE','RANGE','RULE')");
        }
    }
}
