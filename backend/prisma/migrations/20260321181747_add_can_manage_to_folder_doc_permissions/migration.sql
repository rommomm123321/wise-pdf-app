-- AlterTable
ALTER TABLE "DocumentPermission" ADD COLUMN     "canManage" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "FolderPermission" ADD COLUMN     "canManage" BOOLEAN NOT NULL DEFAULT false;
