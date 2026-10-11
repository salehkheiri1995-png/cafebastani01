import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// مودال ساده — کلیک روی پس‌زمینه یا کلید Escape آن را می‌بندد
export default function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-elevated sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl leading-tight">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-2xl leading-none text-ink-faint transition-colors hover:bg-cream-200 hover:text-ink"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
