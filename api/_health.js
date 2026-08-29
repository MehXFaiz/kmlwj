import { makeHandler } from "./_utils/handler.js";
import { prisma, pool, getMySQLDatabaseUrl } from "./_prisma.js";
import { logger } from "./_utils/logger.js";
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
      status: "ok",
      database: "connected",
      mysqlPool: poolStatus,
      target: maskedDbUrl,
      usersInDb: userCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    logger.error({ error: err?.message }, "Health check database probe failed");
    return res.status(503).json({
      status: "error",
      database: "disconnected",
      target: maskedDbUrl,
      error: err?.message || "Database connection probe failed",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
export {
  health_default as default
};
