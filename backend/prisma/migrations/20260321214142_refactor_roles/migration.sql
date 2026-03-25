-- DropIndex
DROP INDEX "Role_companyId_name_key";

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- CreateIndex
CREATE INDEX "Role_projectId_idx" ON "Role"("projectId");

-- CreateIndex
CREATE INDEX "Role_isSystem_idx" ON "Role"("isSystem");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
