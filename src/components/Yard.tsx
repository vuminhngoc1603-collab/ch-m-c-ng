"use client";

import { useState } from "react";
import { movePetAction } from "@/app/actions";

type P = { id: string; img: string; name: string; slot: number };

/** Sân 4×3: bấm một con để chọn, rồi bấm ô khác để chuyển (ô có con thì đổi chỗ). */
export function Yard({ pets, size, mood }: { pets: P[]; size: number; mood: "ok" | "hungry" | "critical" }) {
  const [sel, setSel] = useState<string | null>(null);
  const bySlot = new Map(pets.map((p) => [p.slot, p]));
  return (
    <form action={movePetAction}>
      <input type="hidden" name="petId" value={sel ?? ""} />
      <div className="yard">
        {[...Array(size).keys()].map((i) => {
          const p = bySlot.get(i);
          const isSel = p && p.id === sel;
          const cls = `pen ${p ? "filled" : ""} ${isSel ? "selected" : ""} ${p && mood !== "ok" ? "hungry" : ""}`;
          if (sel && !isSel) {
            return (
              <button key={i} className={cls} type="submit" name="slot" value={i} title="Chuyển tới đây">
                {p ? <span><img className="pet-img" src={p.img} alt="" /><div className="name">{p.name}</div></span> : <span className="small">Đặt ở đây</span>}
              </button>
            );
          }
          return (
            <button key={i} className={cls} type="button" onClick={() => p && setSel(isSel ? null : p.id)} title={p ? "Bấm để chọn rồi chuyển chỗ" : "Chỗ trống"}>
              {p ? <span><img className="pet-img" src={p.img} alt="" /><div className="name">{p.name}</div></span> : <span className="small">Trống</span>}
            </button>
          );
        })}
      </div>
      <p className="muted small" style={{ marginBottom: 0 }}>
        {sel ? "Bấm vào ô muốn chuyển tới (ô có con thì hai con đổi chỗ). Bấm lại con đang chọn để huỷ." : "Mỗi ô là chỗ ở của con giáp trong vườn: con giáp đi loanh quanh chỗ ở của mình. Bấm vào một con để đổi chỗ."}
      </p>
    </form>
  );
}
