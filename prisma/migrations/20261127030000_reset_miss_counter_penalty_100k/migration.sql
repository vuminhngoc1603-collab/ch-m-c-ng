-- Bộ đếm bỏ bữa theo tháng, đếm lại từ 0 sau mỗi lần con giáp chết.
ALTER TABLE "User" ADD COLUMN "monthMisses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "monthMissPeriod" TEXT;

-- Điền giá trị ban đầu: số bữa bỏ trong tháng hiện tại (giờ VN) sau ngày phạt gần nhất của tháng đó.
WITH cur AS (SELECT to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS period)
UPDATE "User" u
SET "monthMissPeriod" = cur.period,
    "monthMisses" = (
      SELECT count(*)::int FROM "Attendance" a
      WHERE a."userId" = u."id" AND a."feedStatus" = 'MISSED'
        AND a."day" LIKE cur.period || '-%'
        AND a."day" > COALESCE((
          SELECT max(to_char((p."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD'))
          FROM "Penalty" p WHERE p."userId" = u."id" AND p."period" = cur.period
        ), '')
    )
FROM cur;

-- Phạt mỗi lần chết giảm 300.000 đ -> 100.000 đ (nếu admin chưa đổi sang mức khác).
UPDATE "Setting" SET "value" = jsonb_set("value"::jsonb, '{penaltyVnd}', '100000')
WHERE "key" = 'rules' AND ("value"::jsonb ->> 'penaltyVnd') = '300000';
