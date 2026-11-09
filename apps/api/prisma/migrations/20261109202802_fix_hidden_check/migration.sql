-- The first version of this CHECK let a route be hidden without a reason:
-- with hidden_reason NULL, char_length(...) > 0 evaluates to NULL, and a CHECK
-- only rejects FALSE, never NULL. The fix states "is not null" explicitly so
-- the condition can only be TRUE or FALSE.
ALTER TABLE "routes" DROP CONSTRAINT "routes_hidden_consistent_check";

ALTER TABLE "routes" ADD CONSTRAINT "routes_hidden_consistent_check"
  CHECK (
    ("hidden_at" IS NULL AND "hidden_reason" IS NULL AND "hidden_by_id" IS NULL)
    OR (
      "hidden_at" IS NOT NULL
      AND "hidden_reason" IS NOT NULL
      AND char_length(btrim("hidden_reason")) > 0
    )
  );
