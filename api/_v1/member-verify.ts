import type { Request, Response } from 'express';
import { prisma } from '../_prisma.js';

/**
 * PUBLIC endpoint — no JWT required.
 * Returns only safe, non-sensitive member fields for QR code verification.
 *
 * Lookup priority:
 *   1. memberNo  (preferred — what we embed in QR)
 *   2. id (UUID fallback)
 *
 * Called from: GET /api/v1/member/verify/:id
 */
export async function memberVerifyHandler(req: Request, res: Response) {
  const { id } = req.params;

  if (!id || id.trim().length < 2) {
    return res.status(400).json({
      verified: false,
      error: 'Invalid verification code'
    });
  }

  try {
    // SQA fix: this endpoint is public and unauthenticated — it must never
    // return identity-verification-grade PII (date of birth, father's name,
    // area/city/address) even though CNIC is masked. Anyone with the QR code
    // or URL can call this, so only card-authenticity fields are selected.
    // NEVER expose: id, mobile, email, education, profession, company,
    // password, dob, fatherName, area, city, address, etc.

    // Try memberNo first (what QR embeds), then UUID id
    let member = await prisma.member.findUnique({
      where: { memberNo: id },
      select: {
        memberNo:   true,
        fullName:   true,
        cnic:       true,
        ghamName:   true,
        doi:        true,
        photoUrl:   true,
        isActive:   true,
      }
    });

    // ID lookup fallback (MongoDB ObjectId or UUID)
    if (!member) {
      const idPattern = /^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      if (idPattern.test(id)) {
        member = await prisma.member.findUnique({
          where: { id },
          select: {
            memberNo:   true,
            fullName:   true,
            cnic:       true,
            ghamName:   true,
            doi:        true,
            photoUrl:   true,
            isActive:   true,
          }
        });
      }
    }

    if (!member) {
      return res.status(404).json({
        verified: false,
        status: 'NOT_FOUND',
        error: 'No member found with this QR code. This card may not belong to our organization.'
      });
    }

    // Mask CNIC: show only last 4 digits — e.g. *****-*****-4321
    const rawCnic = member.cnic || '';
    const maskedCnic = rawCnic.length >= 4
      ? rawCnic.slice(0, -4).replace(/[0-9]/g, '*') + rawCnic.slice(-4)
      : rawCnic ? '***masked***' : null;

    return res.status(200).json({
      verified: true,
      status: member.isActive ? 'ACTIVE' : 'INACTIVE',
      verifiedAt: new Date().toISOString(),
      member: {
        memberNo:     member.memberNo,
        fullName:     member.fullName,
        cnic:         maskedCnic,
        ghamName:     member.ghamName || null,
        doi:          member.doi || null,
        photoUrl:     member.photoUrl || null,
        isActive:     member.isActive,
      }
    });

  } catch (err) {
    console.error('[MemberVerify] Error:', err);
    return res.status(500).json({
      verified: false,
      error: 'Verification service temporarily unavailable. Please try again.'
    });
  }
}
