import React from 'react';
import { SpecializedRevenueSection } from './SpecializedRevenueSection';

export const ZakatSection = () => (
  <SpecializedRevenueSection
    category="Zakat"
    title="Zakat Collection"
    desc="Manage Zakat contributions, donor records, and automatic general ledger postings"
    titleLabel="Donor Name"
    subTitleLabel="CNIC / ID"
    dateLabel="Collection Date"
  />
);

export const FitraSection = () => (
  <SpecializedRevenueSection
    category="Fitra"
    title="Fitra Collection"
    desc="Manage Eid Fitra collections, head-counts, and automatic general ledger postings"
    titleLabel="Donor Name"
    subTitleLabel={null}
    dateLabel="Collection Date"
    showQty={true}
    qtyLabel="Head Count"
    showRate={true}
    rateLabel="Rate per Head"
  />
);

export const MembershipFeeSection = () => (
  <SpecializedRevenueSection
    category="Membership Fee"
    title="Membership Fees"
    desc="Manage Jamia member fee contributions, annual renewals, and ledger activity"
    titleLabel="Member Name"
    subTitleLabel="Membership ID / CNIC"
    dateLabel="Fee Date"
    showRate={true}
    rateLabel="Fee Rate"
  />
);

export const BusBookingSection = () => (
  <SpecializedRevenueSection
    category="Bus Booking"
    title="Bus Bookings"
    desc="Manage Jamia bus reservations, trip schedules, and general ledger receipts"
    titleLabel="Booker Name"
    subTitleLabel="Bus / Vehicle Number"
    dateLabel="Trip Date"
    showDest={true}
    destLabel="Trip Destination"
  />
);
