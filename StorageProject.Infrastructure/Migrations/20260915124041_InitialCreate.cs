using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StorageProject.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "facilities",
                columns: table => new
                {
                    FacilityId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContactPhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OpeningTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    ClosingTime = table.Column<TimeOnly>(type: "time", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "ACTIVE"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_facilities", x => x.FacilityId);
                    table.CheckConstraint("CK_facilities_status", "[Status] IN ('ACTIVE','INACTIVE','TEMPORARILY_CLOSED')");
                });

            migrationBuilder.CreateTable(
                name: "permissions",
                columns: table => new
                {
                    PermissionId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PermissionCode = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    PermissionName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_permissions", x => x.PermissionId);
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    RoleId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleName = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.RoleId);
                });

            migrationBuilder.CreateTable(
                name: "unit_types",
                columns: table => new
                {
                    UnitTypeId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TypeName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Length = table.Column<decimal>(type: "decimal(8,2)", nullable: true),
                    Width = table.Column<decimal>(type: "decimal(8,2)", nullable: true),
                    Height = table.Column<decimal>(type: "decimal(8,2)", nullable: true),
                    Area = table.Column<decimal>(type: "decimal(8,2)", nullable: false),
                    ClimateControlled = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unit_types", x => x.UnitTypeId);
                    table.CheckConstraint("CK_unit_types_area", "[Area] > 0");
                    table.CheckConstraint("CK_unit_types_height", "[Height] IS NULL OR [Height] > 0");
                    table.CheckConstraint("CK_unit_types_length", "[Length] IS NULL OR [Length] > 0");
                    table.CheckConstraint("CK_unit_types_status", "[Status] IN ('ACTIVE','INACTIVE')");
                    table.CheckConstraint("CK_unit_types_width", "[Width] IS NULL OR [Width] > 0");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    UserId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "ACTIVE"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.UserId);
                    table.CheckConstraint("CK_users_status", "[Status] IN ('ACTIVE','INACTIVE','LOCKED','SUSPENDED')");
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    RoleId = table.Column<long>(type: "bigint", nullable: false),
                    PermissionId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => new { x.RoleId, x.PermissionId });
                    table.ForeignKey(
                        name: "FK_role_permissions_permissions_PermissionId",
                        column: x => x.PermissionId,
                        principalTable: "permissions",
                        principalColumn: "PermissionId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_role_permissions_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "roles",
                        principalColumn: "RoleId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "storage_units",
                columns: table => new
                {
                    UnitId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    UnitTypeId = table.Column<long>(type: "bigint", nullable: false),
                    UnitNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Floor = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Zone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LocationDescription = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "AVAILABLE"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_units", x => x.UnitId);
                    table.CheckConstraint("CK_storage_units_status", "[Status] IN ('AVAILABLE','RESERVED','ASSIGNED','OCCUPIED','RETURN_PENDING','INSPECTION','MAINTENANCE','OUT_OF_SERVICE')");
                    table.ForeignKey(
                        name: "FK_storage_units_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_storage_units_unit_types_UnitTypeId",
                        column: x => x.UnitTypeId,
                        principalTable: "unit_types",
                        principalColumn: "UnitTypeId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "activity_logs",
                columns: table => new
                {
                    LogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<long>(type: "bigint", nullable: true),
                    OldValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    LoggedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activity_logs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_activity_logs_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "login_history",
                columns: table => new
                {
                    LoginHistoryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    LoginAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LogoutAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: true),
                    DeviceInfo = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    LoginStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_login_history", x => x.LoginHistoryId);
                    table.CheckConstraint("CK_login_history_status", "[LoginStatus] IN ('SUCCESS','FAILED','BLOCKED')");
                    table.ForeignKey(
                        name: "FK_login_history_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "policies",
                columns: table => new
                {
                    PolicyId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FacilityId = table.Column<long>(type: "bigint", nullable: true),
                    UnitTypeId = table.Column<long>(type: "bigint", nullable: true),
                    CreatedBy = table.Column<long>(type: "bigint", nullable: false),
                    PolicyName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    PolicyType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CalculationType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Value = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    MinValue = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    MaxValue = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    RuleDescription = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "DRAFT"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_policies", x => x.PolicyId);
                    table.CheckConstraint("CK_policies_calculation_type", "[CalculationType] IS NULL OR [CalculationType] IN ('FIXED','PERCENTAGE','RANGE','RULE')");
                    table.CheckConstraint("CK_policies_policy_type", "[PolicyType] IN ('DEPOSIT','RENEWAL','CANCELLATION','RETURN','OVERDUE','EXTRA_FEE','DISCOUNT','FEE_WAIVER','PRICE_RANGE')");
                    table.CheckConstraint("CK_policies_status", "[Status] IN ('DRAFT','ACTIVE','INACTIVE','EXPIRED')");
                    table.ForeignKey(
                        name: "FK_policies_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_policies_unit_types_UnitTypeId",
                        column: x => x.UnitTypeId,
                        principalTable: "unit_types",
                        principalColumn: "UnitTypeId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_policies_users_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "rental_rates",
                columns: table => new
                {
                    RateId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    UnitTypeId = table.Column<long>(type: "bigint", nullable: false),
                    SetBy = table.Column<long>(type: "bigint", nullable: false),
                    MonthlyRate = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    EffectiveFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    EffectiveTo = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "DRAFT"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_rates", x => x.RateId);
                    table.CheckConstraint("CK_rental_rates_monthly_rate", "[MonthlyRate] > 0");
                    table.CheckConstraint("CK_rental_rates_status", "[Status] IN ('DRAFT','ACTIVE','EXPIRED','INACTIVE')");
                    table.ForeignKey(
                        name: "FK_rental_rates_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_rates_unit_types_UnitTypeId",
                        column: x => x.UnitTypeId,
                        principalTable: "unit_types",
                        principalColumn: "UnitTypeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_rates_users_SetBy",
                        column: x => x.SetBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "reservations",
                columns: table => new
                {
                    ReservationId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<long>(type: "bigint", nullable: false),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    UnitTypeId = table.Column<long>(type: "bigint", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RentalPeriodMonths = table.Column<int>(type: "int", nullable: false),
                    ExpectedEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CheckInAppointmentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    QuotedMonthlyRate = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    EstimatedAmount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    RequiredDeposit = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "PENDING_PAYMENT"),
                    CancellationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reservations", x => x.ReservationId);
                    table.CheckConstraint("CK_reservations_estimated_amount", "[EstimatedAmount] >= 0");
                    table.CheckConstraint("CK_reservations_quoted_rate", "[QuotedMonthlyRate] >= 0");
                    table.CheckConstraint("CK_reservations_rental_period", "[RentalPeriodMonths] > 0");
                    table.CheckConstraint("CK_reservations_required_deposit", "[RequiredDeposit] >= 0");
                    table.CheckConstraint("CK_reservations_status", "[Status] IN ('PENDING_PAYMENT','CONFIRMED','UNIT_ASSIGNED','CHECKED_IN','CANCELLED','EXPIRED','NO_SHOW')");
                    table.ForeignKey(
                        name: "FK_reservations_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reservations_unit_types_UnitTypeId",
                        column: x => x.UnitTypeId,
                        principalTable: "unit_types",
                        principalColumn: "UnitTypeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_reservations_users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_facilities",
                columns: table => new
                {
                    UserFacilityId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    FacilityId = table.Column<long>(type: "bigint", nullable: false),
                    AssignedBy = table.Column<long>(type: "bigint", nullable: true),
                    AssignedFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    AssignedTo = table.Column<DateOnly>(type: "date", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_facilities", x => x.UserFacilityId);
                    table.CheckConstraint("CK_user_facilities_status", "[Status] IN ('ACTIVE','ENDED','SUSPENDED')");
                    table.ForeignKey(
                        name: "FK_user_facilities_facilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "facilities",
                        principalColumn: "FacilityId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_facilities_users_AssignedBy",
                        column: x => x.AssignedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_facilities_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    UserId = table.Column<long>(type: "bigint", nullable: false),
                    RoleId = table.Column<long>(type: "bigint", nullable: false),
                    AssignedBy = table.Column<long>(type: "bigint", nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_roles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_user_roles_roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "roles",
                        principalColumn: "RoleId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_user_roles_users_AssignedBy",
                        column: x => x.AssignedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_user_roles_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "unit_status_history",
                columns: table => new
                {
                    StatusHistoryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    ChangedBy = table.Column<long>(type: "bigint", nullable: false),
                    OldStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    NewStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unit_status_history", x => x.StatusHistoryId);
                    table.ForeignKey(
                        name: "FK_unit_status_history_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unit_status_history_users_ChangedBy",
                        column: x => x.ChangedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "rental_contracts",
                columns: table => new
                {
                    ContractId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReservationId = table.Column<long>(type: "bigint", nullable: false),
                    CustomerId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AgreedMonthlyRate = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    DepositAmount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "DRAFT"),
                    TerminationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ActivatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rental_contracts", x => x.ContractId);
                    table.CheckConstraint("CK_rental_contracts_dates", "[EndDate] > [StartDate]");
                    table.CheckConstraint("CK_rental_contracts_deposit", "[DepositAmount] >= 0");
                    table.CheckConstraint("CK_rental_contracts_rate", "[AgreedMonthlyRate] >= 0");
                    table.CheckConstraint("CK_rental_contracts_status", "[Status] IN ('DRAFT','ACTIVE','EXPIRING','OVERDUE','RETURN_PENDING','COMPLETED','TERMINATED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_rental_contracts_reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalTable: "reservations",
                        principalColumn: "ReservationId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_contracts_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_rental_contracts_users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "unit_assignments",
                columns: table => new
                {
                    AssignmentId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReservationId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    AssignedBy = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "ACTIVE"),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UnassignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_unit_assignments", x => x.AssignmentId);
                    table.CheckConstraint("CK_unit_assignments_status", "[Status] IN ('ACTIVE','REPLACED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_unit_assignments_reservations_ReservationId",
                        column: x => x.ReservationId,
                        principalTable: "reservations",
                        principalColumn: "ReservationId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unit_assignments_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_unit_assignments_users_AssignedBy",
                        column: x => x.AssignedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "access_credentials",
                columns: table => new
                {
                    CredentialId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    IssuedBy = table.Column<long>(type: "bigint", nullable: false),
                    CredentialType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CredentialReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SecretHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IssuedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ReturnedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "ACTIVE")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_access_credentials", x => x.CredentialId);
                    table.CheckConstraint("CK_access_credentials_status", "[Status] IN ('ACTIVE','RETURNED','LOST','REVOKED','REPLACED')");
                    table.CheckConstraint("CK_access_credentials_type", "[CredentialType] IN ('KEY','LOCK','ACCESS_CARD','ACCESS_CODE')");
                    table.ForeignKey(
                        name: "FK_access_credentials_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_access_credentials_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_access_credentials_users_IssuedBy",
                        column: x => x.IssuedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "contract_renewals",
                columns: table => new
                {
                    RenewalId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    ApprovedBy = table.Column<long>(type: "bigint", nullable: true),
                    OldEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    NewEndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    RenewalPeriodMonths = table.Column<int>(type: "int", nullable: false),
                    OldMonthlyRate = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    NewMonthlyRate = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    RenewalAmount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    RequestedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contract_renewals", x => x.RenewalId);
                    table.CheckConstraint("CK_contract_renewals_amount", "[RenewalAmount] >= 0");
                    table.CheckConstraint("CK_contract_renewals_period", "[RenewalPeriodMonths] > 0");
                    table.CheckConstraint("CK_contract_renewals_status", "[Status] IN ('PENDING','APPROVED','REJECTED','PAID','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_contract_renewals_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_contract_renewals_users_ApprovedBy",
                        column: x => x.ApprovedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "handover_records",
                columns: table => new
                {
                    HandoverId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    StaffId = table.Column<long>(type: "bigint", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HandoverAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    InitialCondition = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CustomerConfirmed = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    StaffConfirmed = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "SCHEDULED"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_handover_records", x => x.HandoverId);
                    table.CheckConstraint("CK_handover_records_status", "[Status] IN ('SCHEDULED','VERIFIED','HANDED_OVER','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_handover_records_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_handover_records_users_StaffId",
                        column: x => x.StaffId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "overdue_cases",
                columns: table => new
                {
                    OverdueCaseId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    AssignedStaffId = table.Column<long>(type: "bigint", nullable: true),
                    OverdueFrom = table.Column<DateOnly>(type: "date", nullable: false),
                    GraceDeadline = table.Column<DateOnly>(type: "date", nullable: true),
                    OutstandingAmount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValue: 0m),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "OPEN"),
                    OpenedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_overdue_cases", x => x.OverdueCaseId);
                    table.CheckConstraint("CK_overdue_cases_status", "[Status] IN ('OPEN','CONTACTED','PAYMENT_PENDING','RETURN_PENDING','RESOLVED','ESCALATED')");
                    table.ForeignKey(
                        name: "FK_overdue_cases_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_overdue_cases_users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "return_inspections",
                columns: table => new
                {
                    InspectionId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    StaffId = table.Column<long>(type: "bigint", nullable: false),
                    ScheduledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    InspectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ConditionStatus = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    DamageDescription = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CleaningRequired = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    MaintenanceRequired = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    DamageFee = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValue: 0m),
                    CleaningFee = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValue: 0m),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "SCHEDULED"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_return_inspections", x => x.InspectionId);
                    table.CheckConstraint("CK_return_inspections_condition", "[ConditionStatus] IS NULL OR [ConditionStatus] IN ('GOOD','DIRTY','DAMAGED','MAINTENANCE_REQUIRED')");
                    table.CheckConstraint("CK_return_inspections_status", "[Status] IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_return_inspections_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_return_inspections_users_StaffId",
                        column: x => x.StaffId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "support_tickets",
                columns: table => new
                {
                    TicketId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerId = table.Column<long>(type: "bigint", nullable: false),
                    ContractId = table.Column<long>(type: "bigint", nullable: true),
                    UnitId = table.Column<long>(type: "bigint", nullable: true),
                    AssignedStaffId = table.Column<long>(type: "bigint", nullable: true),
                    IssueType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "NORMAL"),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "OPEN"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_support_tickets", x => x.TicketId);
                    table.CheckConstraint("CK_support_tickets_issue_type", "[IssueType] IN ('UNIT','LOCK','ACCESS_CODE','ACCESS_CARD','PAYMENT','STORED_ITEM','OTHER')");
                    table.CheckConstraint("CK_support_tickets_priority", "[Priority] IN ('LOW','NORMAL','HIGH','URGENT')");
                    table.CheckConstraint("CK_support_tickets_status", "[Status] IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')");
                    table.ForeignKey(
                        name: "FK_support_tickets_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_support_tickets_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_support_tickets_users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_support_tickets_users_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                columns: table => new
                {
                    PaymentId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContractId = table.Column<long>(type: "bigint", nullable: false),
                    RenewalId = table.Column<long>(type: "bigint", nullable: true),
                    PaymentType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false, defaultValue: "VND"),
                    PaymentMethod = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TransactionReference = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    DueDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "PENDING"),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payments", x => x.PaymentId);
                    table.CheckConstraint("CK_payments_amount", "[Amount] >= 0");
                    table.CheckConstraint("CK_payments_payment_method", "[PaymentMethod] IN ('CASH','BANK_TRANSFER','CARD','E_WALLET','PAYMENT_GATEWAY')");
                    table.CheckConstraint("CK_payments_payment_type", "[PaymentType] IN ('DEPOSIT','RENT','RENEWAL','EXTRA_FEE','OVERDUE_FEE','DAMAGE_FEE','CLEANING_FEE','LOST_KEY_FEE','ACCESS_CARD_FEE','REFUND')");
                    table.CheckConstraint("CK_payments_status", "[Status] IN ('PENDING','PAID','FAILED','REFUNDED','PARTIALLY_REFUNDED')");
                    table.ForeignKey(
                        name: "FK_payments_contract_renewals_RenewalId",
                        column: x => x.RenewalId,
                        principalTable: "contract_renewals",
                        principalColumn: "RenewalId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_payments_rental_contracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "rental_contracts",
                        principalColumn: "ContractId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "maintenance_requests",
                columns: table => new
                {
                    MaintenanceId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UnitId = table.Column<long>(type: "bigint", nullable: false),
                    SupportTicketId = table.Column<long>(type: "bigint", nullable: true),
                    ReportedBy = table.Column<long>(type: "bigint", nullable: false),
                    AssignedStaffId = table.Column<long>(type: "bigint", nullable: true),
                    MaintenanceType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    IssueDescription = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "NORMAL"),
                    ScheduledAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Cost = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValue: 0m),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "OPEN"),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_maintenance_requests", x => x.MaintenanceId);
                    table.CheckConstraint("CK_maintenance_requests_priority", "[Priority] IN ('LOW','NORMAL','HIGH','URGENT')");
                    table.CheckConstraint("CK_maintenance_requests_status", "[Status] IN ('OPEN','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')");
                    table.CheckConstraint("CK_maintenance_requests_type", "[MaintenanceType] IN ('INSPECTION','REPAIR','CLEANING','LOCK','ACCESS_SYSTEM','OTHER')");
                    table.ForeignKey(
                        name: "FK_maintenance_requests_storage_units_UnitId",
                        column: x => x.UnitId,
                        principalTable: "storage_units",
                        principalColumn: "UnitId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_maintenance_requests_support_tickets_SupportTicketId",
                        column: x => x.SupportTicketId,
                        principalTable: "support_tickets",
                        principalColumn: "TicketId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_maintenance_requests_users_AssignedStaffId",
                        column: x => x.AssignedStaffId,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_maintenance_requests_users_ReportedBy",
                        column: x => x.ReportedBy,
                        principalTable: "users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_access_credentials_ContractId",
                table: "access_credentials",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_access_credentials_IssuedBy",
                table: "access_credentials",
                column: "IssuedBy");

            migrationBuilder.CreateIndex(
                name: "IX_access_credentials_UnitId",
                table: "access_credentials",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_activity_logs_UserId",
                table: "activity_logs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_contract_renewals_ApprovedBy",
                table: "contract_renewals",
                column: "ApprovedBy");

            migrationBuilder.CreateIndex(
                name: "IX_contract_renewals_ContractId",
                table: "contract_renewals",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_handover_records_ContractId",
                table: "handover_records",
                column: "ContractId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_handover_records_StaffId",
                table: "handover_records",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_login_history_UserId",
                table: "login_history",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_maintenance_requests_AssignedStaffId",
                table: "maintenance_requests",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_maintenance_requests_ReportedBy",
                table: "maintenance_requests",
                column: "ReportedBy");

            migrationBuilder.CreateIndex(
                name: "IX_maintenance_requests_SupportTicketId",
                table: "maintenance_requests",
                column: "SupportTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_maintenance_requests_UnitId",
                table: "maintenance_requests",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_overdue_cases_AssignedStaffId",
                table: "overdue_cases",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_overdue_cases_ContractId",
                table: "overdue_cases",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_ContractId",
                table: "payments",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_RenewalId",
                table: "payments",
                column: "RenewalId");

            migrationBuilder.CreateIndex(
                name: "IX_payments_TransactionReference",
                table: "payments",
                column: "TransactionReference",
                unique: true,
                filter: "[TransactionReference] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_permissions_PermissionCode",
                table: "permissions",
                column: "PermissionCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_policies_CreatedBy",
                table: "policies",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_policies_FacilityId",
                table: "policies",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_policies_UnitTypeId",
                table: "policies",
                column: "UnitTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_contracts_CustomerId",
                table: "rental_contracts",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_contracts_ReservationId",
                table: "rental_contracts",
                column: "ReservationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_rental_contracts_UnitId",
                table: "rental_contracts",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_rates_FacilityId",
                table: "rental_rates",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_rental_rates_SetBy",
                table: "rental_rates",
                column: "SetBy");

            migrationBuilder.CreateIndex(
                name: "IX_rental_rates_UnitTypeId",
                table: "rental_rates",
                column: "UnitTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_CustomerId",
                table: "reservations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_FacilityId",
                table: "reservations",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_reservations_UnitTypeId",
                table: "reservations",
                column: "UnitTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_return_inspections_ContractId",
                table: "return_inspections",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_return_inspections_StaffId",
                table: "return_inspections",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_PermissionId",
                table: "role_permissions",
                column: "PermissionId");

            migrationBuilder.CreateIndex(
                name: "IX_roles_RoleName",
                table: "roles",
                column: "RoleName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_storage_units_FacilityId_UnitNumber",
                table: "storage_units",
                columns: new[] { "FacilityId", "UnitNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_storage_units_UnitTypeId",
                table: "storage_units",
                column: "UnitTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_AssignedStaffId",
                table: "support_tickets",
                column: "AssignedStaffId");

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_ContractId",
                table: "support_tickets",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_CustomerId",
                table: "support_tickets",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_support_tickets_UnitId",
                table: "support_tickets",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_unit_assignments_AssignedBy",
                table: "unit_assignments",
                column: "AssignedBy");

            migrationBuilder.CreateIndex(
                name: "IX_unit_assignments_ReservationId",
                table: "unit_assignments",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_unit_assignments_UnitId",
                table: "unit_assignments",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_unit_status_history_ChangedBy",
                table: "unit_status_history",
                column: "ChangedBy");

            migrationBuilder.CreateIndex(
                name: "IX_unit_status_history_UnitId",
                table: "unit_status_history",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_unit_types_TypeName",
                table: "unit_types",
                column: "TypeName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_facilities_AssignedBy",
                table: "user_facilities",
                column: "AssignedBy");

            migrationBuilder.CreateIndex(
                name: "IX_user_facilities_FacilityId",
                table: "user_facilities",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_user_facilities_UserId",
                table: "user_facilities",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_AssignedBy",
                table: "user_roles",
                column: "AssignedBy");

            migrationBuilder.CreateIndex(
                name: "IX_user_roles_RoleId",
                table: "user_roles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_users_Email",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_Username",
                table: "users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "access_credentials");

            migrationBuilder.DropTable(
                name: "activity_logs");

            migrationBuilder.DropTable(
                name: "handover_records");

            migrationBuilder.DropTable(
                name: "login_history");

            migrationBuilder.DropTable(
                name: "maintenance_requests");

            migrationBuilder.DropTable(
                name: "overdue_cases");

            migrationBuilder.DropTable(
                name: "payments");

            migrationBuilder.DropTable(
                name: "policies");

            migrationBuilder.DropTable(
                name: "rental_rates");

            migrationBuilder.DropTable(
                name: "return_inspections");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "unit_assignments");

            migrationBuilder.DropTable(
                name: "unit_status_history");

            migrationBuilder.DropTable(
                name: "user_facilities");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "support_tickets");

            migrationBuilder.DropTable(
                name: "contract_renewals");

            migrationBuilder.DropTable(
                name: "permissions");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "rental_contracts");

            migrationBuilder.DropTable(
                name: "reservations");

            migrationBuilder.DropTable(
                name: "storage_units");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "facilities");

            migrationBuilder.DropTable(
                name: "unit_types");
        }
    }
}
