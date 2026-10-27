-- AlterEnum
ALTER TYPE "enrollment_status" ADD VALUE 'REMOVED';

-- DropIndex
DROP INDEX "enrollments_invite_id_key";

-- AlterTable
ALTER TABLE "route_invites" ADD COLUMN     "max_uses" INTEGER,
ADD COLUMN     "uses_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "enrollments_invite_id_idx" ON "enrollments"("invite_id");

-- A cap must be positive, and the counter can never exceed it.
ALTER TABLE "route_invites"
  ADD CONSTRAINT "route_invites_max_uses_positive"
    CHECK ("max_uses" IS NULL OR "max_uses" > 0),
  ADD CONSTRAINT "route_invites_uses_within_cap"
    CHECK ("uses_count" >= 0 AND ("max_uses" IS NULL OR "uses_count" <= "max_uses"));
