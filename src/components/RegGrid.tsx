import type { Shift } from "@prisma/client";
import { fmtDay, fmtMin } from "@/lib/time";

/** Bảng chọn ca theo tuần: mỗi ô là một checkbox name="reg" value="day|shiftId". */
export function RegGrid({ days, shifts, selected, disabled }: { days: string[]; shifts: Shift[]; selected: Set<string>; disabled?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="reg-table">
        <thead>
          <tr>
            <th>Ngày</th>
            {shifts.map((s) => (
              <th key={s.id}>{s.name}<div className="muted small">{fmtMin(s.feedStart)}–{fmtMin(s.closeEnd ?? s.feedEnd)}</div></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d}>
              <td>{fmtDay(d)}</td>
              {shifts.map((s) => {
                const key = `${d}|${s.id}`;
                return (
                  <td key={s.id}>
                    <input type="checkbox" name="reg" value={key} defaultChecked={selected.has(key)} disabled={disabled} aria-label={`${d} ${s.name}`} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
