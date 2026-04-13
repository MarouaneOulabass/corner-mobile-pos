'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

interface PriceInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

function formatDisplay(val: number): string {
  return val.toLocaleString('fr-FR').replace(/\u202F/g, ' ');
}

export function PriceInput({
  value,
  onChange,
  className,
  placeholder = '0',
  disabled = false,
  id,
  name,
}: PriceInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() =>
    value !== '' ? formatDisplay(value) : ''
  );

  // Sync display when value changes externally
  React.useEffect(() => {
    if (value === '') {
      setDisplayValue('');
    } else {
      setDisplayValue(formatDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setDisplayValue('');
      onChange('');
      return;
    }
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      setDisplayValue(formatDisplay(num));
      onChange(num);
    }
  };

  const handleFocus = () => {
    // Show raw number for easier editing
    if (value !== '') {
      setDisplayValue(String(value));
    }
  };

  const handleBlur = () => {
    if (value !== '') {
      setDisplayValue(formatDisplay(value));
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full rounded-lg border border-gray-300 bg-white pl-3 pr-14 py-2 text-sm',
          'placeholder:text-gray-400',
          'focus:outline-none focus:ring-2 focus:ring-corner-blue focus:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
          className
        )}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
        MAD
      </span>
    </div>
  );
}
