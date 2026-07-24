import { faNum } from "../utils/format";

interface Props {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

// کنترل تعداد: دکمه «افزودن» و بعد +/−
export default function QtyControl({ value, onChange, disabled, compact }: Props) {
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={disabled}
        className={`gradient-saffron text-white font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-warm ${
          compact
            ? "rounded-lg px-3 py-1 text-[11px]"
            : "rounded-full px-4 py-1.5 text-sm"
        }`}
      >
        افزودن
      </button>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 rounded-lg border border-saffron/30 bg-white px-1 py-0.5 shadow-soft">
        <button
          type="button"
          aria-label="افزایش"
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          className="flex h-6 w-6 items-center justify-center rounded-md gradient-saffron text-xs font-bold text-white transition-all active:scale-90 disabled:opacity-40"
        >
          +
        </button>
        <span className="min-w-[1.2rem] text-center text-xs font-bold text-ink">
          {faNum(value)}
        </span>
        <button
          type="button"
          aria-label="کاهش"
          onClick={() => onChange(value - 1)}
          disabled={disabled}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-saffron/20 bg-cream text-xs font-bold text-ink transition-all active:scale-90 hover:bg-berry-light hover:text-berry disabled:opacity-40"
        >
          −
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-saffron/30 bg-white px-2 py-1 shadow-soft">
      <button
        type="button"
        aria-label="افزایش"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full gradient-saffron text-base font-bold text-white transition-all active:scale-90 disabled:opacity-40"
      >
        +
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-bold text-ink">
        {faNum(value)}
      </span>
      <button
        type="button"
        aria-label="کاهش"
        onClick={() => onChange(value - 1)}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-saffron/20 bg-cream text-base font-bold text-ink transition-all active:scale-90 hover:bg-berry-light hover:text-berry disabled:opacity-40"
      >
        −
      </button>
    </div>
  );
}
