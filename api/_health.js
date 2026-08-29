import { makeHandler } from "./_utils/handler.js";
import { prisma, pool } from "./_prisma.js";
import { logger } from "./_utils/logger.js";
var health_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  try {
    if (pool) {
      await pool.query("SELECT 1");
    }
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: "ok",
      database: "connected"
    });
  } catch (err) {
    logger.error({ error: err?.message }, "Health check database probe failed");
    return res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});
export {
  health_default as default
};
