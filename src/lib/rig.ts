import data from "./rig-data.json";

/** Một lớp bộ phận của con giáp (toạ độ % theo khung nhân vật, điểm xoay % theo chính lớp). */
export type RigLayer = {
  name: string;
  file?: string;
  role: "body" | "head" | "leg" | "tail" | "arm" | "wing";
  phase: "A" | "B";
  z: string;
  x: number; y: number; w: number; h: number; ox: number; oy: number;
};
export type Rig = { ratio: number; layers: RigLayer[] };

const RIGS = data as unknown as Record<string, Rig>;

/** Rig theo mã con giáp (TY, SUU, ...). Tạo lại bằng tools/rig_build.py. */
export function rigFor(code: string): Rig | null {
  return RIGS[code.toLowerCase()] ?? null;
}
