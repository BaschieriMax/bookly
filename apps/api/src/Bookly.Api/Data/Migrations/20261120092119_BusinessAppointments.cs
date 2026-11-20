using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BusinessAppointments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "Appointments",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "CreatedByUserId",
                table: "Appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "NotifyCustomer",
                table: "Appointments",
                type: "boolean",
                nullable: false,
                // Existing rows were booked online: they keep their emails. Also keeps the
                // previous release working while this migration is live (expand/contract).
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "Appointments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Online");

            migrationBuilder.AddColumn<Guid>(
                name: "TenantCustomerId",
                table: "Appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TenantCustomers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    LastName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PhoneDigits = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AnonymizedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantCustomers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantCustomers_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_CreatedByUserId",
                table: "Appointments",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_TenantCustomerId_StartUtc",
                table: "Appointments",
                columns: new[] { "TenantCustomerId", "StartUtc" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Appointments_OneCustomer",
                table: "Appointments",
                sql: "num_nonnulls(\"CustomerId\", \"TenantCustomerId\") = 1");

            migrationBuilder.CreateIndex(
                name: "IX_TenantCustomers_TenantId_LastName_FirstName",
                table: "TenantCustomers",
                columns: new[] { "TenantId", "LastName", "FirstName" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantCustomers_TenantId_PhoneDigits",
                table: "TenantCustomers",
                columns: new[] { "TenantId", "PhoneDigits" });

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_AspNetUsers_CreatedByUserId",
                table: "Appointments",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Appointments_TenantCustomers_TenantCustomerId",
                table: "Appointments",
                column: "TenantCustomerId",
                principalTable: "TenantCustomers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_AspNetUsers_CreatedByUserId",
                table: "Appointments");

            migrationBuilder.DropForeignKey(
                name: "FK_Appointments_TenantCustomers_TenantCustomerId",
                table: "Appointments");

            migrationBuilder.DropTable(
                name: "TenantCustomers");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_CreatedByUserId",
                table: "Appointments");

            migrationBuilder.DropIndex(
                name: "IX_Appointments_TenantCustomerId_StartUtc",
                table: "Appointments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Appointments_OneCustomer",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "NotifyCustomer",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "TenantCustomerId",
                table: "Appointments");

            migrationBuilder.AlterColumn<Guid>(
                name: "CustomerId",
                table: "Appointments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
