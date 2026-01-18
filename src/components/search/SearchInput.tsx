// Copyright (C) 2025–2026 Robin L. M. Cheung, MBA
// All rights reserved.
// Unauthorized use without prior written consent is strictly prohibited.

// EnZIM - Offline ZIM Reader & Knowledge Explorer
// Copyright (C) 2025 Robin L. M. Cheung, MBA. All rights reserved.

import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  isLoading?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

export function SearchInput({
  value: controlledValue,
  onChange,
  onSearch,
  placeholder = 'Search...',
  isLoading = false,
  autoFocus = false,
  compact = false,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const handleClear = () => {
    if (controlledValue === undefined) {
      setInternalValue('');
    }
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onSearch?.(value.trim());
    }
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-secondary animate-spin`} />
        ) : (
          <Search className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-secondary`} />
        )}
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`
          w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg
          focus:outline-none focus:border-[var(--accent)] transition-colors
          ${compact ? 'pl-9 pr-8 py-1.5 text-sm' : 'pl-11 pr-10 py-2.5'}
        `}
      />
      
      {value && (
        <button
          onClick={handleClear}
          className={`
            absolute top-1/2 -translate-y-1/2 p-1 rounded
            hover:bg-black/5 dark:hover:bg-white/5 transition-colors
            ${compact ? 'right-2' : 'right-3'}
          `}
        >
          <X className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-secondary`} />
        </button>
      )}
    </div>
  );
}
