import { makeHandler } from "../../_utils/handler.js";
import { verifyAuth } from "../../_middlewares/auth.middleware.js";
import { prisma } from "../../_prisma.js";
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
  const permissions = user.role.rolePermissions.map((rp) => rp.permission.name);
  return res.status(200).json({
    status: 200,
    data: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      /**
       * isPrivileged: true  → Super Admin or Admin (full CRUD access)
       * isPrivileged: false → all other roles (View + Create only)
       * The frontend uses this to hide Edit/Delete buttons.
       * The backend enforces this independently — UI state cannot bypass it.
       */
      isPrivileged: user.role.isPrivileged,
      permissions
    }
  });
});
export {
  me_default as default
};
