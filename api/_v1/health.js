import { makeHandler } from "../_utils/handler.js";
import { prisma, pool, getMySQLDatabaseUrl } from "../_prisma.js";
var health_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  const dbUrl = getMySQLDatabaseUrl();
  const maskedDbUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ":****@") : "NOT_CONFIGURED";
  try {
    let poolStatus = "not_configured";
    if (pool) {
      await pool.query("SELECT 1");
      poolStatus = "connected";
    }
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count().catch(() => -1);
    return res.status(200).json({
      success: true,
      status: "ok",
      database: "connected",
      mysqlPool: poolStatus,
      target: maskedDbUrl,
      usersInDb: userCount,
      server: "running",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      status: "error",
      database: "disconnected",
      target: maskedDbUrl,
      error: error?.message || "Database connection probe failed",
      server: "running",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
export {
  health_default as default
};
