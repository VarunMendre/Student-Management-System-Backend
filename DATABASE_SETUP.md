# Database Setup And Reset Guide

Use this guide when creating a fresh database or when resetting the app database from zero.

## 1. Select The Correct Database

In phpMyAdmin, click the target database first.

For production this may be:

```sql
u83108_asmfees
```

Confirm the selected database:

```sql
SELECT DATABASE();
```

## 2. Create Tables

Open `schema.sql`, copy the full file, paste it into the phpMyAdmin SQL tab, and run it.

Then confirm tables were created:

```sql
SHOW TABLES;
```

## 3. Verify Table Engine

All tables should be `InnoDB`.

```sql
SELECT table_name, engine
FROM information_schema.tables
WHERE table_schema = DATABASE();
```

If your hosting blocks `information_schema`, use:

```sql
SHOW TABLE STATUS;
```

## 4. Verify Foreign Keys

Run:

```sql
SELECT
  table_name,
  constraint_name,
  referenced_table_name
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
  AND referenced_table_name IS NOT NULL;
```

Expected relationships include:

```txt
app_users -> students
courses -> departments
course_batches -> courses
course_fees -> course_batches
course_scholarship_config -> courses
fee_transactions -> students
fee_transactions -> student_fee_ledger
scholarship_applications -> students
scholarship_applications -> app_users
scholarship_audit_logs -> scholarship_applications
scholarship_audit_logs -> app_users
scholarship_ocr_jobs -> scholarship_applications
student_fee_ledger -> students
students -> departments
students -> courses
students -> course_batches
```

## 5. Seed Principal Login

From backend project root:

```powershell
npm run seed:auth
```

Login credentials:

```txt
Email: principal@gmail.com
Password: Principal@123456
Role: Principal
```

## 6. Fresh Data Entry Order

Create app data in this order:

```txt
Departments
Courses
Batches
Fee Structure
Scholarship Config
Students
Payments / Scholarship Disbursals
```

## 7. Full Reset For Existing Database

Backup first:

```bash
mysqldump -u YOUR_DB_USER -p YOUR_DB_NAME > backup_before_reset.sql
```

Then in phpMyAdmin:

```txt
1. Select the correct database.
2. Drop all tables.
3. Run full schema.sql.
4. Verify tables with SHOW TABLES.
5. Verify foreign keys.
6. Run npm run seed:auth.
```

## 8. If Foreign Keys Are Missing

If the FK verification query returns zero rows after running `schema.sql`, first confirm all tables are `InnoDB`.

If tables are `InnoDB` and FKs are still missing, rerun `schema.sql` on a clean empty database. Avoid manually adding duplicate foreign keys unless you have confirmed the original constraints were not created.

## 9. Migration Note

Do not run files from `migrations/` on a brand-new database unless the current `schema.sql` is older than the migration.

The current `schema.sql` already includes the normalized academic year and fee constraint changes.
