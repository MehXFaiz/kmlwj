# MongoDB Migration Guide - KMLWJ ERP

## Overview

This guide documents the complete migration of KMLWJ ERP database from MySQL (kmlwj.sql) to MongoDB Atlas.

## Database Details

- **Source**: kmlwj.sql (MySQL/MariaDB dump)
- **Target**: MongoDB Atlas (Vercel-Admin-kmlwj-db cluster)
- **Database Name**: kmlwj
- **Tables/Collections**: 37 (all preserved)

## Environment Setup

### Prerequisites

1. **MongoDB URI configured** in `.env`:
   ```
   MONGODB_URI=mongodb+srv://Vercel-Admin-kmlwj-db:Z10oCdLwtp28f11j@kmlwj-db.bsnmcrn.mongodb.net/kmlwj?retryWrites=true&w=majority
   ```

2. **Dependencies installed**:
   ```bash
   npm install mongodb decimal.js
   ```

3. **Source file present**: `kmlwj.sql` in project root

## Migration Process

### Step 1: Execute Migration Script

```bash
npx ts-node scripts/migrate-mysql-to-mongodb.ts
```

**Expected Output:**
- Reads kmlwj.sql (~20,000 lines, ~20MB)
- Parses 37 INSERT statements (one per table)
- Migrates all records to MongoDB collections
- Validates record counts match source
- Generates comprehensive report

**Typical Timing**: 30-60 seconds depending on data volume

**Expected Counts** (adjust based on actual data):
- AccountType: ~20-30
- Role: 4 (SUPER ADMIN, ADMIN, USER, GUEST)
- Permission: 50+
- User: 10-20
- Account: 200-500
- JournalEntry: 1000+
- Donation: 500+
- HallBooking: 100+
- Invoice: 200+
- AuditLog: 5000+

### Step 2: Validate Migration

```bash
npx ts-node scripts/validate-migration.ts
```

**Checks:**
- ✓ Collection counts match source
- ✓ Data types are correct
- ✓ Financial data precision preserved (Decimal values)
- ✓ UUID IDs preserved as strings
- ✓ Relationship integrity
- ✓ No orphaned references

**Expected Output:**
```
✅ All validation checks passed!
- Collections: 37 total
- Total records: [source count]
- Data types: Correct
- Decimal precision: Preserved
- Relationships: Valid
```

### Step 3: Test Post-Migration

```bash
npx ts-node scripts/test-post-migration.ts
```

**Validates:**
- ✓ MongoDB connection
- ✓ Collection structure
- ✓ User data integrity
- ✓ RBAC structure (Roles, Permissions)
- ✓ Financial data (Accounts, Journals)
- ✓ Business transactions (Donations, Invoices, Hall Bookings)
- ✓ Audit logs
- ✓ Data consistency

### Step 4: Health Check

Test the API health endpoint:

```bash
curl http://localhost:4000/api/health
```

**Expected Response** (after migration):
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "database": {
    "status": "connected",
    "type": "mongodb",
    "message": "Successfully connected to MongoDB"
  }
}
```

## Data Mapping

### ID Preservation
- All IDs are preserved as **strings** (not converted to MongoDB ObjectId)
- Original UUID format maintained (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- Enables relationship integrity across all collections

### Financial Data
- Decimal fields stored as **numbers**
- Precision preserved (18,2 decimal places max)
- No floating-point conversion issues
- Examples: currentBalance, debitAmount, creditAmount

### Type Conversions
- MySQL NULL → MongoDB null
- MySQL BOOLEAN → JavaScript true/false
- MySQL VARCHAR → String
- MySQL DECIMAL → Number
- MySQL INT/BIGINT → Number
- MySQL DATETIME → ISO String

## Table Dependencies

**Insertion Order** (respects foreign key relationships):

```
1. AccountType
2. Role
3. Permission
4. User
5. RefreshToken
6. Account
7. ReservedCode
8. FinancialYear
9. Donor
10. Beneficiary
11. Customer
12. Member
13. FamilyRelationship
14. JournalEntry
15. JournalEntryLine
16. Donation
17. DonationReceived
18. ZakatCard
19. HallBooking
20. Invoice
21. InvoiceItem
22. SimpleIncome
23. SimpleExpense
24. IncomeCategory
25. ExpenseHead
26. RevenueHead
27. RevenueCollection
28. AddIncomeRecord
29. PettyCashConfig
30. PettyCashTransaction
31. PettyCashReconciliation
32. OpeningBalanceBatch
33. OpeningBalanceLine
34. AiRepairIssue
35. AiRepairLog
36. AuditLog
37. RolePermission
```

## Testing Scenarios

### User Authentication
```bash
# Test login endpoint
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Expected: JWT token with user info and permissions
```

### Role-Based Access Control
- SUPER ADMIN: Full access to all modules and actions
- ADMIN: Access based on assigned permissions
- USER: View and create own records
- GUEST: View-only access

### Module Testing
- **Chart of Accounts**: GET /api/v1/accounts
- **Journal Entries**: GET /api/v1/journal-entries
- **Donations**: GET /api/v1/donations
- **Hall Bookings**: GET /api/v1/hall-bookings
- **Reports**: GET /api/v1/reports/trial-balance

## Troubleshooting

### Connection Issues
```bash
# Test MongoDB connection
mongosh --uri "mongodb+srv://Vercel-Admin-kmlwj-db:..."
```

### Migration Hangs
- Check network connectivity to MongoDB Atlas
- Verify MONGODB_URI in .env
- Ensure kmlwj.sql is accessible and readable

### Data Mismatch
- Re-run migration (uses upsert, safe to retry)
- Check kmlwj.sql integrity
- Review error logs for specific table failures

### Type Conversion Issues
- Verify Decimal.js is installed: `npm list decimal.js`
- Check financial data in source kmlwj.sql
- Review validation report for type mismatches

## Rollback Plan

If migration fails:

1. **Delete MongoDB collections** (if needed):
   ```bash
   mongosh kmlwj --eval "db.getCollectionNames().forEach(c => db[c].drop())"
   ```

2. **Re-run migration**:
   ```bash
   npx ts-node scripts/migrate-mysql-to-mongodb.ts
   ```

3. **Verify with validation**:
   ```bash
   npx ts-node scripts/validate-migration.ts
   ```

## Post-Migration Checklist

- [ ] Migration script executed successfully
- [ ] Validation script passes all checks
- [ ] Post-migration tests pass
- [ ] Health endpoint returns MongoDB connected status
- [ ] Users can authenticate successfully
- [ ] RBAC enforced correctly
- [ ] Financial data displays correctly
- [ ] Audit logs are accessible
- [ ] All ERP modules function
- [ ] PostgreSQL dependencies removed from codebase

## Support

For issues:
1. Check the migration report for specific table failures
2. Review validation results for data mismatches
3. Check health endpoint for MongoDB connection status
4. Review API error logs for runtime issues
5. Verify environment variables are set correctly

## Files Created

- `scripts/migrate-mysql-to-mongodb.ts` - Main migration script
- `scripts/validate-migration.ts` - Data validation script
- `scripts/test-post-migration.ts` - Functional testing script
- `api/_health.ts` - Enhanced health check endpoint (updated)
- `MIGRATION_README.md` - This file
