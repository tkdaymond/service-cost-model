import { useEffect, useState } from 'react';

/**
 * Numeric text input that tolerates partial typing ("1.", "-") and only reports parsed numbers.
 * With `percent`, the stored fraction 0.15 is shown and edited as 15.
 */
export function NumberInput({
  value,
  onChange,
  percent = false,
  min,
  max,
  step,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  percent?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const shown = percent ? round(value * 100) : value;
  const [text, setText] = useState(String(shown));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(shown));
  }, [shown, focused]);

  return (
    <div className="input-wrap">
      <input
        className="input"
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step ?? 'any'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(percent ? round(n / 100, 10) : n);
        }}
      />
      {(suffix ?? (percent ? '%' : undefined)) && <span className="input-suffix">{suffix ?? '%'}</span>}
    </div>
  );
}

/** Rounds away binary noise such as 0.15 * 100 = 15.000000000000002. */
function round(n: number, digits = 8): number {
  return Number(n.toFixed(digits));
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="label">
      <span>{children}</span>
      {hint && <span className="label__hint">{hint}</span>}
    </div>
  );
}
