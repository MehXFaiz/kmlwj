import { makeHandler } from "../../_utils/handler.js";
import { logger } from "../../_utils/logger.js";
import { verifyAuth, verifyPermission } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { PERMS } from "../../_constants/permissions.js";
import { classifyError, errDetails } from "../../_services/accounting.service.js";
var history_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  if (!await verifyPermission(req, res, PERMS.VIEW_AUDIT)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  try {
    const { limit = "50", page = "1" } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const skip = (pageNum - 1) * limitNum;
    const [logs, total] = await Promise.all([
      prisma.aiRepairLog.findMany({
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.aiRepairLog.count()
    ]);
    return res.status(200).json({ status: 200, data: logs, meta: { total, page: pageNum, limit: limitNum } });
  } catch (error) {
    logger.error({ err: errDetails(error) }, "AI Accounting: failed to list repair history");
    const reason = classifyError(error);
    return res.status(500).json({ error: { message: `Failed to load repair history: ${reason}`, status: 500 } });
  }
});
export {
  history_default as default
};
