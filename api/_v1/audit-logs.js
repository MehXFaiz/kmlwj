import { makeHandler } from "../_utils/handler.js";
import { verifyAuth, verifyPermission } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { PERMS } from "../_constants/permissions.js";
var audit_logs_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;
  if (method === "GET") {
    const { limit = "100", page = "1" } = req.query;
    const limitNum = parseInt(limit) || 100;
    const pageNum = parseInt(page) || 1;
    const skip = (pageNum - 1) * limitNum;
    const [dbLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        include: {
          user: {
            select: { fullName: true, email: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.auditLog.count()
    ]);
    const formatted = dbLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      module: log.module || "SYSTEM",
      details: `${log.module}: ${log.action} performed. IP: ${log.ipAddress || "unknown"}.`,
      user: log.user ? log.user.fullName : "System",
      email: log.user ? log.user.email : null,
      ipAddress: log.ipAddress || null,
      userAgent: log.userAgent || null,
      oldValues: log.oldValues || null,
      newValues: log.newValues || null
    }));
    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  audit_logs_default as default
};
