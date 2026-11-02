-- CreateTable
CREATE TABLE "route_ratings" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "route_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_ratings_route_id_user_id_key" ON "route_ratings"("route_id", "user_id");

-- AddForeignKey
ALTER TABLE "route_ratings" ADD CONSTRAINT "route_ratings_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_ratings" ADD CONSTRAINT "route_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A score is a whole number from 1 to 10 (Prisma cannot express this).
ALTER TABLE "route_ratings"
  ADD CONSTRAINT "route_ratings_score_range"
  CHECK ("score" BETWEEN 1 AND 10);
