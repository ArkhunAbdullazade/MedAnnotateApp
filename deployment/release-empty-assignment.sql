\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(58021014);
UPDATE "MedDatas" AS image
SET "LockedByUserId" = CASE WHEN :'role' = 'professional' THEN NULL ELSE image."LockedByUserId" END,
    "LockedByStudentUserId" = CASE WHEN :'role' = 'student' THEN NULL ELSE image."LockedByStudentUserId" END,
    "KeywordStates" = CASE WHEN :'role' = 'professional' THEN NULL ELSE image."KeywordStates" END
WHERE image."Id" = :'image_id'::integer
  AND ((:'role' = 'professional' AND image."LockedByUserId" = :'owner_id' AND NOT image."IsAnnotated"
        AND NOT EXISTS (SELECT 1 FROM "AnnotatedMedDatas" response WHERE response."MedDataId" = image."Id"))
    OR (:'role' = 'student' AND image."LockedByStudentUserId" = :'owner_id' AND NOT image."IsAnnotatedByStudent"
        AND NOT EXISTS (SELECT 1 FROM "AnnotatedByStudentsMedDatas" response WHERE response."MedDataId" = image."Id")))
RETURNING image."Id" AS released_image_id, :'role' AS released_role;
COMMIT;
