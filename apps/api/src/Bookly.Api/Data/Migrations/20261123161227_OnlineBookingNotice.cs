using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class OnlineBookingNotice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "NotifyOnOnlineBooking",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true); // existing tenants get the documented default: notify (DEC-040)
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NotifyOnOnlineBooking",
                table: "Tenants");
        }
    }
}
