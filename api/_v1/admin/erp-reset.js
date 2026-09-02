import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { ErpResetService } from "../../_services/erp-reset.service.js";
import { prisma } from "../../_prisma.js";
var erp_reset_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: true }
  });
  const roleName = user?.role?.name;
  const isSuperAdmin = roleName === "Super Admin" || roleName === "SUPER ADMIN";
  if (!isSuperAdmin) {
    return res.status(403).json({
      error: {
        message: "Forbidden: Only Super Admin can access ERP Reset features.",
        status: 403
      }
    });
  }
  const url = req.url || "";
  const isPreview = url.includes("/preview") || req.query.action === "preview";
  const isHistory = url.includes("/history") || req.query.action === "history";
  if (req.method === "GET") {
    if (isHistory) {
      const history = await ErpResetService.getResetHistory(Number(req.query.limit) || 20);
      return res.status(200).json({
        status: 200,
        data: history
      });
    }
    const mode = req.query.mode || "TRANSACTIONS_ONLY";
    const preview = await ErpResetService.getResetPreview(mode);
    return res.status(200).json({
      status: 200,
      data: preview
    });
  }
  if (req.method === "POST") {
    const { password, confirmationText, resetMode } = req.body || {};
    try {
      const result = await ErpResetService.executeReset({
        userId: req.user.id,
        resetMode: resetMode || "TRANSACTIONS_ONLY",
        password,
        confirmationText,
        ipAddress: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"]
      });
      return res.status(200).json({
        status: 200,
        message: result.message,
        data: result
      });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({
        error: {
          message: error.message || "ERP Data Reset failed",
          code: error.code || "RESET_FAILED",
          status
        }
      });
    }
  }
  return res.status(405).json({
    error: { message: "Method Not Allowed", status: 405 }
  });
});
export {
  erp_reset_default as default
};
