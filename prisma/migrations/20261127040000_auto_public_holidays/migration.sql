-- Ngày lễ chung: phân biệt tự nạp theo lịch nhà nước (AUTO) và admin thêm (MANUAL).
ALTER TABLE "Holiday" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- Ngày lễ tự động admin đã xoá, để không tự nạp lại.
CREATE TABLE "HolidaySkip" (
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidaySkip_pkey" PRIMARY KEY ("day")
);
