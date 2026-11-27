# Sân 12 con giáp: chấm công bằng nuôi con giáp

Web chấm công nội bộ: mỗi lần **check in = cho con giáp ăn** (1 xu), **check out = đóng cửa sân**.
Quên đóng cửa thì đồng nghiệp được trộm xu, bỏ bữa thì con giáp chết. Đặc tả gốc: *System Requirements Context v1.2*.

**Stack:** Next.js 15 (App Router, Server Actions) · TypeScript · PostgreSQL · Prisma 6 · Auth.js v5 (Google) · Vitest.

## Tính năng (MVP)

| Nhóm | Có gì |
|---|---|
| Đăng nhập | Chỉ Google, chỉ web. Lần đầu đăng nhập: tự chọn loại công việc (Full-time/Part-time) rồi chờ admin duyệt (ô vai trò khi duyệt điền sẵn lựa chọn này). Email trong `ADMIN_EMAILS` tự thành admin. |
| Vai trò | Admin (chỉ quản trị) · Full-time · Part-time |
| Full-time | T2–T6: cho ăn 8h30–9h00 và 13h45–14h00, đóng cửa 17h30–18h00. T7/CN nghỉ. |
| Part-time | Đăng ký ca tuần sau **chỉ trong ngày thứ Sáu**; hết thứ Sáu khoá, chỉ admin đổi hộ (bắt buộc ghi lý do). Chặn 2 ca chồng giờ. T7/CN tuỳ chọn. |
| Xu | 1 xu = 2.000 đ. Hệ số đang **khoá x1**: mỗi lần cho ăn = 1 xu bất kể số con (`coefLocked`), riêng kỹ năng Thìn vẫn +0,25. Admin bật/tắt ở trang **Cấu hình** (nút Mở hệ số / Khoá hệ số). Mở khoá thì dùng bảng hệ số x1, +0,25 mỗi con, con thứ 12 = x4. Sổ cái chỉ ghi thêm. |
| Sân | 12 ô, mỗi con giáp có hình cố định, người dùng tự đổi chỗ. Con đầu miễn phí khi được duyệt. |
| Chết & phạt | Bỏ 3 bữa liên tiếp, hoặc 5 bữa trong tháng. Sau mỗi lần chết cả 2 bộ đếm về 0, phải bỏ đủ 3 liên tiếp / 5 bữa nữa mới chết tiếp. Chết 1 con ngẫu nhiên, phạt 100.000 đ trừ lương (không trừ xu). Mất con cuối thì hôm sau được cấp con mới. |
| Trộm xu | Quên đóng cửa → 17h30–24h00 cùng ngày, mỗi lần lấy 10% ví (tối đa 5 xu), tối đa 3 người/lần quên. Có khoá dòng để bấm cùng lúc không vượt 3. |
| Cuối tháng | Biến động = cho ăn + trộm được − bị trộm (+ điều chỉnh admin). Admin xem/tải CSV để tính thưởng. Quy đổi 1 xu = 1 điểm (tháng âm = 0), điểm dồn sang tháng sau. |
| Trứng | Mua bằng điểm: con thứ n giá 20 × (n − 1). Nở ngẫu nhiên, không trùng con đang có. |
| Nghỉ | Lễ chung (admin tạo) + đơn nghỉ phép/nghỉ lễ cá nhân (admin duyệt): không cho ăn, không tính xu, không tính bỏ bữa. |
| Admin | Duyệt/khoá tài khoản, đổi vai trò, duyệt nghỉ, đổi ca hộ, sửa giờ ca, sửa luật (Rules Engine JSON), điều chỉnh xu/điểm có lý do, báo cáo tháng + CSV, báo cáo ca làm & ngày nghỉ, chạy quét thủ công. |
| Ca làm & ngày nghỉ | Admin → "Ca & ngày nghỉ": bảng tháng, mỗi người một dòng, mỗi ngày một ô (đi làm / thiếu bữa / vắng / nghỉ phép / lễ / đã xếp lịch), part-time ghi mã ca dưới ô. Chọn 1 người để xem chi tiết từng ngày: ca hoặc nhịp, khung giờ, giờ cho ăn, giờ đóng cửa, ca admin đổi hộ, đơn nghỉ chờ duyệt. Tải CSV một dòng mỗi người/ngày/ca. |

Mọi mốc giờ tính theo giờ Việt Nam (UTC+7) và lấy giờ máy chủ.

## Khoá Wi-Fi công ty

Trang **Wi-Fi** của admin (`/admin/network`). Trình duyệt không cho web đọc tên Wi-Fi, nên hệ thống nhận ra Wi-Fi công ty qua **IP công cộng** của đường mạng đó (cần IP tĩnh).

1. Admin đứng ở công ty, bắt Wi-Fi công ty, bấm **Thêm Wi-Fi đang kết nối** (hoặc nhập IP/dải IP bằng tay). Mỗi Wi-Fi/đường mạng thêm 1 dòng.
2. Chọn mức khoá: **Tắt** (mặc định) · **Chỉ cảnh báo** (vẫn cho chấm công, ghi lại lượt ngoài Wi-Fi) · **Chặn**.
3. Chọn phạm vi: chỉ khoá **Cho ăn / Đóng cửa**, hoặc khoá **cả đăng nhập** (nhân viên ngoài Wi-Fi công ty thấy trang "Hãy kết nối Wi-Fi công ty").
4. Người làm từ xa: bấm **Cho miễn**. Admin không bao giờ bị khoá.

IP lấy từ header `x-real-ip` / `x-forwarded-for` mà Vercel tự ghi đè, client không giả được. Nếu chạy sau proxy khác, kiểm tra lại proxy có ghi đè các header này không.

## Hướng dẫn cho người chơi

- Nút **?** trên thanh menu (và ở trang đăng nhập, trang chờ duyệt) mở bảng hướng dẫn đầy đủ: `src/components/Help.tsx`. Nhân viên mới vào lần đầu sẽ tự thấy bảng này.
- Trang Sân của tôi có khung **Quy tắc chơi** bên trái khu vườn, tóm tắt theo đúng loại công việc: `src/components/RulesPanel.tsx`.
- Mọi con số trong hướng dẫn (giờ ca, hệ số, giá trứng, phạt...) lấy từ cấu hình hiện tại, admin sửa luật thì hướng dẫn tự đổi theo.

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
2. **Sân tạm trống (đang chờ cấp lại con)** vẫn được 1 xu mỗi lần cho ăn.
3. **Bỏ bữa liên tiếp tính xuyên tháng**; bộ đếm về 0 khi cho ăn thành công. Bộ đếm theo tháng về 0 khi sang tháng mới. Cả 2 bộ đếm về 0 sau mỗi lần chết (kể cả khi Mão đỡ chết, hoặc sân đang trống không còn con để chết).
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
npm test      # 47 test: hệ số, giá trứng, trộm, chết, đăng ký ca, nghỉ phép, quyết toán, chạy song song
```

## Tạo Google OAuth (đăng nhập Gmail)

1. Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), tạo project nếu chưa có.
2. **OAuth consent screen**: chọn External, điền tên app và email hỗ trợ. Để chế độ Testing thì phải thêm email từng người vào Test users; muốn ai cũng đăng nhập được thì bấm Publish.
3. **Create credentials → OAuth client ID → Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` và `https://<domain-của-bạn>`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` và `https://<domain-của-bạn>/api/auth/callback/google`
4. Chép Client ID / Secret vào `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## Deploy lên Vercel + Neon (miễn phí)

1. **Vercel:** đăng nhập [vercel.com](https://vercel.com) bằng GitHub → *Add New → Project* → chọn repo này → chưa bấm Deploy vội.
2. **Database:** trong project Vercel → tab *Storage* → *Create Database* → **Neon** (Postgres) → Connect. Vercel tự thêm `DATABASE_URL` và `DATABASE_URL_UNPOOLED`.
3. **Biến môi trường** (*Settings → Environment Variables*):
   - `AUTH_SECRET`: chuỗi ngẫu nhiên dài (vd tạo bằng `openssl rand -base64 32`)
   - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`: xem mục Google OAuth ở trên, redirect URI là `https://<tên-project>.vercel.app/api/auth/callback/google`
   - `ADMIN_EMAILS`: Gmail của bạn (tự thành admin khi đăng nhập lần đầu)
   - `CRON_SECRET`: chuỗi ngẫu nhiên bất kỳ
4. **Deploy.** Lệnh `vercel-build` tự tạo bảng (`prisma migrate deploy`), nạp danh mục ca và luật mặc định, rồi build.
5. (Nên làm) Tạo cron ngoài ở [cron-job.org](https://cron-job.org) gọi `https://<tên-project>.vercel.app/api/cron?secret=<CRON_SECRET>` mỗi 5 phút để ghi nhận bỏ bữa/quên đóng cửa đúng giờ. Không có cũng chạy được: hệ thống tự quét khi có người mở trang, và Vercel cron chạy 1 lần lúc 0h.

## Kỹ năng 12 con giáp

Mỗi con 1 kỹ năng, chỉ có tác dụng khi con đó còn sống. Con số nằm trong Rules Engine (`skills` trong trang Cấu hình); bỏ mã con khỏi `skills.enabled` để tắt kỹ năng đó.

| Con | Kỹ năng | Tác dụng |
|---|---|---|
| Tý | Tay nhanh | Trộm mỗi lần tối đa 6 xu (thường 5) |
| Sửu | Cần cù | Tuần đi làm không bỏ bữa nào: +1 xu |
| Dần | Gầm canh cửa | Lần quên đóng cửa đầu tiên mỗi tháng: không ai trộm được |
| Mão | Chín mạng | 1 lần/quý đỡ chết, **vẫn phạt 100k** |
| Thìn | Uy rồng | Hệ số +0,25, không vượt x4 (vẫn chạy khi hệ số khoá: x1 + 0,25) |
| Tỵ | Nọc độc | Ai đã trộm sân bạn 1 lần thì bị khoá 7 ngày không trộm được sân bạn lần nữa (`tiLockDays`) |
| Ngọ | Phi nước đại | 10 phút đầu khi sân mở cửa, chỉ người có Ngọ được trộm |
| Mùi | Hiền lành | Bị trộm 7% thay vì 10% |
| Thân | Láu lỉnh | 1 lần/tuần được làm người trộm thứ 4 |
| Dậu | Gáy sáng | Nhắc trên trang 5 phút trước giờ cho ăn |
| Tuất | Trung thành | Ngày lễ chung tự cho ăn, nhận xu như đi làm (tối đa 2 ngày/tháng) |
| Hợi | Phúc hậu | Mua trứng giảm 5% điểm |

Xu từ kỹ năng ghi vào sổ cái loại `SKILL`, **tính vào biến động tháng và thưởng như xu thường** (cột "Kỹ năng" trên báo cáo/CSV). Mỗi lần kích hoạt ghi vào bảng `SkillUse` (unique theo người + con + mã sự kiện nên job quét chạy lại không cộng trùng).

## Nghỉ lễ nhà nước tự động

Lịch nghỉ lễ theo Điều 112 Bộ luật Lao động được **tự tính và nạp sẵn** cho năm nay + năm sau (`src/lib/vn-holidays.ts`, âm lịch tính theo giờ VN trong `src/lib/lunar.ts`), admin không cần nhập:

- Tết Dương lịch 1/1 · Tết Nguyên đán 5 ngày (ngày cuối năm âm lịch + mùng 1–4) · Giỗ Tổ Hùng Vương 10/3 âm lịch · 30/4 · 1/5 · Quốc khánh 2/9 + 1 ngày liền kề · Ngày Văn hoá Việt Nam 24/11 (từ 2026).
- Ngày lễ trùng T7/CN được **nghỉ bù** vào ngày làm việc kế tiếp.
- Ngày liền kề 2/9 do Thủ tướng chọn hằng năm; hệ thống tự chọn ngày nối với cuối tuần (2/9 rơi vào CN/T2/T5 thì nghỉ 3/9, còn lại 1/9).

Job cron (`/api/cron`) và nút "Quét ngay" của admin tự nạp lịch mỗi lần chạy (idempotent). Ngày lễ không có lượt cho ăn, không tính bỏ bữa, con Tuất vẫn "trực lễ" như cũ.
Admin vẫn chỉnh được ở **Cấu hình → Ngày nghỉ lễ chung**: thêm ngày nghỉ bù/hoán đổi chính phủ công bố, sửa tên, xoá ngày không nghỉ. Ngày lễ tự động đã xoá được ghi vào bảng `HolidaySkip` nên không bị nạp lại (có nút Khôi phục). Nghỉ phép cá nhân vẫn do admin duyệt như cũ.

## Mở rộng sau

Kỹ năng ẩn của 12 con giáp (gồm con tự cho ăn ngày nghỉ lễ) và giao nhiệm vụ: cắm thêm vào Rules Engine (`src/lib/rules.ts`) và dùng chung sổ cái xu.
