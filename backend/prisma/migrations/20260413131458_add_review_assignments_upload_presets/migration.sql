-- DropIndex
DROP INDEX "Notification_userId_markupId_key";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "assignmentId" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'mention',
ALTER COLUMN "markupId" DROP NOT NULL,
ALTER COLUMN "documentId" DROP NOT NULL,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ReviewAssignment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadPreset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "assignToId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewAssignment_documentId_idx" ON "ReviewAssignment"("documentId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_reviewerId_idx" ON "ReviewAssignment"("reviewerId");

-- CreateIndex
CREATE INDEX "ReviewAssignment_requesterId_idx" ON "ReviewAssignment"("requesterId");

-- CreateIndex
CREATE INDEX "UploadPreset_userId_idx" ON "UploadPreset"("userId");

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAssignment" ADD CONSTRAINT "ReviewAssignment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPreset" ADD CONSTRAINT "UploadPreset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
