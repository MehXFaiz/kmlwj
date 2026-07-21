import type { Request, Response } from 'express';
import { prisma } from '../_prisma.js';

/**
 * PUBLIC endpoint — no JWT required.
 * Returns only safe, non-sensitive zakat card fields for QR code verification.
 *
 * Called from: GET /api/v1/zakat-card/verify/:cardNumber
 */
export async function zakatCardVerifyHandler(req: Request, res: Response) {
  const { cardNumber } = req.params;

  if (!cardNumber || cardNumber.trim().length < 2) {
    return res.status(400).json({
      verified: false,
      error: 'Invalid verification code',
    });
  }

  try {
    const card = await prisma.zakatCard.findUnique({
      where: { cardNumber },
      select: {
        cardNumber:  true,
        zakatAmount: true,
        issueDate:   true,
        createdAt:   true,
        member: {
          select: {
            memberNo:   true,
            fullName:   true,
            fatherName: true,
            cnic:       true,
            ghamName:   true,
            area:       true,
            city:       true,
            isActive:   true,
          },
        },
        beneficiary: {
          select: {
            name:    true,
            cnic:    true,
            area:    true,
            town:    true,
            gham:    true,
            isActive: true,
          },
        },
      },
    });

    if (!card) {
      return res.status(404).json({
        verified: false,
        status: 'NOT_FOUND',
        error: 'No zakat card found with this code. This card may not belong to our organization.',
      });
    }

    const person = card.beneficiary || card.member;
    const isActive = person?.isActive !== false;

    /* ── Mask CNIC: show only last 4 digits — e.g. *****-*****-4321 ── */
    const rawCnic = (card.beneficiary?.cnic || card.member?.cnic || '') as string;
    const maskedCnic = rawCnic.length >= 4
      ? rawCnic.slice(0, -4).replace(/[0-9]/g, '*') + rawCnic.slice(-4)
      : rawCnic ? '***masked***' : null;

    const displayName = card.beneficiary?.name || card.member?.fullName || 'Unknown';

    return res.status(200).json({
      verified: true,
      status: isActive ? 'VALID' : 'REVOKED',
      verifiedAt: new Date().toISOString(),
      card: {
        cardNumber:  card.cardNumber,
        zakatAmount: card.zakatAmount,
        issueDate:   card.issueDate,
        holderName:  displayName,
        fatherName:  card.member?.fatherName || null,
        cnic:        maskedCnic,
        area:        card.beneficiary?.area || card.member?.area || null,
        gham:        card.beneficiary?.gham || card.member?.ghamName || null,
        city:        card.member?.city || null,
        memberNo:    card.member?.memberNo || null,
      },
    });
  } catch (err) {
    console.error('[ZakatCardVerify] Error:', err);
    return res.status(500).json({
      verified: false,
      error: 'Verification service temporarily unavailable. Please try again.',
    });
  }
}
