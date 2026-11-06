import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma, softDeleteAsyncContext } from "../_prisma.js";
import { isSuperAdmin, isAdminOrAbove } from "../_utils/soft-delete.js";
import { logDeletionAudit } from "../_utils/audit.js";
import { AccountingService } from "../_services/accounting.service.js";
const RECYCLE_BIN_MODULES = [
  {
    moduleKey: "hall-bookings",
    modelName: "HallBooking",
    delegate: "hallBooking",
    label: "Hall Bookings",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Hall Booking #${r.receiptNo || "-"} \u2014 ${r.bookerName || "Unknown Booker"}`,
      reference: `HB-${r.receiptNo || r.id?.slice(0, 8)}`,
      amount: Number(r.netAmount ?? r.hallCharges ?? 0),
      status: r.status || "Confirmed",
      details: `${Array.isArray(r.hallNames) && r.hallNames.length ? r.hallNames.join(", ") : "Hall"} | Program: ${r.programDate ? new Date(r.programDate).toISOString().split("T")[0] : "-"} (${String(r.timings || "-").split("#DELETED:")[0]})`
    })
  },
  {
    moduleKey: "journal-entries",
    modelName: "JournalEntry",
    delegate: "journalEntry",
    label: "Journal Entries / Vouchers",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => {
      const totalDebit = Array.isArray(r.lines) ? r.lines.reduce((s, l) => s + Number(l.debit || 0), 0) : null;
      return {
        title: `${r.voucherNo || "Voucher"} (${r.voucherType || "JV"})`,
        reference: r.reference || r.voucherNo || r.id?.slice(0, 8),
        amount: totalDebit,
        status: r.status || "Cancelled",
        details: r.description || r.reversalReason || "General Ledger Voucher"
      };
    }
  },
  {
    moduleKey: "donations",
    modelName: "Donation",
    delegate: "donation",
    label: "Donations Disbursed",
    category: "Donations & Welfare",
    isFinancial: true,
    describe: (r) => ({
      title: `${r.donationType || "Donation"} Disbursement \u2014 ${r.donorName || r.month || r.disbursementMonth || ""}`,
      reference: r.voucherNo || `DON-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "PENDING",
      details: `Month: ${r.disbursementMonth || r.month || "-"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "donations-received",
    modelName: "DonationReceived",
    delegate: "donationReceived",
    label: "Donations Received",
    category: "Donations & Welfare",
    isFinancial: true,
    describe: (r) => ({
      title: `Donation Receipt #${r.receiptNo || "-"} (${r.donationType || "GENERAL"})`,
      reference: `DNR-${r.receiptNo || r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "POSTED",
      details: `${r.remarks || "Donation Received"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "revenue-collections",
    modelName: "RevenueCollection",
    delegate: "revenueCollection",
    label: "Specialized Revenue",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `${r.category || "Revenue"}: ${r.title || "Collection"}`,
      reference: r.receiptNo ? `REV-${r.receiptNo}` : `REV-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "POSTED",
      details: `${r.description || r.purpose || r.category || "-"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "add-income",
    modelName: "AddIncomeRecord",
    delegate: "addIncomeRecord",
    label: "Direct / Add Income",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Direct Income ${r.referenceNumber ? `#${r.referenceNumber}` : ""}`,
      reference: r.referenceNumber || `INC-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "POSTED",
      details: `${r.remarks || "Add Income Record"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "simple-income",
    modelName: "SimpleIncome",
    delegate: "simpleIncome",
    label: "Simple Income",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Simple Income \u2014 ${r.receivedFrom || r.category || "Receipt"}`,
      reference: r.reference || `SINC-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: "POSTED",
      details: `${r.remarks || r.category || "-"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "simple-expense",
    modelName: "SimpleExpense",
    delegate: "simpleExpense",
    label: "Expenses",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Expense \u2014 ${r.paidTo || r.category || "Voucher"}`,
      reference: r.reference || `EXP-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "POSTED",
      details: `${r.description || r.category || "-"} | Method: ${r.paymentMethod || "-"}`
    })
  },
  {
    moduleKey: "petty-cash",
    modelName: "PettyCashTransaction",
    delegate: "pettyCashTransaction",
    label: "Petty Cash",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Petty Cash (${r.transactionType || "TX"}) \u2014 ${r.paidTo || r.receivedFrom || r.voucherNo || ""}`,
      reference: r.voucherNo || r.referenceNo || `PC-${r.id?.slice(0, 8)}`,
      amount: Number(r.amount || 0),
      status: r.status || "POSTED",
      details: r.narration || r.expenseCategory || "Petty Cash Transaction"
    })
  },
  {
    moduleKey: "invoices",
    modelName: "Invoice",
    delegate: "invoice",
    label: "Invoices",
    category: "Financial & Vouchers",
    isFinancial: true,
    describe: (r) => ({
      title: `Invoice #${r.invoiceNo || "-"}`,
      reference: r.invoiceNo || `INV-${r.id?.slice(0, 8)}`,
      amount: Number(r.totalAmount || 0),
      status: r.status || "Unpaid",
      details: `Due: ${r.dueDate ? new Date(r.dueDate).toISOString().split("T")[0] : "-"}`
    })
  },
  {
    moduleKey: "customers",
    modelName: "Customer",
    delegate: "customer",
    label: "Customers",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: r.name || "Customer",
      reference: r.email || r.phone || `CUST-${r.id?.slice(0, 8)}`,
      amount: null,
      status: "Master Record",
      details: `${r.address || "-"} | Phone: ${r.phone || "-"}`
    })
  },
  {
    moduleKey: "donors",
    modelName: "Donor",
    delegate: "donor",
    label: "Donors",
    category: "Donations & Welfare",
    isFinancial: false,
    describe: (r) => ({
      title: `${r.fullName || "Donor"} (${r.donorCode || "-"})`,
      reference: r.donorCode || r.cnic || `DNR-${r.id?.slice(0, 8)}`,
      amount: null,
      status: r.isActive ? "Active" : "Inactive",
      details: `CNIC: ${r.cnic || "-"} | Mobile: ${r.mobile || "-"} | City: ${r.city || "-"}`
    })
  },
  {
    moduleKey: "beneficiaries",
    modelName: "Beneficiary",
    delegate: "beneficiary",
    label: "Beneficiaries",
    category: "Donations & Welfare",
    isFinancial: false,
    describe: (r) => ({
      title: `${r.fullName || "Beneficiary"} ${r.cardNo ? `(Card #${r.cardNo})` : ""}`,
      reference: r.cnic || r.cardNo || `BEN-${r.id?.slice(0, 8)}`,
      amount: r.approvedDonationAmount ? Number(r.approvedDonationAmount) : null,
      status: r.ApprovalStatus || (r.isActive ? "Active" : "Inactive"),
      details: `CNIC: ${r.cnic || "-"} | Mobile: ${r.mobile || "-"} | Area: ${r.area || r.town || "-"}`
    })
  },
  {
    moduleKey: "members",
    modelName: "Member",
    delegate: "member",
    label: "Jamaat Members",
    category: "Membership & Zakat",
    isFinancial: false,
    describe: (r) => ({
      title: `${r.fullName || "Member"} (${r.membershipId || "-"})`,
      reference: r.membershipId || r.cnic || `MEM-${r.id?.slice(0, 8)}`,
      amount: r.totalPaid ? Number(r.totalPaid) : null,
      status: r.status || "Active",
      details: `CNIC: ${r.cnic || "-"} | Mobile: ${r.mobile || "-"} | Gham: ${r.ghamName || "-"}`
    })
  },
  {
    moduleKey: "zakat-cards",
    modelName: "ZakatCard",
    delegate: "zakatCard",
    label: "Zakat Cards",
    category: "Membership & Zakat",
    isFinancial: false,
    describe: (r) => ({
      title: `Zakat Card #${r.cardNumber || "-"}`,
      reference: r.cardNumber || `ZC-${r.id?.slice(0, 8)}`,
      amount: null,
      status: r.status || "Active",
      details: r.notes || `Category: ${r.assistanceCategory || "-"}`
    })
  },
  {
    moduleKey: "accounts",
    modelName: "Account",
    delegate: "account",
    label: "Chart of Accounts",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: `${r.glCode || "-"} \u2014 ${r.accountName || "Account"}`,
      reference: r.glCode || `ACC-${r.id?.slice(0, 8)}`,
      amount: Number(r.currentBalance || 0),
      status: r.accountLevel || "GL",
      details: `Detail Type: ${r.detailType || "-"} | Initial Bal: Rs. ${Number(r.initialBalance || 0).toLocaleString()}`
    })
  },
  {
    moduleKey: "revenue-heads",
    modelName: "RevenueHead",
    delegate: "revenueHead",
    label: "Revenue Heads",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: r.name || "Revenue Head",
      reference: `RH-${r.id?.slice(0, 8)}`,
      amount: null,
      status: "Master Head",
      details: r.description || "Revenue Classification Head"
    })
  },
  {
    moduleKey: "expense-heads",
    modelName: "ExpenseHead",
    delegate: "expenseHead",
    label: "Expense Heads",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: r.name || "Expense Head",
      reference: `EH-${r.id?.slice(0, 8)}`,
      amount: null,
      status: "Master Head",
      details: r.description || "Expense Classification Head"
    })
  },
  {
    moduleKey: "income-categories",
    modelName: "IncomeCategory",
    delegate: "incomeCategory",
    label: "Income Categories",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: r.name || "Income Category",
      reference: `ICAT-${r.id?.slice(0, 8)}`,
      amount: null,
      status: r.isActive ? "Active" : "Inactive",
      details: r.description || "Add Income Category"
    })
  },
  {
    moduleKey: "reserved-codes",
    modelName: "ReservedCode",
    delegate: "reservedCode",
    label: "Reserved GL Codes",
    category: "Chart of Accounts & Master Data",
    isFinancial: false,
    describe: (r) => ({
      title: `Reserved Range ${r.reserveStart} \u2013 ${r.reserveEnd}`,
      reference: `${r.reserveStart}-${r.reserveEnd}`,
      amount: null,
      status: r.isActive ? "Active" : "Inactive",
      details: `${r.accountType || "-"} | Reason: ${r.reserveReason || "-"}`
    })
  },
  {
    moduleKey: "users",
    modelName: "User",
    delegate: "user",
    label: "System Users",
    category: "Administration",
    isFinancial: false,
    describe: (r) => ({
      title: `${r.fullName || "User"} (${r.email || "-"})`,
      reference: r.email || `USR-${r.id?.slice(0, 8)}`,
      amount: null,
      status: "Deactivated User",
      details: `Email: ${r.email || "-"}`
    })
  }
];
const MODULE_MAP = new Map(
  RECYCLE_BIN_MODULES.map((m) => [m.moduleKey, m])
);
function sanitizeRecordForOutput(modelName, rec) {
  if (!rec || typeof rec !== "object") return rec;
  if (modelName === "User") {
    const { password, resetPasswordOtp, ...safeUser } = rec;
    return safeUser;
  }
  return rec;
}
var recycle_bin_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const isPrivileged = await isAdminOrAbove(req);
  const superAdmin = await isSuperAdmin(req);
  if (!isPrivileged && !superAdmin) {
    if (req.method === "DELETE" || req.method === "POST") {
      await logDeletionAudit({
        req,
        recordId: req.body?.id || req.query?.id || "recycle-bin",
        modelName: req.body?.moduleKey || "RecycleBin",
        module: "Recycle Bin",
        actionType: "UNAUTHORIZED_DELETE_ATTEMPT",
        reason: "Non-admin user attempted to access Recycle Bin operation"
      });
    }
    return res.status(403).json({
      status: 403,
      error: { message: "Forbidden: Only Administrators can access the Recycle Bin", status: 403 }
    });
  }
  if (req.method === "GET") {
    const {
      module: moduleFilter,
      search = "",
      startDate,
      endDate,
      deletedBy: deletedByFilter
    } = req.query;
    const targetModules = moduleFilter && moduleFilter !== "all" && MODULE_MAP.has(moduleFilter) ? [MODULE_MAP.get(moduleFilter)] : RECYCLE_BIN_MODULES;
    const allModuleResults = await softDeleteAsyncContext.run({ includeDeleted: true }, async () => {
      return Promise.all(
        RECYCLE_BIN_MODULES.map(async (cfg) => {
          const modelDelegate = prisma[cfg.delegate];
          if (!modelDelegate) return { cfg, rows: [] };
          const queryOpts = {
            where: { isDeleted: true }
          };
          if (cfg.moduleKey === "journal-entries") {
            queryOpts.include = { lines: true };
          }
          try {
            const rows = await modelDelegate.findMany(queryOpts);
            return { cfg, rows: Array.isArray(rows) ? rows : [] };
          } catch {
            return { cfg, rows: [] };
          }
        })
      );
    });
    const userIdsSet = /* @__PURE__ */ new Set();
    for (const { rows } of allModuleResults) {
      for (const r of rows) {
        if (r.deletedBy && typeof r.deletedBy === "string" && r.deletedBy.length === 36) {
          userIdsSet.add(r.deletedBy);
        }
        if (r.createdById && typeof r.createdById === "string" && r.createdById.length === 36) {
          userIdsSet.add(r.createdById);
        }
      }
    }
    const usersList = userIdsSet.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIdsSet) }, isDeleted: { in: [true, false] } },
      select: { id: true, fullName: true, email: true, role: { select: { name: true } } }
    }) : [];
    const userMap = new Map(
      usersList.map((u) => [
        u.id,
        { id: u.id, fullName: u.fullName, email: u.email, role: u.role?.name || "Admin" }
      ])
    );
    const byModuleCounts = {};
    let totalDeletedAll = 0;
    let financialRecordsCount = 0;
    let masterDataCount = 0;
    const targetKeys = new Set(targetModules.map((m) => m.moduleKey));
    const normalizedItems = [];
    for (const { cfg, rows } of allModuleResults) {
      byModuleCounts[cfg.moduleKey] = rows.length;
      totalDeletedAll += rows.length;
      if (cfg.isFinancial) {
        financialRecordsCount += rows.length;
      } else {
        masterDataCount += rows.length;
      }
      if (!targetKeys.has(cfg.moduleKey)) continue;
      for (const r of rows) {
        const desc = cfg.describe(r);
        const deletedAtRaw = r.deletedAt || r.updatedAt || r.createdAt || null;
        const deletedByUser = r.deletedBy && userMap.get(r.deletedBy) || (r.deletedBy ? { id: r.deletedBy, fullName: r.deletedBy, email: "", role: "Admin" } : { id: null, fullName: "Administrator / System", email: "", role: "System" });
        normalizedItems.push({
          id: r.id,
          moduleKey: cfg.moduleKey,
          moduleLabel: cfg.label,
          modelName: cfg.modelName,
          category: cfg.category,
          isFinancial: cfg.isFinancial,
          title: desc.title,
          reference: desc.reference,
          amount: desc.amount,
          status: desc.status,
          details: desc.details,
          deletedAt: deletedAtRaw,
          deletedBy: r.deletedBy || null,
          deletedByUser,
          hasLinkedJournal: Boolean(r.journalEntryId),
          journalEntryId: r.journalEntryId || null,
          originalRecord: sanitizeRecordForOutput(cfg.modelName, r)
        });
      }
    }
    const searchLower = String(search || "").trim().toLowerCase();
    const startMs = startDate ? (/* @__PURE__ */ new Date(`${startDate}T00:00:00.000Z`)).getTime() : null;
    const endMs = endDate ? (/* @__PURE__ */ new Date(`${endDate}T23:59:59.999Z`)).getTime() : null;
    const deletedByFilterLower = String(deletedByFilter || "").trim().toLowerCase();
    const filteredItems = normalizedItems.filter((item) => {
      if (searchLower) {
        const hay = [
          item.id,
          item.title,
          item.reference,
          item.details,
          item.moduleLabel,
          item.deletedByUser?.fullName,
          item.deletedByUser?.email
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      if (deletedByFilterLower) {
        const userHay = `${item.deletedBy || ""} ${item.deletedByUser?.fullName || ""} ${item.deletedByUser?.email || ""}`.toLowerCase();
        if (!userHay.includes(deletedByFilterLower)) return false;
      }
      if (startMs || endMs) {
        const ts = item.deletedAt ? new Date(item.deletedAt).getTime() : 0;
        if (startMs && ts < startMs) return false;
        if (endMs && ts > endMs) return false;
      }
      return true;
    });
    filteredItems.sort((a, b) => {
      const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return tb - ta;
    });
    const rawAuditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: "Delete", mode: "insensitive" } },
          { action: { contains: "Restore", mode: "insensitive" } },
          { action: { contains: "SOFT_DELETE", mode: "insensitive" } },
          { action: { contains: "PERMANENT_DELETE", mode: "insensitive" } },
          { action: { contains: "RESTORE", mode: "insensitive" } },
          { action: { contains: "UNAUTHORIZED_DELETE", mode: "insensitive" } }
        ]
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, role: { select: { name: true } } } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    return res.status(200).json({
      status: 200,
      data: {
        items: filteredItems,
        modules: RECYCLE_BIN_MODULES.map((m) => ({
          moduleKey: m.moduleKey,
          label: m.label,
          modelName: m.modelName,
          category: m.category,
          isFinancial: m.isFinancial,
          count: byModuleCounts[m.moduleKey] || 0
        })),
        summary: {
          totalDeleted: totalDeletedAll,
          filteredCount: filteredItems.length,
          financialRecordsCount,
          masterDataCount,
          byModule: byModuleCounts
        },
        history: rawAuditLogs,
        permissions: {
          canRestore: true,
          canPermanentDelete: superAdmin
        }
      }
    });
  }
  if (req.method === "POST") {
    const action = req.query.action || req.body?.action || "restore";
    if (action !== "restore") {
      return res.status(400).json({ error: { message: 'Unsupported action. Use action="restore".', status: 400 } });
    }
    const itemsToRestore = Array.isArray(req.body?.items) ? req.body.items : req.body?.moduleKey && req.body?.id ? [{ moduleKey: String(req.body.moduleKey), id: String(req.body.id) }] : [];
    const reason = req.body?.reason || "Restored from Recycle Bin by Administrator";
    if (itemsToRestore.length === 0) {
      return res.status(400).json({
        error: { message: "Please provide { moduleKey, id } or { items: [{ moduleKey, id }] } to restore.", status: 400 }
      });
    }
    const restoredResults = [];
    const errors = [];
    for (const entry of itemsToRestore) {
      const cfg = MODULE_MAP.get(entry.moduleKey);
      if (!cfg) {
        errors.push({ id: entry.id, moduleKey: entry.moduleKey, message: `Unknown module '${entry.moduleKey}'` });
        continue;
      }
      try {
        const restoredItem = await prisma.$transaction(async (tx) => {
          const delegate = tx[cfg.delegate];
          const existing = await delegate.findUnique({ where: { id: entry.id } });
          if (!existing) {
            throw new Error(`${cfg.label} record not found`);
          }
          if (!existing.isDeleted) {
            return existing;
          }
          if (cfg.moduleKey === "hall-bookings") {
            const cleanTimings = existing.timings ? String(existing.timings).split("#DELETED:")[0] : existing.timings;
            if (existing.hallId && existing.programDate && cleanTimings) {
              const conflict = await tx.hallBooking.findFirst({
                where: {
                  isDeleted: false,
                  id: { not: existing.id },
                  hallId: existing.hallId,
                  programDate: existing.programDate,
                  timings: cleanTimings,
                  status: { in: ["Confirmed", "Pending", "POSTED"] }
                }
              });
              if (conflict) {
                throw new Error(
                  `Cannot restore Hall Booking #${existing.receiptNo}: slot (${cleanTimings} on ${new Date(existing.programDate).toISOString().split("T")[0]}) is currently booked by Receipt #${conflict.receiptNo} (${conflict.bookerName}).`
                );
              }
            }
            const restoredBooking = await tx.hallBooking.update({
              where: { id: existing.id },
              data: {
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
                timings: cleanTimings
              }
            });
            if (existing.journalEntryId && existing.status === "POSTED") {
              await tx.journalEntry.update({
                where: { id: existing.journalEntryId },
                data: {
                  isDeleted: false,
                  deletedAt: null,
                  deletedBy: null,
                  status: "Posted"
                }
              }).catch(() => {
              });
              await AccountingService.recalculateBalancesForJournalEntry(tx, existing.journalEntryId);
            }
            return restoredBooking;
          }
          if (cfg.moduleKey === "journal-entries") {
            const targetStatus = existing.status === "Cancelled" ? "Posted" : existing.status || "Posted";
            const restoredJe = await tx.journalEntry.update({
              where: { id: existing.id },
              data: {
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
                status: targetStatus
              }
            });
            await AccountingService.recalculateBalancesForJournalEntry(tx, existing.id);
            return restoredJe;
          }
          if (cfg.moduleKey === "members") {
            const restoredMember = await tx.member.update({
              where: { id: existing.id },
              data: { isDeleted: false, deletedAt: null, deletedBy: null }
            });
            await tx.familyRelationship.updateMany({
              where: {
                OR: [{ memberId: existing.id }, { relatedMemberId: existing.id }],
                isDeleted: true
              },
              data: { isDeleted: false, deletedAt: null, deletedBy: null }
            });
            return restoredMember;
          }
          const restored = await delegate.update({
            where: { id: existing.id },
            data: {
              isDeleted: false,
              deletedAt: null,
              deletedBy: null
            }
          });
          if (existing.journalEntryId) {
            const shouldPost = existing.status === "POSTED" || existing.status === "APPROVED" || cfg.moduleKey === "simple-income";
            await tx.journalEntry.update({
              where: { id: existing.journalEntryId },
              data: {
                isDeleted: false,
                deletedAt: null,
                deletedBy: null,
                ...shouldPost ? { status: "Posted" } : {}
              }
            }).catch(() => {
            });
            await AccountingService.recalculateBalancesForJournalEntry(tx, existing.journalEntryId);
          }
          return restored;
        });
        await logDeletionAudit({
          req,
          recordId: entry.id,
          modelName: cfg.modelName,
          module: cfg.label,
          actionType: "RESTORE",
          actionLabel: `Restore ${cfg.label} from Recycle Bin`,
          previousState: { isDeleted: true },
          newState: sanitizeRecordForOutput(cfg.modelName, restoredItem),
          reason
        });
        restoredResults.push({
          id: entry.id,
          moduleKey: cfg.moduleKey,
          moduleLabel: cfg.label,
          data: sanitizeRecordForOutput(cfg.modelName, restoredItem)
        });
      } catch (err) {
        errors.push({
          id: entry.id,
          moduleKey: entry.moduleKey,
          message: err.message || `Failed to restore ${cfg.label}`
        });
      }
    }
    if (restoredResults.length === 0 && errors.length > 0) {
      return res.status(400).json({
        status: 400,
        message: errors[0].message,
        error: { message: errors.map((e) => e.message).join("; "), status: 400, details: errors }
      });
    }
    return res.status(200).json({
      status: 200,
      message: `Successfully restored ${restoredResults.length} record(s) from the Recycle Bin.`,
      data: {
        restored: restoredResults,
        errors
      }
    });
  }
  if (req.method === "DELETE") {
    if (!superAdmin) {
      await logDeletionAudit({
        req,
        recordId: req.body?.id || req.query?.id || "bulk",
        modelName: req.body?.moduleKey || "RecycleBin",
        module: "Recycle Bin",
        actionType: "UNAUTHORIZED_DELETE_ATTEMPT",
        reason: "Only Super Admin is authorized to permanently delete records from the Recycle Bin"
      });
      return res.status(403).json({
        status: 403,
        error: {
          message: "Forbidden: Only a Super Admin is authorized to permanently delete records from the Recycle Bin.",
          status: 403
        }
      });
    }
    const confirmPermanent = req.body?.confirmPermanent === true || req.query?.confirmPermanent === "true";
    if (!confirmPermanent) {
      return res.status(400).json({
        status: 400,
        error: {
          message: "Explicit confirmation (confirmPermanent: true) is required for permanent deletion.",
          status: 400
        }
      });
    }
    const itemsToDelete = Array.isArray(req.body?.items) ? req.body.items : req.body?.moduleKey && req.body?.id ? [{ moduleKey: String(req.body.moduleKey), id: String(req.body.id) }] : req.query?.moduleKey && req.query?.id ? [{ moduleKey: String(req.query.moduleKey), id: String(req.query.id) }] : [];
    const reason = req.body?.reason || "Authorized Permanent Deletion from Recycle Bin by Super Admin";
    if (itemsToDelete.length === 0) {
      return res.status(400).json({
        error: { message: "Please provide { moduleKey, id } or { items: [{ moduleKey, id }] } to permanently delete.", status: 400 }
      });
    }
    const deletedResults = [];
    const errors = [];
    for (const entry of itemsToDelete) {
      const cfg = MODULE_MAP.get(entry.moduleKey);
      if (!cfg) {
        errors.push({ id: entry.id, moduleKey: entry.moduleKey, message: `Unknown module '${entry.moduleKey}'` });
        continue;
      }
      try {
        const snapshot = await prisma.$transaction(async (tx) => {
          const delegate = tx[cfg.delegate];
          const existing = await delegate.findUnique({ where: { id: entry.id } });
          if (!existing) {
            throw new Error(`${cfg.label} record not found`);
          }
          if (!existing.isDeleted) {
            throw new Error(
              `Record ${entry.id} in ${cfg.label} is currently active. Only soft-deleted records in the Recycle Bin can be permanently deleted.`
            );
          }
          if (cfg.moduleKey === "accounts") {
            if (existing.accountLevel === "MAIN" || existing.isLocked || existing.isSystemDefined) {
              throw new Error(`Account "${existing.accountName}" is system-protected or locked and cannot be permanently deleted.`);
            }
            const [lineCount, childCount] = await Promise.all([
              tx.journalEntryLine.count({ where: { accountId: existing.id } }),
              tx.account.count({ where: { parentId: existing.id, isDeleted: { in: [true, false] } } })
            ]);
            if (lineCount > 0 || childCount > 0) {
              throw new Error(
                `Cannot permanently delete Account "${existing.accountName}" (${existing.glCode}) because it has ${lineCount} ledger entry line(s) and ${childCount} child account(s).`
              );
            }
          }
          if (cfg.moduleKey === "donors") {
            const receiptCount = await tx.donationReceived.count({
              where: { donorId: existing.id, isDeleted: { in: [true, false] } }
            });
            if (receiptCount > 0) {
              throw new Error(
                `Cannot permanently delete Donor "${existing.fullName}" because ${receiptCount} donation receipt(s) reference this donor.`
              );
            }
          }
          if (cfg.moduleKey === "beneficiaries") {
            const disbCount = await tx.donation.count({
              where: { beneficiaryId: existing.id, isDeleted: { in: [true, false] } }
            });
            if (disbCount > 0) {
              throw new Error(
                `Cannot permanently delete Beneficiary "${existing.fullName}" because ${disbCount} donation disbursement(s) reference this beneficiary.`
              );
            }
          }
          if (cfg.moduleKey === "journal-entries") {
            await AccountingService.deleteJournalEntry(tx, existing.id, req.user.id, reason, true);
            return existing;
          }
          if (existing.journalEntryId) {
            await AccountingService.deleteJournalEntry(tx, existing.journalEntryId, req.user.id, reason, true).catch(() => {
            });
          }
          if (cfg.moduleKey === "members") {
            await tx.familyRelationship.deleteMany({
              where: { OR: [{ memberId: existing.id }, { relatedMemberId: existing.id }] }
            });
          }
          await delegate.delete({ where: { id: existing.id } });
          return existing;
        });
        await logDeletionAudit({
          req,
          recordId: entry.id,
          modelName: cfg.modelName,
          module: cfg.label,
          actionType: "PERMANENT_DELETE",
          actionLabel: `Permanent Delete ${cfg.label} from Recycle Bin`,
          previousState: sanitizeRecordForOutput(cfg.modelName, snapshot),
          newState: null,
          reason
        });
        deletedResults.push({
          id: entry.id,
          moduleKey: cfg.moduleKey,
          moduleLabel: cfg.label
        });
      } catch (err) {
        await logDeletionAudit({
          req,
          recordId: entry.id,
          modelName: cfg.modelName,
          module: cfg.label,
          actionType: "DELETE_FAILED",
          actionLabel: `Failed Permanent Delete ${cfg.label}`,
          reason: err.message || "Dependency check failed"
        });
        errors.push({
          id: entry.id,
          moduleKey: entry.moduleKey,
          message: err.message || `Failed to permanently delete ${cfg.label}`
        });
      }
    }
    if (deletedResults.length === 0 && errors.length > 0) {
      return res.status(400).json({
        status: 400,
        message: errors[0].message,
        error: { message: errors.map((e) => e.message).join("; "), status: 400, details: errors }
      });
    }
    return res.status(200).json({
      status: 200,
      message: `Permanently deleted ${deletedResults.length} record(s) from the database.`,
      data: {
        deleted: deletedResults,
        errors
      }
    });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  RECYCLE_BIN_MODULES,
  recycle_bin_default as default
};
