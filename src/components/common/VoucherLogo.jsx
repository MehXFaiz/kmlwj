import React from 'react';
import logoImg from '../../assets/logo.png';

/**
 * Standardized Shared Voucher Logo Component
 * 
 * Rules:
 * 1. Background = 100% Transparent (no background box, border, or colored square).
 * 2. High Quality, sharp rendering for print & screen.
 * 3. Proportions & aspect ratio strictly preserved.
 * 4. Hall Booking vouchers can explicitly pass `isHallBooking={true}` to retain its legacy style if needed,
 *    while all other ERP vouchers render the clean transparent background logo artwork.
 */
export const VoucherLogo = ({ className = 'h-16 w-16', style = {}, isHallBooking = false }) => {
  if (isHallBooking) {
    return (
      <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center p-0.5 border border-emerald-700/30 rounded-lg bg-white">
        <img src={logoImg} alt="KMLWJ Logo" className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div className={`shrink-0 flex items-center justify-center bg-transparent border-0 shadow-none p-0 ${className}`} style={style}>
      <img
        src={logoImg}
        alt="KMLWJ Logo"
        className="w-full h-full object-contain bg-transparent border-0 drop-shadow-none"
        style={{
          background: 'transparent',
          backgroundColor: 'transparent',
          border: 'none',
          boxShadow: 'none',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}
      />
    </div>
  );
};

export default VoucherLogo;
