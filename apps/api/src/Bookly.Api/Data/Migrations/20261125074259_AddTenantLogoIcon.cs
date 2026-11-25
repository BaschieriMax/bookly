using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantLogoIcon : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "IconData",
                table: "TenantLogos",
                type: "bytea",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_TenantLogos_IconSize",
                table: "TenantLogos",
                sql: "octet_length(\"IconData\") <= 262144");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_TenantLogos_IconSize",
                table: "TenantLogos");

            migrationBuilder.DropColumn(
                name: "IconData",
                table: "TenantLogos");
        }
    }
}
