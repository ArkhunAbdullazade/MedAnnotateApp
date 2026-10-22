\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

\copy (SELECT * FROM "MedDatas" ORDER BY "Id") TO 'MedDatas.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM "MedDataKeywords" ORDER BY "Id") TO 'MedDataKeywords.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM "AnnotatedMedDatas" ORDER BY "Id") TO 'AnnotatedMedDatas.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT * FROM "AnnotatedByStudentsMedDatas" ORDER BY "Id") TO 'AnnotatedByStudentsMedDatas.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT "Id", "Email", "FullName", "University", "Position", "ClinicalExperience", "OrcidId", "Speciality", "BodyRegion", "ImageModality" FROM "AspNetUsers" ORDER BY "Id") TO 'Researchers.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT ur."UserId" AS "ResearcherId", r."Name" AS "Role" FROM "AspNetUserRoles" ur JOIN "AspNetRoles" r ON r."Id" = ur."RoleId" ORDER BY ur."UserId", r."Name") TO 'ResearcherRoles.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy (SELECT count(*) AS "TotalImages", count(*) FILTER (WHERE m."IsAnnotated") AS "SpecialistCompletedImages", count(*) FILTER (WHERE m."IsAnnotatedByStudent") AS "StudentCompletedImages", count(*) FILTER (WHERE m."IsAnnotated" AND m."IsAnnotatedByStudent") AS "CompletedByBothRoles", count(*) FILTER (WHERE nullif(btrim(m."Speciality"), '') IS NULL OR nullif(btrim(m."BodyRegion"), '') IS NULL OR nullif(btrim(m."Modality"), '') IS NULL) AS "ImagesMissingCategories", count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "MedDataKeywords" k WHERE k."MedDataId" = m."Id" AND nullif(btrim(k."Keyword"), '') IS NOT NULL)) AS "ImagesMissingKeywords", count(*) FILTER (WHERE nullif(btrim(m."ImageUrl"), '') IS NULL) AS "ImagesMissingImageUrl", (SELECT count(*) FROM "AnnotatedMedDatas") AS "SpecialistResponses", (SELECT count(*) FROM "AnnotatedByStudentsMedDatas") AS "StudentGroups" FROM "MedDatas" m) TO 'Progress.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

COMMIT;
