using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFacilityCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Latitude",
                table: "facilities",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Longitude",
                table: "facilities",
                type: "decimal(9,6)",
                precision: 9,
                scale: 6,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_facilities_coordinates",
                table: "facilities",
                sql: "([Latitude] IS NULL AND [Longitude] IS NULL) OR ([Latitude] BETWEEN -90 AND 90 AND [Longitude] BETWEEN -180 AND 180)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_facilities_coordinates",
                table: "facilities");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "facilities");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "facilities");
        }
    }
}
