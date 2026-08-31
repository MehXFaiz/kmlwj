import { makeHandler } from "../_utils/handler.js";
import { prisma } from "../_prisma.js";
var health_default = makeHandler(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
  }
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    return res.status(200).json({
      success: true,
      database: "mongodb",
      status: "connected",
      server: "running"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      database: "mongodb",
      status: "disconnected",
      server: "running",
      error: error?.message || "Database check failed"
    });
  }
});
export {
  health_default as default
};
