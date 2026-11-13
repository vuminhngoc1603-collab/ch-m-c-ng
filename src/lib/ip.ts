// So khớp IP với danh sách mạng được phép. Hỗ trợ IPv4, IPv6, IP đơn lẻ hoặc dải CIDR.

function v4ToBig(ip: string): bigint | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0n;
  for (const s of p) {
    if (!/^\d{1,3}$/.test(s)) return null;
    const v = Number(s);
    if (v > 255) return null;
    n = (n << 8n) | BigInt(v);
  }
  return n;
}

function v6ToBig(ip: string): bigint | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // IPv4 ở đuôi (vd ::ffff:1.2.3.4)
  const m = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (m) {
    const v4 = v4ToBig(m[2]);
    if (v4 == null) return null;
    s = `${m[1]}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill("0"), ...tail];
  let n = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    n = (n << 16n) | BigInt(parseInt(g, 16));
  }
  return n;
}

type Parsed = { v: 4 | 6; n: bigint };

export function parseIp(ip: string): Parsed | null {
  const s = ip.trim();
  if (!s) return null;
  const v4 = v4ToBig(s);
  if (v4 != null) return { v: 4, n: v4 };
  const v6 = v6ToBig(s);
  if (v6 == null) return null;
  // ::ffff:a.b.c.d là IPv4 bọc trong IPv6: coi như IPv4
  if (v6 >> 32n === 0xffffn) return { v: 4, n: v6 & 0xffffffffn };
  return { v: 6, n: v6 };
}

/** Kiểm tra chuỗi "IP" hoặc "IP/độ dài" có hợp lệ không; trả về dạng chuẩn hoá hoặc null. */
export function normalizeCidr(input: string): string | null {
  const [addr, lenRaw, extra] = input.trim().split("/");
  if (extra !== undefined) return null;
  const p = parseIp(addr ?? "");
  if (!p) return null;
  const max = p.v === 4 ? 32 : 128;
  if (lenRaw === undefined) return addr.trim();
  if (!/^\d{1,3}$/.test(lenRaw)) return null;
  const len = Number(lenRaw);
  if (len < (p.v === 4 ? 8 : 16) || len > max) return null; // chặn dải quá rộng như /0
  return `${addr.trim()}/${len}`;
}

export function ipInCidr(ip: string | null | undefined, cidr: string): boolean {
  if (!ip) return false;
  const a = parseIp(ip);
  const [base, lenRaw] = cidr.split("/");
  const b = parseIp(base ?? "");
  if (!a || !b || a.v !== b.v) return false;
  const max = a.v === 4 ? 32 : 128;
  const len = lenRaw === undefined ? max : Number(lenRaw);
  if (!Number.isInteger(len) || len < 0 || len > max) return false;
  const shift = BigInt(max - len);
  return a.n >> shift === b.n >> shift;
}
