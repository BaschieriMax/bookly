using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CustomersPage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "ui",
                table: "NavigationItems",
                columns: new[] { "Id", "Area", "Icon", "IsEnabled", "Key", "LabelKey", "ParentId", "Route", "SortOrder" },
                values: new object[] { 7, "Admin", "contact-round", true, "admin.customers", "nav.customers", null, "/admin/clienti", 15 });

            migrationBuilder.InsertData(
                schema: "ui",
                table: "NavigationItemRoles",
                columns: new[] { "NavigationItemId", "Role" },
                values: new object[] { 7, "Owner" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "ui",
                table: "NavigationItemRoles",
                keyColumns: new[] { "NavigationItemId", "Role" },
                keyValues: new object[] { 7, "Owner" });

            migrationBuilder.DeleteData(
                schema: "ui",
                table: "NavigationItems",
                keyColumn: "Id",
                keyValue: 7);
        }
    }
}
