-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('SPOILER', 'OFFENSIVE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('OPEN', 'DISMISSED', 'UPHELD');

-- AlterTable
ALTER TABLE "routes" ADD COLUMN     "hidden_at" TIMESTAMPTZ(3),
ADD COLUMN     "hidden_by_id" UUID,
ADD COLUMN     "hidden_reason" VARCHAR(500);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "route_reports" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" "report_reason" NOT NULL,
    "note" VARCHAR(500),
    "status" "report_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_id" UUID,

    CONSTRAINT "route_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_reports_status_created_at_idx" ON "route_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "route_reports_route_id_reporter_id_key" ON "route_reports"("route_id", "reporter_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_hidden_by_id_fkey" FOREIGN KEY ("hidden_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reports" ADD CONSTRAINT "route_reports_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reports" ADD CONSTRAINT "route_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_reports" ADD CONSTRAINT "route_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written constraints (Prisma cannot express CHECKs).

-- A route is hidden with a reason, or not hidden at all: never half and half.
-- hidden_by_id is left out on purpose: it becomes NULL if that admin is deleted.
ALTER TABLE "routes" ADD CONSTRAINT "routes_hidden_consistent_check"
  CHECK (
    ("hidden_at" IS NULL AND "hidden_reason" IS NULL AND "hidden_by_id" IS NULL)
    OR ("hidden_at" IS NOT NULL AND char_length(btrim("hidden_reason")) > 0)
  );

-- A report is resolved exactly when it is no longer open.
-- resolved_by_id is left out for the same reason as above.
ALTER TABLE "route_reports" ADD CONSTRAINT "route_reports_resolved_consistent_check"
  CHECK (("status" = 'OPEN') = ("resolved_at" IS NULL));
