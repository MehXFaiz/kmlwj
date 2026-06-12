import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../../_middlewares/auth.middleware.js';
import { prisma } from '../../_prisma.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  if (req.method === 'GET') {
    // Fetch all accounts
    const dbAccounts = await prisma.account.findMany({
      include: {
        accountType: true,
      },
      orderBy: { glCode: 'asc' },
    });

    // Helper to format accounts to match UI expectations
    const formatAccount = (acc: any) => ({
      id: acc.id,
      code: acc.glCode,
      name: acc.accountName,
      type: acc.accountType ? (acc.accountType.name.charAt(0) + acc.accountType.name.slice(1).toLowerCase()) : 'Asset',
      level: acc.accountLevel,
      detailType: acc.detailType,
      parentCode: null, // Will be filled logically below if needed, or by ID mapping
      currency: acc.currency,
      status: acc.isLocked ? 'Inactive' : 'Active',
      description: acc.description,
      subsidiary: acc.subsidiary,
      initialBalance: acc.initialBalance,
      isSystemDefined: acc.isSystemDefined,
      isReserved: acc.isReserved,
      children: [] as any[],
    });

    // Build Maps for efficient tree construction
    const accountMap = new Map<string, any>();
    const rootAccounts: any[] = [];

    // First pass: format all accounts
    dbAccounts.forEach(acc => {
      accountMap.set(acc.id, { ...formatAccount(acc), _parentId: acc.parentId, _code: acc.glCode });
    });

    // Second pass: attach children to parents and link parentCodes
    dbAccounts.forEach(acc => {
      const formattedNode = accountMap.get(acc.id);
      if (acc.parentId && accountMap.has(acc.parentId)) {
        const parentNode = accountMap.get(acc.parentId);
        formattedNode.parentCode = parentNode._code;
        parentNode.children.push(formattedNode);
      } else {
        // If it doesn't have a parentId, or the parentId wasn't found (orphaned), it goes to root.
        rootAccounts.push(formattedNode);
      }
    });

    // Clean up temporary variables
    const cleanTree = (nodes: any[]) => {
      nodes.forEach(node => {
        delete node._parentId;
        delete node._code;
        if (node.children.length > 0) {
          cleanTree(node.children);
        }
      });
    };

    cleanTree(rootAccounts);

    return res.status(200).json({ status: 200, data: rootAccounts });
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
