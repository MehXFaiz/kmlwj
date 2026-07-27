import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { loadPermissions } from "../_services/permission.service.js";
import { PERMS } from "../_constants/permissions.js";
var notifications_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const userId = req.user.id;
  const userPerms = await loadPermissions(req);
  const canSeeSuperAdminOnly = userPerms.has(PERMS.SYSTEM_SETTINGS);
  const canSeeAdminOnly = userPerms.has(PERMS.MANAGE_USERS) || canSeeSuperAdminOnly;
  function buildVisibilityFilter() {
    if (canSeeSuperAdminOnly) {
      return { isCleared: false };
    }
    if (canSeeAdminOnly) {
      return { isCleared: false, visibility: { in: ["ALL", "ADMIN_ONLY"] } };
    }
    return { isCleared: false, visibility: "ALL", userId };
  }
  if (req.method === "GET") {
    const { limit = "50", page = "1" } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const skip = (pageNum - 1) * limitNum;
    const whereClause = buildVisibilityFilter();
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { ...whereClause, isRead: false } })
    ]);
    return res.status(200).json({
      status: 200,
      data: notifications,
      meta: { total, page: pageNum, limit: limitNum, unreadCount }
    });
  }
  if (req.method === "PATCH") {
    const action = req.query.action;
    const id = req.query.id || req.body?.id;
    const baseFilter = buildVisibilityFilter();
    if (action === "mark-read" && id) {
      await prisma.notification.updateMany({
        where: { id, ...baseFilter },
        data: { isRead: true }
      });
      return res.status(200).json({ status: 200, message: "Marked as read" });
    }
    if (action === "mark-all-read") {
      await prisma.notification.updateMany({
        where: { ...baseFilter, isRead: false },
        data: { isRead: true }
      });
      return res.status(200).json({ status: 200, message: "All notifications marked as read" });
    }
    if (action === "dismiss" && id) {
      await prisma.notification.updateMany({
        where: { id, ...baseFilter },
        data: { isCleared: true }
      });
      return res.status(200).json({ status: 200, message: "Notification dismissed" });
    }
    if (action === "clear-all") {
      await prisma.notification.updateMany({
        where: baseFilter,
        data: { isCleared: true }
      });
      return res.status(200).json({ status: 200, message: "All notifications cleared" });
    }
    return res.status(400).json({ error: { message: "Invalid action", status: 400 } });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  notifications_default as default
};
