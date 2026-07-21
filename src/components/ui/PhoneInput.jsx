import { forwardRef, useState, useEffect } from 'react';
import { Input } from './Input';

// Utility function to format phone number
export const formatPhoneNumber = (value) => {
  if (!value) return '';
  // Remove all non-numeric characters
  const numeric = value.replace(/[^0-9]/g, '');
  // Apply formatting: 03XX-XXXXXXX
  let formatted = numeric;
  if (numeric.length > 4) {
    formatted = `${numeric.slice(0, 4)}-${numeric.slice(4, 11)}`;
  }
  return formatted;
};

// Utility function to get raw numeric value
export const getRawPhoneNumber = (value) => {
  if (!value) return '';
  return value.replace(/[^0-9]/g, '');
};

// Utility function to validate phone number
export const validatePhoneNumber = (value) => {
  const raw = getRawPhoneNumber(value);
  return raw.length === 11;
};

export const PhoneInput = forwardRef(({ value, onChange, className, ...props }, ref) => {
  const [displayValue, setDisplayValue] = useState('');

  // Initialize display value when external value changes
  useEffect(() => {
    if (value) {
      setDisplayValue(formatPhoneNumber(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    const formatted = formatPhoneNumber(newValue);
    setDisplayValue(formatted);
    // Call onChange with both formatted and raw value, but raw value as the main value
    if (onChange) {
      // Create a synthetic event-like object with the raw numeric value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: getRawPhoneNumber(formatted),
        },
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <Input
      ref={ref}
      {...props}
      type="text"
      validationType="numeric"
      maxLength={11}
      placeholder="03XX-XXXXXXX"
      value={displayValue}
      onChange={handleChange}
      className={`font-mono ${className || ''}`}
    />
  );
});

PhoneInput.displayName = 'PhoneInput';
