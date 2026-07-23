import { faNum } from "../utils/format";

interface Props {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

// کنترل تعداد: دکمه «افزودن» و بعد +/−
export default function QtyControl({ value, onChange, disabled }: Props) {
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled}
        className="rounded-full bg-saffron px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-saffron-dark disabled:opacity-40 disabled:cursor-not-allowed"
      >
        افزودن
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-saffron bg-white px-1.5 py-1">
      <button
        type="button"
        aria-label="افزایش"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="h-7 w-7 rounded-full bg-saffron text-lg font-bold leading-none text-white disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold">
        {faNum(value)}
      </span>
      <button
        type="button"
        aria-label="کاهش"
        onClick={() => onChange(value - 1)}
        disabled={disabled}
        className="h-7 w-7 rounded-full border border-saffron/40 bg-cream text-lg font-bold leading-none text-ink disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>
    </div>
  );
}
