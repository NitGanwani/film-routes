-- CreateEnum
CREATE TYPE "locale" AS ENUM ('ES', 'EN');

-- CreateEnum
CREATE TYPE "visibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "emotion" AS ENUM ('JOY', 'TENDERNESS', 'AWE', 'THOUGHTFUL', 'TENSION', 'FEAR', 'SADNESS', 'DISCOMFORT');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "locale" "locale" NOT NULL DEFAULT 'ES',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "films" (
    "id" UUID NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "imdb_id" VARCHAR(16),
    "original_title" TEXT NOT NULL,
    "release_year" INTEGER,
    "runtime_minutes" INTEGER,
    "poster_path" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "films_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "film_translations" (
    "film_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,

    CONSTRAINT "film_translations_pkey" PRIMARY KEY ("film_id","locale")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "visibility" "visibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_steps" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "film_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "note_before" TEXT,
    "note_after" TEXT,
    "author_emotion" "emotion",

    CONSTRAINT "route_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_invites" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "traveler_id" UUID NOT NULL,
    "invite_id" UUID,
    "status" "enrollment_status" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_progress" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "watched_at" TIMESTAMPTZ(3),
    "emotion" "emotion",
    "comment" VARCHAR(280),

    CONSTRAINT "step_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "films_tmdb_id_key" ON "films"("tmdb_id");

-- CreateIndex
CREATE INDEX "routes_author_id_idx" ON "routes"("author_id");

-- CreateIndex
CREATE INDEX "routes_visibility_created_at_idx" ON "routes"("visibility", "created_at");

-- CreateIndex
CREATE INDEX "route_steps_film_id_idx" ON "route_steps"("film_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_steps_route_id_position_key" ON "route_steps"("route_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "route_steps_route_id_film_id_key" ON "route_steps"("route_id", "film_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_invites_token_hash_key" ON "route_invites"("token_hash");

-- CreateIndex
CREATE INDEX "route_invites_route_id_idx" ON "route_invites"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_invite_id_key" ON "enrollments"("invite_id");

-- CreateIndex
CREATE INDEX "enrollments_traveler_id_idx" ON "enrollments"("traveler_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_route_id_traveler_id_key" ON "enrollments"("route_id", "traveler_id");

-- CreateIndex
CREATE INDEX "step_progress_step_id_idx" ON "step_progress"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_progress_enrollment_id_step_id_key" ON "step_progress"("enrollment_id", "step_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_translations" ADD CONSTRAINT "film_translations_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_steps" ADD CONSTRAINT "route_steps_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_steps" ADD CONSTRAINT "route_steps_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "films"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_invites" ADD CONSTRAINT "route_invites_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_invites" ADD CONSTRAINT "route_invites_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "route_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_progress" ADD CONSTRAINT "step_progress_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_progress" ADD CONSTRAINT "step_progress_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "route_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
