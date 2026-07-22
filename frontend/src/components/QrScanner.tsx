import { Html5Qrcode } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (text: string) => void;
}

// اسکنر QR با وب‌کم لپ‌تاپ (کتابخانه html5-qrcode)
// نکته: مرورگر فقط روی localhost یا HTTPS اجازه دوربین می‌دهد
export default function QrScanner({ onScan }: Props) {
  const [error, setError] = useState<string | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    let active = true;

    scanner
      .start(
        { facingMode: "user" }, // وب‌کم لپ‌تاپ
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          // جلوگیری از شلیک چندباره برای همان کد در چند ثانیه
          const now = Date.now();
          if (
            decodedText === lastScanRef.current.text &&
            now - lastScanRef.current.at < 4000
          )
            return;
          lastScanRef.current = { text: decodedText, at: now };
          onScanRef.current(decodedText.trim());
        },
        undefined,
      )
      .then(() => {
        // اگر کامپوننت قبل از آماده شدن دوربین unmount شد، متوقفش کن
        if (!active) scanner.stop().catch(() => undefined);
      })
      .catch(() => {
        setError(
          "دسترسی به دوربین ممکن نشد — اجازه دوربین را بدهید و صفحه را روی localhost باز کنید، یا کد را دستی وارد کنید.",
        );
      });

    return () => {
      active = false;
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => undefined);
    };
  }, []);

  return (
    <div>
      <div
        id="qr-reader"
        className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl bg-black/5"
      />
      {error && (
        <p className="mt-3 rounded-xl bg-berry-light p-3 text-sm text-berry">
          {error}
        </p>
      )}
    </div>
  );
}
