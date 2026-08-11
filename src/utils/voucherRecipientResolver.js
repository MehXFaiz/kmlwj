/**
 * Centralized Recipient Details Resolver for Accounting Vouchers
 * 
 * Safely extracts recipient/person details (Name, Father/Husband, CNIC, Phone/Mobile, Gham, Address)
 * across all voucher types and database relations without modifying financial or accounting data.
 */

const GENERIC_NAME_PATTERNS = [
  'recipient / bank account',
  'recipient/bank account',
  'bank account',
  'cash in hand',
  'cash account',
  'unknown',
  'recipient',
  'payee',
  'cash'
];

/**
 * Formats a 13-digit raw CNIC string into standard 00000-0000000-0 format
 */
export function formatCNIC(raw) {
  if (!raw) return '-';
  const str = String(raw).trim();
  if (str === '-' || str.toLowerCase() === 'n/a') return '-';
  const clean = str.replace(/\D/g, '');
  if (clean.length === 13) {
    return `${clean.slice(0, 5)}-${clean.slice(5, 12)}-${clean.slice(12)}`;
  }
  return str || '-';
}

/**
 * Parses embedded bio text from description/reference strings
 * e.g. "Paid To: Arshad | Father: Ibrahim | CNIC: 4240172427381 | Ph: 03032567909"
 */
export function parseEmbeddedBio(text) {
  if (!text || typeof text !== 'string') return {};

  const details = {};

  // Pattern: "Paid To: <val>"
  const paidToMatch = text.match(/Paid\s+To:\s*([^|]+)/i);
  if (paidToMatch) details.name = paidToMatch[1].trim();

  // Pattern: "Father: <val>"
  const fatherMatch = text.match(/Father:\s*([^|]+)/i);
  if (fatherMatch) details.fatherName = fatherMatch[1].trim();

  // Pattern: "Husband: <val>"
  const husbandMatch = text.match(/Husband:\s*([^|]+)/i);
  if (husbandMatch) details.husbandName = husbandMatch[1].trim();

  // Pattern: "CNIC: <val>"
  const cnicMatch = text.match(/CNIC:\s*([^|]+)/i);
  if (cnicMatch) details.cnic = cnicMatch[1].trim();

  // Pattern: "Ph: <val>" or "Mobile: <val>" or "Phone: <val>"
  const phoneMatch = text.match(/(?:Ph|Mobile|Phone):\s*([^|]+)/i);
  if (phoneMatch) details.mobile = phoneMatch[1].trim();

  // Pattern: "Gham: <val>"
  const ghamMatch = text.match(/Gham:\s*([^|]+)/i);
  if (ghamMatch) details.gham = ghamMatch[1].trim();

  // Pattern: "Address: <val>"
  const addressMatch = text.match(/Address:\s*([^|]+)/i);
  if (addressMatch) details.address = addressMatch[1].trim();

  // Pattern: "Receipt from <Name> (<CNIC>)" e.g. "Membership Fee Receipt from Test m (4240155512158)"
  const receiptFromMatch = text.match(/Receipt\s+from\s+([^(|]+)(?:\s*\(([^)]+)\))?/i);
  if (receiptFromMatch) {
    if (!details.name) details.name = receiptFromMatch[1].trim();
    if (!details.cnic && receiptFromMatch[2]) details.cnic = receiptFromMatch[2].trim();
  }

  return details;
}

/**
 * Central resolver function for voucher recipient details
 */
export function resolveVoucherRecipientDetails(voucher) {
  if (!voucher || typeof voucher !== 'object') {
    return {
      name: '-',
      fatherName: '-',
      cnic: '-',
      mobile: '-',
      gham: '-',
      address: '-'
    };
  }

  // 1. Direct Linked Relations (Beneficiary, Member, Donor, Customer, etc.)
  const beneficiary = voucher.beneficiary || voucher.zakatCard?.beneficiary || null;
  const member = voucher.member || voucher.zakatCard?.member || null;
  const donor = voucher.donor || voucher.donationReceived?.donor || null;
  const customer = voucher.customer || null;
  const revenueCol = voucher.revenueCollection || null;

  // 2. Embedded bio text parsing across all text fields
  const combinedText = [
    voucher.description,
    voucher.reference,
    voucher.narration,
    voucher.remarks,
    ...(voucher.lines || []).map(l => l.description)
  ].filter(Boolean).join(' | ');

  const textBio = parseEmbeddedBio(combinedText);

  // 3. Resolve Name / Paid To
  let name = 
    beneficiary?.name ||
    member?.fullName || member?.name ||
    donor?.fullName || donor?.name ||
    customer?.name ||
    revenueCol?.title ||
    voucher.paidTo || voucher.payee || voucher.payeeName || voucher.donorName || voucher.bookerName || voucher.title || voucher.name ||
    textBio.name ||
    '';

  // Sanitize generic fallback strings
  if (name && GENERIC_NAME_PATTERNS.includes(name.trim().toLowerCase())) {
    name = textBio.name || '';
  }

  // 4. Resolve Father / Husband Name
  let fatherName =
    beneficiary?.fatherName || beneficiary?.husbandName ||
    member?.fatherName ||
    donor?.fatherName ||
    voucher.fatherName || voucher.payeeFatherName ||
    textBio.fatherName || textBio.husbandName ||
    '';

  // 5. Resolve CNIC
  let cnic =
    beneficiary?.cnic ||
    member?.cnic ||
    donor?.cnic ||
    (revenueCol?.subTitle && /^\d{13}$|^\d{5}-\d{7}-\d{1}$/.test(revenueCol.subTitle.trim()) ? revenueCol.subTitle : null) ||
    voucher.cnic || voucher.payeeCnic || voucher.cnicNo || voucher.nic ||
    textBio.cnic ||
    '';

  // 6. Resolve Phone / Mobile
  let mobile =
    beneficiary?.mobile ||
    member?.mobile ||
    donor?.mobile ||
    customer?.phone ||
    revenueCol?.mobile ||
    voucher.mobile || voucher.phone || voucher.payeeMobile || voucher.donorMobile ||
    textBio.mobile ||
    '';

  // 7. Resolve Gham Details
  let gham =
    beneficiary?.gham || beneficiary?.fatherGham || beneficiary?.husbandGham ||
    member?.ghamName || member?.gham ||
    voucher.gham || voucher.payeeGham || voucher.ghamName ||
    textBio.gham ||
    '';

  // 8. Resolve Address / Location
  let address =
    beneficiary?.address ||
    member?.address ||
    donor?.address ||
    customer?.address ||
    voucher.address || voucher.payeeAddress ||
    textBio.address ||
    '';

  return {
    name: name?.trim() || '-',
    fatherName: fatherName?.trim() || '-',
    cnic: formatCNIC(cnic),
    mobile: mobile?.trim() || '-',
    gham: gham?.trim() || '-',
    address: address?.trim() || '-'
  };
}

export default resolveVoucherRecipientDetails;
