import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
import { loadPermissions } from "../../_services/permission.service.js";
import { ERP_MODULE_DEFINITIONS } from "../../_constants/permissions.js";
var me_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });
  if (!user) {
    return res.status(404).json({ error: { message: "User not found", status: 404 } });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: { message: "This account has been deactivated", status: 403 } });
  }
  const permissionSet = await loadPermissions(req);
  const permissions = Array.from(permissionSet);
  const isPrivileged = user.role.isPrivileged === true;
  const modulePermissions = {};
  for (const mod of ERP_MODULE_DEFINITIONS) {
    const actMap = {};
    for (const act of mod.actions) {
      actMap[act] = isPrivileged || permissionSet.has(`${mod.key}.${act}`);
    }
    modulePermissions[mod.key] = actMap;
  }
  return res.status(200).json({
    status: 200,
    data: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      roleId: user.role.id,
      isPrivileged,
      permissions,
      modulePermissions
    }
  });
});
export {
  me_default as default
};
