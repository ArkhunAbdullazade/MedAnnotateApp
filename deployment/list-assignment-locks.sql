\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT current_database() AS database;
SELECT 'professional' AS role, image."Id" AS image_id,
       image."LockedByUserId" AS owner_id, owner."Email" AS owner_email,
       image."IsAnnotated" AS completed,
       (SELECT count(*) FROM "AnnotatedMedDatas" response WHERE response."MedDataId" = image."Id") AS saved_responses
FROM "MedDatas" image LEFT JOIN "AspNetUsers" owner ON owner."Id" = image."LockedByUserId"
WHERE image."LockedByUserId" IS NOT NULL
UNION ALL
SELECT 'student', image."Id", image."LockedByStudentUserId", owner."Email",
       image."IsAnnotatedByStudent",
       (SELECT count(*) FROM "AnnotatedByStudentsMedDatas" response WHERE response."MedDataId" = image."Id")
FROM "MedDatas" image LEFT JOIN "AspNetUsers" owner ON owner."Id" = image."LockedByStudentUserId"
WHERE image."LockedByStudentUserId" IS NOT NULL
ORDER BY role, image_id;
COMMIT;
