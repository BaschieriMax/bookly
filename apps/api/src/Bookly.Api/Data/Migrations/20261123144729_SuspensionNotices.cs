using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Bookly.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SuspensionNotices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TenantSuspensions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    CancelledAppointments = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSuspensions", x => x.Id);
                    table.CheckConstraint("CK_TenantSuspensions_Cancelled", "\"CancelledAppointments\" >= 0");
                    table.ForeignKey(
                        name: "FK_TenantSuspensions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SuspensionNotices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SuspensionId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    AppointmentIds = table.Column<List<Guid>>(type: "uuid[]", nullable: false),
                    OwnerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    NextAttemptAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ClaimedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SentAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SuspensionNotices", x => x.Id);
                    table.CheckConstraint("CK_SuspensionNotices_Attempts", "\"Attempts\" >= 0");
                    table.ForeignKey(
                        name: "FK_SuspensionNotices_AspNetUsers_OwnerUserId",
                        column: x => x.OwnerUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SuspensionNotices_TenantSuspensions_SuspensionId",
                        column: x => x.SuspensionId,
                        principalTable: "TenantSuspensions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SuspensionNotices_Due",
                table: "SuspensionNotices",
                column: "NextAttemptAt",
                filter: "\"Status\" = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_SuspensionNotices_OwnerUserId",
                table: "SuspensionNotices",
                column: "OwnerUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SuspensionNotices_SentAt",
                table: "SuspensionNotices",
                column: "SentAt",
                filter: "\"SentAt\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SuspensionNotices_SuspensionId_Kind_Status",
                table: "SuspensionNotices",
                columns: new[] { "SuspensionId", "Kind", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_TenantSuspensions_TenantId_CreatedAt",
                table: "TenantSuspensions",
                columns: new[] { "TenantId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SuspensionNotices");

            migrationBuilder.DropTable(
                name: "TenantSuspensions");
        }
    }
}
