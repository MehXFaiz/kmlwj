// Standardized Donation / Aid Type list shared by Donation Received and Donation Given
// (and any reports/filters that reference donation type), so both modules always offer
// the exact same set of options in the exact same order.
export const DONATION_TYPES = [
  { value: 'GENERAL_DONATION', label: 'General Donation' },
  { value: 'ZAKAT', label: 'Zakat' },
  { value: 'FITRA', label: 'Fitra' },
  { value: 'SADQA', label: 'Sadqa' },
  { value: 'QURBANI', label: 'Qurbani' },
  { value: 'HALL_DONATION', label: 'Hall Donation' },
  { value: 'MARRIAGE_DONATION', label: 'Marriage Donation' },
  { value: 'BUILDING_FUND', label: 'Building Fund' },
  { value: 'MEDICAL_DONATION', label: 'Medical Donation' },
  { value: 'EDUCATION_DONATION', label: 'Education Donation' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'MARRIAGE', label: 'Marriage' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'EDUCATION', label: 'Education' },
  { value: 'CUSTOM', label: 'Custom' },
];

export function donationTypeLabel(donationType) {
  const match = DONATION_TYPES.find(t => t.value === donationType);
  return match ? match.label : (donationType || '');
}

// For display in tables/receipts/reports/GL: shows the custom value instead of the
// literal word "Custom" whenever the record's type is CUSTOM.
export function donationTypeDisplay(donationType, customDonationType) {
  if (donationType === 'CUSTOM') return customDonationType || 'Custom';
  return donationTypeLabel(donationType);
}
