import { makeHandler } from "../_utils/handler.js";
import { verifyAuth } from "../_middlewares/auth.middleware.js";
import { prisma } from "../_prisma.js";
import { logAudit } from "../_utils/audit.js";
var customers_default = makeHandler(async (req, res) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;
  const { method } = req;
  const id = req.query.id;
  if (method === "GET") {
    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" }
    });
    return res.status(200).json({ status: 200, data: customers });
  }
  if (method === "POST") {
    const { name, email, phone, address, company, isActive } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: "Name is required", status: 400 } });
    }
    const newCustomer = await prisma.customer.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        company: company || null,
        isActive: isActive !== void 0 ? Boolean(isActive) : true
      }
    });
    await logAudit(req.user.id, "Create Customer", "CUSTOMER", null, newCustomer, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(201).json({ status: 201, data: newCustomer });
  }
  if (method === "PUT") {
    if (!id) {
      return res.status(400).json({ error: { message: "Customer ID is required", status: 400 } });
    }
    const existingCustomer = await prisma.customer.findUnique({ where: { id } });
    if (!existingCustomer) {
      return res.status(404).json({ error: { message: "Customer not found", status: 404 } });
    }
    const { name, email, phone, address, company, isActive } = req.body;
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        name: name !== void 0 ? name : void 0,
        email: email !== void 0 ? email || null : void 0,
        phone: phone !== void 0 ? phone || null : void 0,
        address: address !== void 0 ? address || null : void 0,
        company: company !== void 0 ? company || null : void 0,
        isActive: isActive !== void 0 ? Boolean(isActive) : void 0
      }
    });
    await logAudit(req.user.id, "Update Customer", "CUSTOMER", existingCustomer, updatedCustomer, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, data: updatedCustomer });
  }
  if (method === "DELETE") {
    if (!id) {
      return res.status(400).json({ error: { message: "Customer ID is required", status: 400 } });
    }
    const existingCustomer = await prisma.customer.findUnique({ where: { id }, include: { invoices: true } });
    if (!existingCustomer) {
      return res.status(404).json({ error: { message: "Customer not found", status: 404 } });
    }
    if (existingCustomer.invoices.length > 0) {
      return res.status(400).json({ error: { message: "Cannot delete customer with existing invoices", status: 400 } });
    }
    await prisma.customer.delete({ where: { id } });
    await logAudit(req.user.id, "Delete Customer", "CUSTOMER", existingCustomer, null, req.headers["x-forwarded-for"], req.headers["user-agent"]);
    return res.status(200).json({ status: 200, message: "Customer deleted successfully" });
  }
  return res.status(405).json({ error: { message: "Method Not Allowed", status: 405 } });
});
export {
  customers_default as default
};
