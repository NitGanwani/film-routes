-- AlterTable
ALTER TABLE "route_steps" ADD COLUMN     "author_emotion_2" "emotion";

-- AlterTable
ALTER TABLE "step_progress" ADD COLUMN     "emotion_2" "emotion";

-- A film is felt as one or two emotions: the second one needs the first and
-- cannot repeat it (Prisma cannot express this).
ALTER TABLE "route_steps"
  ADD CONSTRAINT "route_steps_author_emotion_2_needs_first"
  CHECK ("author_emotion_2" IS NULL OR "author_emotion" IS NOT NULL);

ALTER TABLE "route_steps"
  ADD CONSTRAINT "route_steps_author_emotions_differ"
  CHECK ("author_emotion_2" IS NULL OR "author_emotion_2" <> "author_emotion");

ALTER TABLE "step_progress"
  ADD CONSTRAINT "step_progress_emotion_2_needs_first"
  CHECK ("emotion_2" IS NULL OR "emotion" IS NOT NULL);

ALTER TABLE "step_progress"
  ADD CONSTRAINT "step_progress_emotions_differ"
  CHECK ("emotion_2" IS NULL OR "emotion_2" <> "emotion");
