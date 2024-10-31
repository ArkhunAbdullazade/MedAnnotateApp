﻿using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedAnnotateApp.Presentation.Migrations
{
    /// <inheritdoc />
    public partial class AddPmcidcolumntoMedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Pmcid",
                table: "MedDatas",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Pmcid",
                table: "MedDatas");
        }
    }
}
