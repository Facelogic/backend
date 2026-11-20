-- Same change as src/db/migrations/20261120000000-add-document-to-student.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "Student"."nationalId" CHAR(8) -> "document" VARCHAR(12) + "documentTypeId" (FK "DocumentType"), like "User".
BEGIN;

ALTER TABLE "Student" RENAME COLUMN "nationalId" TO "document";
ALTER TABLE "Student" ALTER COLUMN "document" TYPE VARCHAR(12) USING NULLIF(TRIM("document"), '');
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "documentTypeId" UUID;
ALTER TABLE "Student" ADD CONSTRAINT "Student_documentTypeId_fkey"
  FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy values were DNIs.
UPDATE "Student" SET "documentTypeId" = (SELECT "id" FROM "DocumentType" WHERE "name" = 'DNI' LIMIT 1)
 WHERE "document" IS NOT NULL AND "documentTypeId" IS NULL;

DROP INDEX IF EXISTS "Student_schoolId_nationalId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_document_key" ON "Student"("schoolId", "document");

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261120000000-add-document-to-student.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS "Student_schoolId_document_key";
-- ALTER TABLE "Student" DROP COLUMN IF EXISTS "documentTypeId";
-- UPDATE "Student" SET "document" = NULL WHERE LENGTH("document") > 8;
-- ALTER TABLE "Student" ALTER COLUMN "document" TYPE CHAR(8);
-- ALTER TABLE "Student" RENAME COLUMN "document" TO "nationalId";
-- CREATE UNIQUE INDEX "Student_schoolId_nationalId_key" ON "Student"("schoolId", "nationalId");
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261120000000-add-document-to-student.ts';
