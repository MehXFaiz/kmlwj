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
  let user;
  try {
    user = await prisma.user.findUnique({
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
  } catch (err) {
    return res.status(500).json({ error: { message: "Database service error loading user profile", status: 500 } });
  }
  if (!user) {
    return res.status(404).json({ error: { message: "User not found", status: 404 } });
  }
  if (user.isActive !== true) {
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
  const structuredPermissions = [];
  if (isPrivileged) {
    for (const mod of ERP_MODULE_DEFINITIONS) {
      for (const act of mod.actions) {
        structuredPermissions.push({ module: mod.key, action: act });
      }
    }
  } else {
    const added = /* @__PURE__ */ new Set();
    for (const p of permissionSet) {
      if (p.includes(".")) {
        const [modKey, act] = p.split(".");
        const key = `${modKey}:${act}`;
        if (!added.has(key)) {
          added.add(key);
          structuredPermissions.push({ module: modKey, action: act });
        }
      }
    }
  }
  return res.status(200).json({
    status: 200,
    data: {
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role.name,
        roleId: user.role.id
      },
      role: {
        id: user.role.id,
        name: user.role.name,
        isPrivileged
      },
      permissions: structuredPermissions,
      rawPermissions: Array.from(permissionSet),
      // Flat properties for backward compatibility
      id: user.id,
      name: user.fullName,
      fullName: user.fullName,
      email: user.email,
      roleName: user.role.name,
      roleId: user.role.id,
      isPrivileged,
      modulePermissions
    }
  });
});
export {
  me_default as default
};
