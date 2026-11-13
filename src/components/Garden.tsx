"use client";

import { useEffect, useRef, useState } from "react";

export type GardenPet = { id: string; name: string; img: string; slot: number; neck?: number };

type Scene = {
  key: string;
  label: string;
  src: string;
  ratio: number; // rộng / cao của ảnh nền
  // Vùng đất đi lại được: hình thang theo phối cảnh (toạ độ 0..1 theo khung).
  top: number;
  bottom: number;
  center: number;
  topHalf: number;
  bottomHalf: number;
  petSize: number; // bề rộng con giáp ở hàng gần nhất, tính theo % bề rộng khung
  maxWidth?: number;
};

const SCENES: Scene[] = [
  { key: "sky", label: "Vườn kính", src: "/garden/sky-garden.webp", ratio: 740 / 493, top: 0.74, bottom: 0.97, center: 0.47, topHalf: 0.1, bottomHalf: 0.4, petSize: 10.5 },
  { key: "sakura", label: "Đường hoa anh đào", src: "/garden/sakura.webp", ratio: 720 / 1052, top: 0.68, bottom: 0.97, center: 0.5, topHalf: 0.07, bottomHalf: 0.4, petSize: 19, maxWidth: 560 },
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Chuẩn hoá về vùng đất: v = 0 (xa nhất) .. 1 (gần nhất), u = -1 (trái) .. 1 (phải). */
function toScreen(sc: Scene, u: number, v: number) {
  const y = sc.top + (sc.bottom - sc.top) * v;
  const half = sc.topHalf + (sc.bottomHalf - sc.topHalf) * v;
  return { x: sc.center + u * half, y, scale: 0.55 + 0.45 * v };
}

/** Chỗ ở (nhà) của 12 ô trong sân: 3 hàng × 4 cột trên vùng đất. */
function home(slot: number) {
  const row = Math.floor(slot / 4);
  const col = slot % 4;
  return { u: -0.75 + col * 0.5, v: 0.2 + row * 0.35 };
}

type Pos = { u: number; v: number; flip: boolean; walking: boolean; dur: number; bubble?: boolean; happy?: boolean; sleep?: boolean };

export function Garden({ pets, mood }: { pets: GardenPet[]; mood: "ok" | "hungry" | "critical" }) {
  const [sceneKey, setSceneKey] = useState("sky");
  const sc = SCENES.find((s) => s.key === sceneKey) ?? SCENES[0];
  const [pos, setPos] = useState<Record<string, Pos>>(() =>
    Object.fromEntries(pets.map((p) => [p.id, { ...home(p.slot), flip: false, walking: false, dur: 0 }])),
  );
  const posRef = useRef(pos);
  posRef.current = pos;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const reduced = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("garden-scene");
      if (saved && SCENES.some((s) => s.key === saved)) setSceneKey(saved);
    } catch {}
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }, []);

  useEffect(() => {
    const speed = mood === "ok" ? 1 : mood === "hungry" ? 0.6 : 0.35; // con giáp đói đi chậm hơn
    const ids = new Set(pets.map((p) => p.id));
    setPos((old) => {
      const next: Record<string, Pos> = {};
      for (const p of pets) next[p.id] = old[p.id] ?? { ...home(p.slot), flip: false, walking: false, dur: 0 };
      return next;
    });

    function step(p: GardenPet) {
      const h = home(p.slot);
      // Đi loanh quanh chỗ ở của mình, thỉnh thoảng đi xa hơn.
      const far = Math.random() < 0.25;
      const r = far ? 0.9 : 0.35;
      const u = clamp(h.u + rand(-r, r), -0.95, 0.95);
      const v = clamp(h.v + rand(-r, r) * 0.6, 0, 1);
      const cur = posRef.current[p.id];
      if (!cur) return;
      const a = toScreen(sc, cur.u, cur.v);
      const b = toScreen(sc, u, v);
      const dist = Math.hypot((b.x - a.x) * sc.ratio, b.y - a.y);
      const dur = clamp((dist / (0.12 * speed)) * 1000, 600, 9000);
      setPos((old) => (old[p.id] ? { ...old, [p.id]: { ...old[p.id], u, v, flip: b.x < a.x, walking: true, dur } } : old));
      clearTimeout(timers.current[p.id]);
      timers.current[p.id] = setTimeout(() => {
        // Thỉnh thoảng ngủ gật một lúc rồi mới đi tiếp.
        const sleep = Math.random() < (mood === "ok" ? 0.15 : 0.35);
        setPos((o) => (o[p.id] ? { ...o, [p.id]: { ...o[p.id], walking: false, sleep } } : o));
        timers.current[p.id] = setTimeout(() => {
          setPos((o) => (o[p.id] ? { ...o, [p.id]: { ...o[p.id], sleep: false } } : o));
          step(p);
        }, (sleep ? rand(6000, 12000) : rand(1500, 5000)) / speed);
      }, dur);
    }

    if (!reduced.current) {
      for (const p of pets) timers.current[p.id] = setTimeout(() => step(p), rand(300, 2500));
    }
    const t = timers.current;
    return () => {
      for (const k of Object.keys(t)) {
        clearTimeout(t[k]);
        if (!ids.has(k)) delete t[k];
      }
    };
  }, [pets, mood, sc]);

  function choose(key: string) {
    setSceneKey(key);
    try { localStorage.setItem("garden-scene", key); } catch {}
  }

  function poke(id: string) {
    setPos((o) => (o[id] ? { ...o, [id]: { ...o[id], bubble: true, happy: true, sleep: false } } : o));
    setTimeout(() => setPos((o) => (o[id] ? { ...o, [id]: { ...o[id], happy: false } } : o)), 1300);
    setTimeout(() => setPos((o) => (o[id] ? { ...o, [id]: { ...o[id], bubble: false } } : o)), 1800);
  }

  return (
    <div>
      <div className="garden-tabs">
        {SCENES.map((s) => (
          <button key={s.key} type="button" className={`chip ${s.key === sc.key ? "on" : ""}`} onClick={() => choose(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="garden" style={{ aspectRatio: String(sc.ratio), maxWidth: sc.maxWidth, backgroundImage: `url(${sc.src})` }}>
        {pets.length === 0 && <div className="garden-empty">Sân đang trống</div>}
        {pets.map((p) => {
          const st = pos[p.id] ?? { ...home(p.slot), flip: false, walking: false, dur: 0 };
          const s = toScreen(sc, st.u, st.v);
          return (
            <button
              key={p.id}
              type="button"
              className={`critter ${st.walking ? "walking" : ""} ${st.happy ? "happy" : ""} ${st.sleep && !st.walking ? "sleeping" : ""} ${mood !== "ok" ? `mood-${mood}` : ""}`}
              onClick={() => poke(p.id)}
              title={p.name}
              style={{
                left: `${s.x * 100}%`,
                top: `${s.y * 100}%`,
                width: `${sc.petSize * s.scale}%`,
                zIndex: Math.round(s.y * 1000),
                transitionDuration: `${st.dur}ms`,
              }}
            >
              {st.bubble && <span className="bubble">{p.name}</span>}
              {st.happy && <span className="hearts" aria-hidden>💕</span>}
              {st.sleep && !st.walking && <span className="zzz" aria-hidden>💤</span>}
              <span className="critter-shadow" />
              {/* Kiểu chibi: tách ảnh thành 2 lớp (thân / đầu), phóng to đầu và cho đầu, thân cử động lệch nhịp nhau. */}
              <span className="critter-body" style={{ transform: st.flip ? "scaleX(-1)" : undefined, ["--neck" as string]: `${(p.neck ?? 0.55) * 100}%` }}>
                <span className="rig">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="part-body" src={p.img} alt="" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="part-head" src={p.img} alt={p.name} draggable={false} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
