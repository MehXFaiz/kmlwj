import type { VercelRequest, VercelResponse } from '@vercel/node';
import { makeHandler } from '../_utils/handler.js';
import { verifyAuth, AuthenticatedRequest } from '../_middlewares/auth.middleware.js';
import { prisma } from '../_prisma.js';
import { logAudit } from '../_utils/audit.js';

export default makeHandler(async (req: AuthenticatedRequest, res: VercelResponse) => {
  const authenticated = await verifyAuth(req, res);
  if (!authenticated || !req.user) return;

  const { method } = req;

  if (method === 'GET') {
    const { subsidiary, limit = '100', page = '1' } = req.query as any;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 100;
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (subsidiary && subsidiary !== 'Global') {
      whereClause.subsidiary = subsidiary;
    }

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where: whereClause,
        include: {
          lines: {
            include: { account: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where: whereClause })
    ]);

    const formatted = entries.map(je => ({
      id: je.jeNumber,
      dbId: je.id,
      date: je.date.toISOString().split('T')[0],
      subsidiary: je.subsidiary,
      reference: je.reference,
      postedBy: je.postedBy,
      status: je.status,
      lines: je.lines.map(line => ({
        accountCode: line.account.glCode,
        description: line.description,
        debit: line.debit,
        credit: line.credit
      }))
    }));

    return res.status(200).json({ status: 200, data: formatted, meta: { total, page: pageNum, limit: limitNum } });
  }

  if (method === 'POST') {
    const { date, subsidiary, reference, lines } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: { message: 'Lines are required', status: 400 } });
    }

    // Check balance
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit) || 0;
      totalCredit += Number(line.credit) || 0;
    }

    // simple float compare
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      return res.status(400).json({ error: { message: 'Journal entry must balance', status: 400 } });
    }

    // Generate jeNumber (simple for now: JE-timestamp, in production use atomic sequence)
    const jeNumber = `JE-${Date.now()}`;
    const postedBy = req.user.email || 'system';

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create the journal entry
        const je = await tx.journalEntry.create({
          data: {
            jeNumber,
            date: new Date(date || new Date()),
            subsidiary: subsidiary || 'Global',
            reference: reference || 'Journal Entry',
            postedBy,
            status: 'Posted',
          }
        });

        // Add lines and ledger entries
        for (const line of lines) {
          const account = await tx.account.findUnique({
            where: { glCode: line.accountCode }
          });

          if (!account) {
            throw new Error(`Account not found: ${line.accountCode}`);
          }

          // Create JE Line
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: je.id,
              accountId: account.id,
              description: line.description || null,
              debit: Number(line.debit) || 0,
              credit: Number(line.credit) || 0,
            }
          });

          // Create Ledger Entry
          await tx.ledgerEntry.create({
            data: {
              accountId: account.id,
              debit: Number(line.debit) || 0,
              credit: Number(line.credit) || 0,
              reference: je.jeNumber,
              description: line.description || reference || 'Journal Entry',
              postingDate: new Date(date || new Date()),
            }
          });
        }

        return je;
      });

      await logAudit(req.user.id, 'Post Journal', 'Journal Entries', null, { jeNumber, reference, total: totalDebit }, req.headers['x-forwarded-for'] as string, req.headers['user-agent']);

      return res.status(201).json({ status: 201, data: result });
    } catch (err: any) {
      return res.status(400).json({ error: { message: err.message, status: 400 } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed', status: 405 } });
});
