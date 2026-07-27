import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, verifyPermission, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';
import { notify } from '../_utils/notify.js';
import { PERMS } from '../_constants/permissions.js';
import { isSuperAdmin, getDeletedFilter } from '../_utils/soft-delete.js';

const ALL_FIELDS = [
  'name', 'fatherName', 'husbandName', 'cnic', 'dob', 'mobile', 'email',
  'familySize', 'monthlyIncome', 'monthlyExpenses', 'debtAmount',
  'housingStatus', 'housingOther',
  'address', 'town', 'area', 'gham', 'husbandGham', 'fatherGham',
  'education', 'profession', 'firm', 'remarks',
  'photoUrl', 'cnicFrontUrl', 'cnicBackUrl',
  'isActive',
] as const;

function pickData(body: any, isCreate: boolean) {
  const data: any = {};
  for (const key of ALL_FIELDS) {
    if (body[key] === undefined) {
      if (!isCreate) continue;
    }
    const val = body[key];
    if (key === 'isActive') {
      data.isActive = val !== undefined ? Boolean(val) : true;
    } else if (key === 'dob') {
      data.dob = val ? new Date(val) : null;
    } else if (key === 'familySize') {
      data.familySize = val ? parseInt(val) : null;
    } else if (['monthlyIncome', 'monthlyExpenses', 'debtAmount'].includes(key)) {
      data[key] = val || val === 0 ? parseFloat(val) : null;
    } else {
      data[key] = typeof val === 'string' ? (val.trim() || null) : (val || null);
    }
  }
  return data;
}

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;
  const id = req.query.id as string;
  const action = (req.query.action || req.body?.action) as string;

  if (method === 'GET') {
    if (!await verifyPermission(req, res, PERMS.VIEW_BENEFICIARIES)) return;

    const { limit = '100', page = '1' } = req.query as any;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;
    const whereClause = getDeletedFilter(req.query);

    const [beneficiaries, total] = await Promise.all([
      prisma.beneficiary.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.beneficiary.count({ where: whereClause })
    ]);
    return res.status(200).json({ status: 200, data: beneficiaries, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'PUT' || method === 'POST') {
    if (action === 'restore') {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can restore records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
      }
      const existing = await prisma.beneficiary.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
      }
      const restored = await prisma.beneficiary.update({
        where: { id },
        data: { isDeleted: false, deletedAt: null, deletedBy: null }
      });
      await logAudit(req.user.id, 'Restore Beneficiary', 'DONATION', existing, restored, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Beneficiary restored successfully', data: restored });
    }
  }

  if (method === 'POST') {
    if (!await verifyPermission(req, res, PERMS.CREATE_BENEFICIARY)) return;

    const { name, fatherName, husbandName, cnic, mobile, email, address, town, area, gham, housingStatus, housingOther, familySize, monthlyIncome, monthlyExpenses, debtAmount } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
    }
    if (fatherName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: 'Father name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (husbandName && !/^[a-zA-Z\s.-]{2,80}$/.test(String(husbandName))) {
      return res.status(400).json({ error: { message: 'Husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (cnic && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: 'CNIC must contain exactly 13 digits', status: 400 } });
    }
    if (mobile && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Email address is invalid', status: 400 } });
    }
    if (address && !/^[a-zA-Z0-9\s.,#/-]{3,200}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (town && !/^[a-zA-Z\s.-]{2,80}$/.test(String(town))) {
      return res.status(400).json({ error: { message: 'Town can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (area && !/^[a-zA-Z\s.-]{2,80}$/.test(String(area))) {
      return res.status(400).json({ error: { message: 'Area can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (gham && !/^[a-zA-Z\s.-]{2,80}$/.test(String(gham))) {
      return res.status(400).json({ error: { message: 'Gham can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (housingStatus && !['Owned', 'Rented', 'Homeless', 'Other'].includes(String(housingStatus))) {
      return res.status(400).json({ error: { message: 'Housing status is invalid', status: 400 } });
    }
    if (housingOther && !/^[a-zA-Z\s.-]{2,80}$/.test(String(housingOther))) {
      return res.status(400).json({ error: { message: 'Housing detail can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (familySize !== undefined && familySize !== '' && (!/^\d+$/.test(String(familySize)) || Number(familySize) < 0)) {
      return res.status(400).json({ error: { message: 'Family size must be a non-negative whole number', status: 400 } });
    }
    if (monthlyIncome !== undefined && monthlyIncome !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyIncome)) || Number(monthlyIncome) < 0)) {
      return res.status(400).json({ error: { message: 'Monthly income must be a non-negative number', status: 400 } });
    }
    if (monthlyExpenses !== undefined && monthlyExpenses !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyExpenses)) || Number(monthlyExpenses) < 0)) {
      return res.status(400).json({ error: { message: 'Monthly expenses must be a non-negative number', status: 400 } });
    }
    if (debtAmount !== undefined && debtAmount !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(debtAmount)) || Number(debtAmount) < 0)) {
      return res.status(400).json({ error: { message: 'Debt amount must be a non-negative number', status: 400 } });
    }

    const data = pickData(req.body, true);

    const newBeneficiary = await prisma.beneficiary.create({ data });

    await logAudit(req.user.id, 'Create Beneficiary', 'DONATION', null, newBeneficiary, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Person Added to Welfare List',
      message: `${(newBeneficiary as any).name || 'Beneficiary'} added.`,
      module: 'Welfare',
      recordId: (newBeneficiary as any).id,
      actionType: 'CREATE',
    });

    return res.status(201).json({ status: 201, data: newBeneficiary });
  }

  if (method === 'PUT') {
    if (!await verifyPermission(req, res, PERMS.UPDATE_BENEFICIARY)) return;

    if (!id) {
      return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
    }

    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
    }

    const { name, fatherName, husbandName, cnic, mobile, email, address, town, area, gham, housingStatus, housingOther, familySize, monthlyIncome, monthlyExpenses, debtAmount } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: { message: 'Name is required', status: 400 } });
    }
    if (fatherName !== undefined && fatherName !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(fatherName))) {
      return res.status(400).json({ error: { message: 'Father name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (husbandName !== undefined && husbandName !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(husbandName))) {
      return res.status(400).json({ error: { message: 'Husband name can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (cnic !== undefined && cnic !== '' && !/^\d{13}$/.test(String(cnic))) {
      return res.status(400).json({ error: { message: 'CNIC must contain exactly 13 digits', status: 400 } });
    }
    if (mobile !== undefined && mobile !== '' && !/^\d{11}$/.test(String(mobile))) {
      return res.status(400).json({ error: { message: 'Mobile number must contain exactly 11 digits', status: 400 } });
    }
    if (email !== undefined && email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: { message: 'Email address is invalid', status: 400 } });
    }
    if (address !== undefined && address !== '' && !/^[a-zA-Z0-9\s.,#/-]{3,200}$/.test(String(address))) {
      return res.status(400).json({ error: { message: 'Address contains unsupported characters', status: 400 } });
    }
    if (town !== undefined && town !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(town))) {
      return res.status(400).json({ error: { message: 'Town can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (area !== undefined && area !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(area))) {
      return res.status(400).json({ error: { message: 'Area can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (gham !== undefined && gham !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(gham))) {
      return res.status(400).json({ error: { message: 'Gham can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (housingStatus !== undefined && housingStatus !== '' && !['Owned', 'Rented', 'Homeless', 'Other'].includes(String(housingStatus))) {
      return res.status(400).json({ error: { message: 'Housing status is invalid', status: 400 } });
    }
    if (housingOther !== undefined && housingOther !== '' && !/^[a-zA-Z\s.-]{2,80}$/.test(String(housingOther))) {
      return res.status(400).json({ error: { message: 'Housing detail can only contain letters, spaces, hyphens, and dots', status: 400 } });
    }
    if (familySize !== undefined && familySize !== '' && (!/^\d+$/.test(String(familySize)) || Number(familySize) < 0)) {
      return res.status(400).json({ error: { message: 'Family size must be a non-negative whole number', status: 400 } });
    }
    if (monthlyIncome !== undefined && monthlyIncome !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyIncome)) || Number(monthlyIncome) < 0)) {
      return res.status(400).json({ error: { message: 'Monthly income must be a non-negative number', status: 400 } });
    }
    if (monthlyExpenses !== undefined && monthlyExpenses !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(monthlyExpenses)) || Number(monthlyExpenses) < 0)) {
      return res.status(400).json({ error: { message: 'Monthly expenses must be a non-negative number', status: 400 } });
    }
    if (debtAmount !== undefined && debtAmount !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(debtAmount)) || Number(debtAmount) < 0)) {
      return res.status(400).json({ error: { message: 'Debt amount must be a non-negative number', status: 400 } });
    }

    const data = pickData(req.body, false);

    const updatedBeneficiary = await prisma.beneficiary.update({
      where: { id },
      data,
    });

    await logAudit(req.user.id, 'Update Beneficiary', 'DONATION', existingBeneficiary, updatedBeneficiary, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Welfare Record Updated',
      message: `${(updatedBeneficiary as any).name || 'Beneficiary'} record updated.`,
      module: 'Welfare',
      recordId: (updatedBeneficiary as any).id,
      actionType: 'UPDATE',
    });

    return res.status(200).json({ status: 200, data: updatedBeneficiary });
  }

  if (method === 'DELETE') {
    const isPermanent = req.query.permanent === 'true' || req.query.action === 'permanent_delete' || req.body?.permanent === true;
    if (isPermanent) {
      if (!await isSuperAdmin(req)) {
        return res.status(403).json({ error: { message: 'Forbidden: Only Super Admin can permanently delete records', status: 403 } });
      }
      if (!id) {
        return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
      }
      const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
      if (!existingBeneficiary) {
        return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
      }
      await prisma.beneficiary.delete({ where: { id } });
      await logAudit(req.user.id, 'Permanent Delete Beneficiary', 'DONATION', existingBeneficiary, null, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);
      return res.status(200).json({ status: 200, message: 'Beneficiary permanently deleted successfully' });
    }

    if (!await verifyPermission(req, res, PERMS.DELETE_BENEFICIARY)) return;

    if (!id) {
      return res.status(400).json({ error: { message: 'Beneficiary ID is required', status: 400 } });
    }

    const existingBeneficiary = await prisma.beneficiary.findUnique({ where: { id } });
    if (!existingBeneficiary) {
      return res.status(404).json({ error: { message: 'Beneficiary not found', status: 404 } });
    }

    const updated = await prisma.beneficiary.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id }
    });

    await logAudit(req.user.id, 'Delete Beneficiary', 'DONATION', existingBeneficiary, updated, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

    await notify(req, {
      title: 'Welfare Record Deleted',
      message: `${(existingBeneficiary as any).name || 'Beneficiary'} removed from welfare list.`,
      module: 'Welfare',
      recordId: (existingBeneficiary as any).id,
      actionType: 'DELETE',
      visibility: 'ADMIN_ONLY',
    });

    return res.status(200).json({ status: 200, message: 'Beneficiary deleted successfully' });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
