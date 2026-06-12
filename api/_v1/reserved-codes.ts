import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;

  if (method === 'GET') {
    const dbReservedCodes = await prisma.reservedCode.findMany({
      orderBy: { reserveStart: 'asc' },
    });
    return res.status(200).json({ status: 200, data: dbReservedCodes });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const userPerms = user?.role.rolePermissions.map((rp) => rp.permission.name) || [];
  const isSuperAdmin = user?.role.name === 'Super Admin';

  const checkPerm = (perm: string) => {
    if (isSuperAdmin) return true;
    return userPerms.includes(perm);
  };

  if (method === 'POST') {
    if (!checkPerm('CREATE_ACCOUNT')) { // Assuming CREATE_ACCOUNT covers COA governance
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    const { reserveStart, reserveEnd, reserveReason, isActive } = req.body;

    if (!reserveStart || !reserveEnd || !reserveReason) {
      return res.status(400).json({ error: { message: 'Start code, end code, and reason are required', status: 400 } });
    }

    if (reserveStart > reserveEnd) {
      return res.status(400).json({ error: { message: 'Start code must be less than or equal to end code', status: 400 } });
    }

    // Check for overlaps
    const overlap = await prisma.reservedCode.findFirst({
      where: {
        reserveStart: { lte: reserveEnd },
        reserveEnd: { gte: reserveStart },
      },
    });

    if (overlap) {
      return res.status(400).json({ error: { message: `Range overlaps with existing reservation: ${overlap.reserveStart}-${overlap.reserveEnd}`, status: 400 } });
    }

    const newReservation = await prisma.reservedCode.create({
      data: {
        reserveStart,
        reserveEnd,
        reserveReason,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await logAudit(req.user.id, 'Create Reserved Code', 'COA', null, newReservation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(201).json({ status: 201, data: newReservation });
  }

  if (method === 'PUT') {
    if (!checkPerm('UPDATE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Reserved Code ID is required', status: 400 } });
    }

    const existingReservation = await prisma.reservedCode.findUnique({ where: { id } });
    if (!existingReservation) {
      return res.status(404).json({ error: { message: 'Reserved Code not found', status: 404 } });
    }

    const { reserveStart, reserveEnd, reserveReason, isActive } = req.body;
    
    const newStart = reserveStart !== undefined ? reserveStart : existingReservation.reserveStart;
    const newEnd = reserveEnd !== undefined ? reserveEnd : existingReservation.reserveEnd;

    if (newStart > newEnd) {
      return res.status(400).json({ error: { message: 'Start code must be less than or equal to end code', status: 400 } });
    }

    // Check for overlaps excluding self
    const overlap = await prisma.reservedCode.findFirst({
      where: {
        id: { not: id },
        reserveStart: { lte: newEnd },
        reserveEnd: { gte: newStart },
      },
    });

    if (overlap) {
      return res.status(400).json({ error: { message: `Range overlaps with existing reservation: ${overlap.reserveStart}-${overlap.reserveEnd}`, status: 400 } });
    }

    const updatedReservation = await prisma.reservedCode.update({
      where: { id },
      data: {
        reserveStart: newStart,
        reserveEnd: newEnd,
        reserveReason: reserveReason !== undefined ? reserveReason : existingReservation.reserveReason,
        isActive: isActive !== undefined ? isActive : existingReservation.isActive,
      },
    });

    await logAudit(req.user.id, 'Modify Reserved Code', 'COA', existingReservation, updatedReservation, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, data: updatedReservation });
  }

  if (method === 'DELETE') {
    if (!checkPerm('DELETE_ACCOUNT')) {
      return res.status(403).json({ error: { message: 'Forbidden: Insufficient permissions', status: 403 } });
    }

    if (!id) {
      return res.status(400).json({ error: { message: 'Reserved Code ID is required', status: 400 } });
    }

    const existingReservation = await prisma.reservedCode.findUnique({ where: { id } });
    if (!existingReservation) {
      return res.status(404).json({ error: { message: 'Reserved Code not found', status: 404 } });
    }

    await prisma.reservedCode.delete({ where: { id } });

    await logAudit(req.user.id, 'Delete Reserved Code', 'COA', existingReservation, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    return res.status(200).json({ status: 200, message: 'Reserved Code deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
