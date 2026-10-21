-- =========================================================================
-- reset_db.sql: Reset SSFRMS database to pristine "Day 1" launch state
-- - Zero customer transactions / activity
-- - All 72 storage units set to 'AVAILABLE'
-- - Default seed roles, facilities, unit types, rates, policies preserved
-- - Default accounts (admin, staff01, manager01, ops01, customer01, customer02) preserved
-- - All temporary non-seeded accounts and logs deleted
-- =========================================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- 1. Disable all foreign key constraints
EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT all';

-- 2. Clear all customer transaction & activity tables
DELETE FROM [activity_logs];
DELETE FROM [login_history];
DELETE FROM [access_credentials];
DELETE FROM [overdue_cases];
DELETE FROM [contract_renewals];
DELETE FROM [maintenance_requests];
DELETE FROM [unit_assignments];
DELETE FROM [unit_status_history];
DELETE FROM [return_inspections];
DELETE FROM [handover_records];
DELETE FROM [support_tickets];
DELETE FROM [payments];
DELETE FROM [rental_contracts];
DELETE FROM [reservations];

-- 3. Reset identities on transaction tables so IDs start clean from 1
IF OBJECT_ID('reservations') IS NOT NULL DBCC CHECKIDENT ('reservations', RESEED, 0);
IF OBJECT_ID('rental_contracts') IS NOT NULL DBCC CHECKIDENT ('rental_contracts', RESEED, 0);
IF OBJECT_ID('payments') IS NOT NULL DBCC CHECKIDENT ('payments', RESEED, 0);
IF OBJECT_ID('support_tickets') IS NOT NULL DBCC CHECKIDENT ('support_tickets', RESEED, 0);
IF OBJECT_ID('handover_records') IS NOT NULL DBCC CHECKIDENT ('handover_records', RESEED, 0);
IF OBJECT_ID('return_inspections') IS NOT NULL DBCC CHECKIDENT ('return_inspections', RESEED, 0);
IF OBJECT_ID('unit_assignments') IS NOT NULL DBCC CHECKIDENT ('unit_assignments', RESEED, 0);
IF OBJECT_ID('maintenance_requests') IS NOT NULL DBCC CHECKIDENT ('maintenance_requests', RESEED, 0);
IF OBJECT_ID('contract_renewals') IS NOT NULL DBCC CHECKIDENT ('contract_renewals', RESEED, 0);
IF OBJECT_ID('overdue_cases') IS NOT NULL DBCC CHECKIDENT ('overdue_cases', RESEED, 0);
IF OBJECT_ID('access_credentials') IS NOT NULL DBCC CHECKIDENT ('access_credentials', RESEED, 0);
IF OBJECT_ID('activity_logs') IS NOT NULL DBCC CHECKIDENT ('activity_logs', RESEED, 0);
IF OBJECT_ID('login_history') IS NOT NULL DBCC CHECKIDENT ('login_history', RESEED, 0);
IF OBJECT_ID('unit_status_history') IS NOT NULL DBCC CHECKIDENT ('unit_status_history', RESEED, 0);

-- 4. Delete non-seeded test users (keep only system seed accounts)
DELETE FROM [user_roles] 
WHERE UserId IN (
    SELECT UserId FROM [users] 
    WHERE Username NOT IN ('admin', 'staff01', 'manager01', 'ops01', 'customer01', 'customer02')
);

DELETE FROM [user_facilities] 
WHERE UserId IN (
    SELECT UserId FROM [users] 
    WHERE Username NOT IN ('admin', 'staff01', 'manager01', 'ops01', 'customer01', 'customer02')
);

DELETE FROM [users] 
WHERE Username NOT IN ('admin', 'staff01', 'manager01', 'ops01', 'customer01', 'customer02');

-- 5. Delete decommissioned legacy units (OUT_OF_SERVICE or non-K units)
DELETE FROM [storage_units] WHERE [Status] IN ('OUT_OF_SERVICE', 'OUT OF SERVICE') OR [UnitNumber] NOT LIKE 'K%';

-- 6. Inactivate legacy unit types and their rates (including Locker)
UPDATE [unit_types] SET [Status] = 'INACTIVE' 
WHERE [TypeName] IN (
    'Kho Mini S (1m x 1m)', 
    'Kho Tiêu Chuẩn M (2m x 2m)', 
    'Kho Lớn L (3m x 3m)', 
    'Kho Doanh Nghiệp XL (4m x 4m)', 
    'Tủ Locker Cá Nhân (0.5m x 0.5m)'
);
UPDATE [rental_rates] SET [Status] = 'INACTIVE' 
WHERE [UnitTypeId] IN (SELECT [UnitTypeId] FROM [unit_types] WHERE [Status] = 'INACTIVE');

-- 7. Reset all active storage units (K01-K12) to AVAILABLE
UPDATE [storage_units] SET [Status] = 'AVAILABLE';

-- 8. Re-enable and validate all foreign key constraints
EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all';

PRINT 'SSFRMS Database reset completed successfully!';


