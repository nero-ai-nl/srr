ALTER TABLE "User"
ADD COLUMN "defaultMaxRetentionSeconds" INTEGER;

ALTER TABLE "User"
ADD CONSTRAINT "User_defaultMaxRetentionSeconds_check"
CHECK (
  "defaultMaxRetentionSeconds" IS NULL
  OR ("defaultMaxRetentionSeconds" >= 5 AND "defaultMaxRetentionSeconds" <= 600)
);
