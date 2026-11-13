-- =========================================================================
-- reset_db.sql: Reset SSFRMS database to pristine "Day 1" launch state
-- - Zero customer transactions / activity
-- - All 144 physical storage units (K01-K12 across 12 facilities) reset to 'AVAILABLE'
-- - Floor, Zone, and LocationDescription synced to latest LOC-04 / DbSeeder.Catalog standard
-- - All 12 facilities preserved with GPS coordinates (FacilityCoordinateSeeder / B05a)
-- - System roles, permissions, unit types, rental rates, and policies preserved
-- - All default seed accounts preserved:
--   * admin, ops01
--   * staff01, staff02, manager01 (Nguyen Luong Bang)
--   * Manager_<CODE> and Staff_<CODE> across all 12 facilities (NLB, HL, PX, TT, PMH, BTH, NB, BC, TD, GV, TB, BTA)
--   * customer01..customer06, Customer<CODE>01
-- - All temporary non-seeded accounts and logs deleted
-- =========================================================================

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

-- 1. Disable all foreign key constraints
EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT all';

-- 2. Clear all customer transaction & activity tables
IF OBJECT_ID('payment_checkouts') IS NOT NULL DELETE FROM [payment_checkouts];
IF OBJECT_ID('evidence_photos') IS NOT NULL DELETE FROM [evidence_photos];
IF OBJECT_ID('facility_incidents') IS NOT NULL DELETE FROM [facility_incidents];
IF OBJECT_ID('support_inquiry_replies') IS NOT NULL DELETE FROM [support_inquiry_replies];
IF OBJECT_ID('support_inquiries') IS NOT NULL DELETE FROM [support_inquiries];
IF OBJECT_ID('password_reset_challenges') IS NOT NULL DELETE FROM [password_reset_challenges];
IF OBJECT_ID('password_resets') IS NOT NULL DELETE FROM [password_resets];
IF OBJECT_ID('policy_consents') IS NOT NULL DELETE FROM [policy_consents];
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
IF OBJECT_ID('payment_checkouts') IS NOT NULL DBCC CHECKIDENT ('payment_checkouts', RESEED, 0);
IF OBJECT_ID('policy_consents') IS NOT NULL DBCC CHECKIDENT ('policy_consents', RESEED, 0);
IF OBJECT_ID('facility_incidents') IS NOT NULL DBCC CHECKIDENT ('facility_incidents', RESEED, 0);
IF OBJECT_ID('evidence_photos') IS NOT NULL DBCC CHECKIDENT ('evidence_photos', RESEED, 0);
IF OBJECT_ID('support_inquiry_replies') IS NOT NULL DBCC CHECKIDENT ('support_inquiry_replies', RESEED, 0);
IF OBJECT_ID('support_inquiries') IS NOT NULL DBCC CHECKIDENT ('support_inquiries', RESEED, 0);
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

-- 4. Delete non-seeded test users (keep system seed accounts & per-facility seed accounts)
DELETE FROM [user_roles] 
WHERE UserId IN (
    SELECT UserId FROM [users] 
    WHERE Username NOT IN ('admin', 'staff01', 'staff02', 'manager01', 'ops01', 'customer01', 'customer02', 'customer03', 'customer04', 'customer05', 'customer06')
      AND Username NOT LIKE 'Staff[_]%'
      AND Username NOT LIKE 'Manager[_]%'
      AND Username NOT LIKE 'Customer%01'
);

DELETE FROM [user_facilities] 
WHERE UserId IN (
    SELECT UserId FROM [users] 
    WHERE Username NOT IN ('admin', 'staff01', 'staff02', 'manager01', 'ops01', 'customer01', 'customer02', 'customer03', 'customer04', 'customer05', 'customer06')
      AND Username NOT LIKE 'Staff[_]%'
      AND Username NOT LIKE 'Manager[_]%'
      AND Username NOT LIKE 'Customer%01'
);

DELETE FROM [users] 
WHERE Username NOT IN ('admin', 'staff01', 'staff02', 'manager01', 'ops01', 'customer01', 'customer02', 'customer03', 'customer04', 'customer05', 'customer06')
  AND Username NOT LIKE 'Staff[_]%'
  AND Username NOT LIKE 'Manager[_]%'
  AND Username NOT LIKE 'Customer%01';

-- 5. Delete decommissioned legacy units or non-standard test units (keep strictly K01–K12)
DELETE FROM [storage_units]
WHERE [Status] IN ('OUT_OF_SERVICE', 'OUT OF SERVICE')
   OR [UnitNumber] NOT IN ('K01','K02','K03','K04','K05','K06','K07','K08','K09','K10','K11','K12');

-- 6. Delete legacy inactive facilities, unit types and their rates (including Locker)
DELETE FROM [rental_rates]
WHERE [FacilityId] IN (SELECT [FacilityId] FROM [facilities] WHERE [Status] = 'INACTIVE' OR [Name] IN ('SafeSpace Quận 7', 'SSFRMS Chi nhánh Quận 7'))
   OR [UnitTypeId] IN (SELECT [UnitTypeId] FROM [unit_types] WHERE [Status] = 'INACTIVE' OR [TypeName] IN (
       'Kho Mini S (1m x 1m)',
       'Kho Tiêu Chuẩn M (2m x 2m)',
       'Kho Lớn L (3m x 3m)',
       'Kho Doanh Nghiệp XL (4m x 4m)',
       'Tủ Locker Cá Nhân (0.5m x 0.5m)'
   ));

DELETE FROM [facilities]
WHERE [Status] = 'INACTIVE' OR [Name] IN ('SafeSpace Quận 7', 'SSFRMS Chi nhánh Quận 7');

DELETE FROM [unit_types]
WHERE [Status] = 'INACTIVE' OR [TypeName] IN (
    'Kho Mini S (1m x 1m)',
    'Kho Tiêu Chuẩn M (2m x 2m)',
    'Kho Lớn L (3m x 3m)',
    'Kho Doanh Nghiệp XL (4m x 4m)',
    'Tủ Locker Cá Nhân (0.5m x 0.5m)'
);

-- 7. Reset all active storage units (K01-K12) across 12 facilities to AVAILABLE
UPDATE [storage_units] SET [Status] = 'AVAILABLE';

-- Chuẩn hóa tầng, khu vực / dãy và mô tả vị trí theo LOC-04 / DbSeeder.Catalog.cs
UPDATE [storage_units]
SET [Floor] = N'Tầng trệt',
    [Zone] = N'Dãy A',
    [LocationDescription] = N'Tầng trệt · Dãy A · Kho thường cỡ M'
WHERE [UnitNumber] IN ('K01', 'K02', 'K03', 'K04');

UPDATE [storage_units]
SET [Floor] = N'Tầng trệt',
    [Zone] = N'Dãy A',
    [LocationDescription] = N'Tầng trệt · Dãy A · Kho lạnh cỡ M'
WHERE [UnitNumber] IN ('K05', 'K06');

UPDATE [storage_units]
SET [Floor] = N'Tầng trệt',
    [Zone] = N'Dãy B',
    [LocationDescription] = N'Tầng trệt · Dãy B · Kho thường cỡ L'
WHERE [UnitNumber] IN ('K07', 'K08', 'K09', 'K10');

UPDATE [storage_units]
SET [Floor] = N'Tầng trệt',
    [Zone] = N'Dãy B',
    [LocationDescription] = N'Tầng trệt · Dãy B · Kho lạnh cỡ L'
WHERE [UnitNumber] IN ('K11', 'K12');

-- 8. Đồng bộ tọa độ GPS cho 12 cơ sở SafeSpace (FacilityCoordinateSeeder / B05a)
UPDATE [facilities] SET [Latitude] = 10.729500, [Longitude] = 106.721900 WHERE [Name] LIKE N'%Nguyễn Lương Bằng%';
UPDATE [facilities] SET [Latitude] = 10.745600, [Longitude] = 106.698000 WHERE [Name] LIKE N'%Him Lam%';
UPDATE [facilities] SET [Latitude] = 10.693500, [Longitude] = 106.722200 WHERE [Name] LIKE N'%Phú Xuân%';
UPDATE [facilities] SET [Latitude] = 10.756000, [Longitude] = 106.729000 WHERE [Name] LIKE N'%Tân Thuận%';
UPDATE [facilities] SET [Latitude] = 10.728500, [Longitude] = 106.706000 WHERE [Name] LIKE N'%Phú Mỹ Hưng%';
UPDATE [facilities] SET [Latitude] = 10.815000, [Longitude] = 106.709000 WHERE [Name] LIKE N'%Bình Thạnh%';
UPDATE [facilities] SET [Latitude] = 10.696000, [Longitude] = 106.739000 WHERE [Name] LIKE N'%Nhà Bè%';
UPDATE [facilities] SET [Latitude] = 10.697000, [Longitude] = 106.656000 WHERE [Name] LIKE N'%Bình Chánh%';
UPDATE [facilities] SET [Latitude] = 10.850000, [Longitude] = 106.770000 WHERE [Name] LIKE N'%Thủ Đức%';
UPDATE [facilities] SET [Latitude] = 10.835000, [Longitude] = 106.666000 WHERE [Name] LIKE N'%Gò Vấp%';
UPDATE [facilities] SET [Latitude] = 10.801000, [Longitude] = 106.642000 WHERE [Name] LIKE N'%Tân Bình%';
UPDATE [facilities] SET [Latitude] = 10.739000, [Longitude] = 106.615000 WHERE [Name] LIKE N'%Bình Tân%';

-- 9. Đảm bảo trạng thái phân công cơ sở hợp lệ (ACTIVE) cho mọi seed account
UPDATE [user_facilities] SET [Status] = 'ACTIVE' WHERE [Status] <> 'ACTIVE';

-- 10. Re-enable and validate all foreign key constraints
EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all';

PRINT 'SSFRMS Database reset completed successfully!';
