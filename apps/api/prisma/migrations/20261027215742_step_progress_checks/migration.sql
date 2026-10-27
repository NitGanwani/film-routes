-- A film is closed by registering an emotion, and closing it means it was
-- watched (or marked as already seen), so the watch date must be set.
ALTER TABLE "step_progress"
  ADD CONSTRAINT "step_progress_emotion_needs_watched"
  CHECK ("emotion" IS NULL OR "watched_at" IS NOT NULL);

-- The optional comment always travels with an emotion.
ALTER TABLE "step_progress"
  ADD CONSTRAINT "step_progress_comment_needs_emotion"
  CHECK ("comment" IS NULL OR "emotion" IS NOT NULL);
