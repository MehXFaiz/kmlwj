import { forwardRef, useState, useEffect } from 'react';
import { Input } from './Input';

// Utility function to format CNIC
export const formatCNIC = (value) => {
  if (!value) return '';
  // Remove all non-numeric characters
  const numeric = value.replace(/[^0-9]/g, '');
  // Apply formatting: XXXXX-XXXXXXX-X
  let formatted = numeric;
  if (numeric.length > 5) {
    formatted = `${numeric.slice(0, 5)}-${numeric.slice(5, 12)}`;
  }
  if (numeric.length > 12) {
    formatted = `${numeric.slice(0, 5)}-${numeric.slice(5, 12)}-${numeric.slice(12, 13)}`;
  }
  return formatted;
};

// Utility function to get raw numeric value
export const getRawCNIC = (value) => {
  if (!value) return '';
  return value.replace(/[^0-9]/g, '');
};

// Utility function to validate CNIC
export const validateCNIC = (value) => {
  const raw = getRawCNIC(value);
  return raw.length === 13;
};

export const CNICInput = forwardRef(({ value, onChange, className, ...props }, ref) => {
  const [displayValue, setDisplayValue] = useState('');

  // Initialize display value when external value changes
  useEffect(() => {
    if (value) {
      setDisplayValue(formatCNIC(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    const formatted = formatCNIC(newValue);
    setDisplayValue(formatted);
    // Call onChange with raw numeric value
    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: getRawCNIC(formatted),
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
      placeholder="XXXXX-XXXXXXX-X"
      value={displayValue}
      onChange={handleChange}
      className={`font-mono ${className || ''}`}
    />
  );
});

CNICInput.displayName = 'CNICInput';
