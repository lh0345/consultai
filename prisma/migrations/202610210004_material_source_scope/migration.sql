-- The same Drive source can be reviewed independently for different subjects.
DROP INDEX "Material_driveId_key";
CREATE UNIQUE INDEX "Material_subjectId_driveId_key" ON "Material"("subjectId", "driveId");
