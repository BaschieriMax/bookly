using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class TenantBookingWindow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "BookingHorizonDays",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<int>(
                name: "MinNoticeMinutes",
                table: "Tenants",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Tenants_BookingHorizonDays",
                table: "Tenants",
                sql: "\"BookingHorizonDays\" BETWEEN 1 AND 365");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Tenants_MinNoticeMinutes",
                table: "Tenants",
                sql: "\"MinNoticeMinutes\" BETWEEN 0 AND 10080");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Tenants_BookingHorizonDays",
                table: "Tenants");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Tenants_MinNoticeMinutes",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BookingHorizonDays",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "MinNoticeMinutes",
                table: "Tenants");
        }
    }
}
