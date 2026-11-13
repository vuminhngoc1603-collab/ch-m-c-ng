"use client";

import { useEffect, useRef, useState } from "react";

/** Nút "?" mở bảng hướng dẫn cách chơi. Tự mở lần đầu nếu `autoOpenKey` chưa được đánh dấu đã xem. */
export function HelpButton({ children, autoOpenKey }: { children: React.ReactNode; autoOpenKey?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!autoOpenKey) return;
    try {
      if (!localStorage.getItem(autoOpenKey)) {
        setOpen(true);
        localStorage.setItem(autoOpenKey, "1");
      }
    } catch { /* trình duyệt chặn lưu trữ: bỏ qua */ }
  }, [autoOpenKey]);

  return (
    <>
      <button type="button" className="help-btn" aria-label="Hướng dẫn cách chơi" title="Hướng dẫn cách chơi" onClick={() => setOpen(true)}>?</button>
      <dialog
        ref={ref}
        className="help-dialog"
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      >
        <div className="help-head">
          <h2>Hướng dẫn cách chơi</h2>
          <button type="button" className="btn" onClick={() => setOpen(false)} aria-label="Đóng">Đóng</button>
        </div>
        <div className="help-body">{children}</div>
      </dialog>
    </>
  );
}
