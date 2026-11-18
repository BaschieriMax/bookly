using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AdminCalendar : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NotifyOnCustomerCancellation",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true); // existing tenants keep the documented default (notify)

            migrationBuilder.AddColumn<string>(
                name: "CancellationReason",
                table: "Appointments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotifyOnCustomerCancellation",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "CancellationReason",
                table: "Appointments");
        }
    }
}
