import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";

const VALID_THEMES = ["light", "dark", "system"];

// Self-service preferences: any authenticated user may read/update their own.
var user_preferences_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { themePreference: true }
    });
    return res.status(200).json({ status: 200, data: { themePreference: user?.themePreference || null } });
  }

  if (req.method === "PATCH") {
    const { themePreference } = req.body || {};
    if (!VALID_THEMES.includes(themePreference)) {
      return res.status(400).json({ error: { message: "themePreference must be 'light', 'dark' or 'system'", status: 400 } });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { themePreference }
    });
    return res.status(200).json({ status: 200, data: { themePreference } });
  }

  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  user_preferences_default as default
};
