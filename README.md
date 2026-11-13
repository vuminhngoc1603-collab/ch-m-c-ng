# Sân 12 con giáp: chấm công bằng nuôi con giáp

Web chấm công nội bộ: mỗi lần **check in = cho con giáp ăn** (1 xu × hệ số), **check out = đóng cửa sân**.
Quên đóng cửa thì đồng nghiệp được trộm xu, bỏ bữa thì con giáp chết. Đặc tả gốc: *System Requirements Context v1.2*.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 6 · Auth.js v5 (Google) · Vitest.

## Tính năng (MVP)

| Nhóm | Có gì |
|---|---|
| Đăng nhập | Chỉ Google, chỉ web. Lần đầu đăng nhập: chờ admin duyệt. Email trong `ADMIN_EMAILS` tự thành admin. |
| Vai trò | Admin (chỉ quản trị) · Full-time · Part-time |
| Full-time | T2–T6: cho ăn 8h30–9h00 và 13h45–14h00, đóng cửa 17h30–18h00. T7/CN nghỉ. |
| Part-time | Đăng ký ca tuần sau **chỉ trong ngày thứ Sáu**; hết thứ Sáu khoá, chỉ admin đổi hộ (bắt buộc ghi lý do). Chặn 2 ca chồng giờ. T7/CN tuỳ chọn. |
| Xu | 1 xu = 2.000 đ. Hệ số x1, +0,25 mỗi con, con thứ 12 = x4. Sổ cái chỉ ghi thêm. |
| Sân | 12 ô, mỗi con giáp có hình cố định, người dùng tự đổi chỗ. Con đầu miễn phí khi được duyệt. |
| Chết & phạt | Bỏ 3 bữa liên tiếp, hoặc từ bữa thứ 5 trong tháng (mỗi bữa sau chết thêm). Chết 1 con ngẫu nhiên, phạt 300.000 đ trừ lương (không trừ xu). Mất con cuối thì hôm sau được cấp con mới. |
| Trộm xu | Quên đóng cửa → 17h30–24h00 cùng ngày, mỗi lần lấy 10% ví (tối đa 5 xu), tối đa 3 người/lần quên. Có khoá dòng để bấm cùng lúc không vượt 3. |
| Cuối tháng | Biến động = cho ăn + trộm được − bị trộm (+ điều chỉnh admin). Admin xem/tải CSV để tính thưởng. Quy đổi 1 xu = 1 điểm (tháng âm = 0), điểm dồn sang tháng sau. |
| Trứng | Mua bằng điểm: con thứ n giá 20 × (n − 1). Nở ngẫu nhiên, không trùng con đang có. |
| Nghỉ | Lễ chung (admin tạo) + đơn nghỉ phép/nghỉ lễ cá nhân (admin duyệt): không cho ăn, không tính xu, không tính bỏ bữa. |
| Admin | Duyệt/khoá tài khoản, đổi vai trò, duyệt nghỉ, đổi ca hộ, sửa giờ ca, sửa luật (Rules Engine JSON), điều chỉnh xu/điểm có lý do, báo cáo tháng + CSV, chạy quét thủ công. |

Mọi mốc giờ tính theo giờ Việt Nam (UTC+7) và lấy giờ máy chủ.

## Khu vườn có con giáp đi lại

- Ảnh con giáp đã tách nền nằm ở `public/zodiac/<ma>.webp` (ty, suu, dan, mao, thin, ti, ngo, mui, than, dau, tuat, hoi). Ảnh nền ở `public/garden/`.
- `src/components/Garden.tsx`: mỗi con đi loanh quanh **chỗ ở** của mình (ô 1–12 người dùng chọn), thỉnh thoảng đi xa; nhún khi đi, quay mặt theo hướng đi, xa nhỏ gần to, con gần đè lên con xa. Bấm vào con giáp để hiện tên.
- Vùng đất đi lại được khai báo trong mảng `SCENES` (hình thang theo phối cảnh). Thêm ảnh nền mới: thêm 1 phần tử vào mảng và chỉnh `top/bottom/center/topHalf/bottomHalf`.
- Con giáp đói đi chậm và nhạt màu, nguy kịch thì xám. Người bật "giảm chuyển động" trong hệ điều hành sẽ thấy con giáp đứng yên.
- Thay ảnh một con giáp: ghi đè file webp cùng tên (nên tách nền, cao khoảng 360px).

### Con giáp cử động kiểu anime (tách lớp)

Mỗi con được tách thành các lớp **thân, đầu, chân, đuôi, tay, cánh**, nằm trong `public/rig/<mã>/`, kèm `rig.json` ghi vị trí và điểm xoay (cổ, hông, gốc đuôi...). Trong vườn, khi đi thì chân bước luân phiên, đầu gật, đuôi vẫy, tay đánh; bấm vào thì nhảy và lắc đầu; nghỉ thì thở, thỉnh thoảng ngủ gật.

- Sửa vị trí bộ phận: chỉnh đa giác/điểm xoay trong `tools/rigs.py`, chạy `python3 tools/rig_build.py <thư mục ảnh gốc> public/rig`, rồi gộp các `rig.json` vào `src/lib/rig-data.json` (đoạn script ở cuối `tools/rig_build.py`).
- Con Thìn dùng ảnh rồng cầm hoa (`tools/tach-lop-rong.py`); 2 bàn chân là phần vẽ thêm. Ảnh rồng cũ vẫn giữ ở `public/zodiac/thin-cu.webp`.
- Ảnh rồng có chữ ký/con dấu của họa sĩ: cần xin phép tác giả trước khi dùng chính thức.

## Giả định đã chọn (chưa có trong đặc tả)

1. **Quên đóng cửa chỉ tính khi hôm đó có đi làm** (đã cho ăn ít nhất 1 lượt). Không đi làm cả ngày thì không bị mở cửa cho trộm, vì đã bị tính bỏ bữa.
2. **Sân tạm trống (đang chờ cấp lại con)** vẫn được 1 xu mỗi lần cho ăn (hệ số x1).
3. **Bỏ bữa liên tiếp tính xuyên tháng**; bộ đếm về 0 khi cho ăn thành công hoặc khi đạt 3 lần (đã làm chết 1 con).
4. **Trứng khi sân trống** (vừa mất hết con) giá 0 điểm.
5. **Tài khoản được duyệt giữa ngày** chỉ phải cho ăn các lượt còn chưa hết giờ trong ngày đó.
6. Điều chỉnh xu của admin được tính vào biến động tháng (cột riêng trên báo cáo).

Muốn đổi điều nào thì sửa trong `src/server/*` hoặc trong trang **Cấu hình** (các con số).

## Cơ sở dữ liệu

Schema: [`prisma/schema.prisma`](prisma/schema.prisma). Xu lưu dạng số nguyên "phần trăm xu" (1 xu = 100) để không sai số; ngày lưu dạng `YYYY-MM-DD` giờ VN; giờ ca lưu dạng số phút từ 0h.

| Bảng | Vai trò |
|---|---|
| `User`, `Account`, `Session` | Tài khoản Google, vai trò, trạng thái duyệt, bộ đếm bỏ bữa liên tiếp |
| `Shift` | Danh mục ca/nhịp (giờ cho ăn, giờ đóng cửa), admin sửa được |
| `ShiftRegistration` | Ca part-time đã đăng ký theo ngày |
| `Holiday`, `LeaveRequest` | Lễ chung và đơn nghỉ cá nhân |
| `Attendance` | Mỗi lượt bắt buộc: trạng thái cho ăn/đóng cửa, giờ, IP, trình duyệt, xu nhận |
| `CoinLedger` | Sổ cái xu (cho ăn, trộm được, bị trộm, điều chỉnh) |
| `Theft` | Từng vụ trộm, unique (lượt, người trộm) |
| `PointLedger` | Sổ điểm (quy đổi cuối tháng, mua trứng, điều chỉnh) |
| `MonthlySettlement` | Báo cáo chốt tháng cho admin tính thưởng |
| `Pet`, `Penalty` | Con giáp trong sân (ô, sống/chết) và khoản phạt trừ lương |
| `Setting`, `ActivityLog` | Cấu hình luật, nhật ký thao tác |

### Job quét (`runTick`)

`src/server/tick.ts` chạy lại bao nhiêu lần cũng không tạo trùng. Mỗi lần: đồng bộ lượt bắt buộc 7 ngày gần nhất → cấp con đầu/cấp lại → đánh dấu bỏ bữa (tính chết, phạt) → đánh dấu quên đóng cửa → đầu tháng thì chốt tháng trước và cộng điểm.
Được gọi tự động khi có người mở trang (tối đa 1 lần/phút), qua `GET /api/cron` (header `Authorization: Bearer $CRON_SECRET`), và nút "Chạy quét ngay" của admin.

## Chạy trên máy

```bash
cp .env.example .env          # điền DATABASE_URL, AUTH_SECRET, Google OAuth, ADMIN_EMAILS
npm install
npx prisma migrate deploy     # tạo bảng
npm run db:seed               # danh mục ca + luật mặc định
npm run dev                   # http://localhost:3000
```

Kiểm thử (cần một database Postgres trống `chamcong_test`, xem `vitest.config.ts`):

```bash
npm test      # 20 test: hệ số, giá trứng, trộm, chết, đăng ký ca, nghỉ phép, quyết toán, chạy song song
```

## Tạo Google OAuth (đăng nhập Gmail)

1. Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), tạo project nếu chưa có.
2. **OAuth consent screen**: chọn External, điền tên app và email hỗ trợ. Để chế độ Testing thì phải thêm email từng người vào Test users; muốn ai cũng đăng nhập được thì bấm Publish.
3. **Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` và `https://<domain-của-bạn>`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` và `https://<domain-của-bạn>/api/auth/callback/google`
4. Chép Client ID / Secret vào `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Deploy (gợi ý: Vercel + Neon/Supabase, đều có gói miễn phí)

1. Tạo database Postgres trên Neon hoặc Supabase, lấy chuỗi kết nối (pooled → `DATABASE_URL`, direct → `DIRECT_URL`).
2. Import repo vào Vercel, đặt các biến môi trường như `.env.example` (`AUTH_SECRET` tạo bằng `npx auth secret`).
3. Build command: `npx prisma migrate deploy && npm run build`. Sau lần deploy đầu, chạy `npm run db:seed` một lần với `DATABASE_URL` của production.
4. Job quét: `vercel.json` đã có cron hằng ngày lúc 0h (giờ VN) cho gói Hobby. Để ghi nhận bỏ bữa/quên đóng cửa đúng giờ, nên thêm một cron ngoài (vd cron-job.org) gọi `https://<domain>/api/cron?secret=<CRON_SECRET>` mỗi 5 phút.

## Mở rộng sau

Kỹ năng ẩn của 12 con giáp (gồm con tự cho ăn ngày nghỉ lễ) và giao nhiệm vụ: cắm thêm vào Rules Engine (`src/lib/rules.ts`) và dùng chung sổ cái xu.
