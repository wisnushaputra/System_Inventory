-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "parentSiteId" INTEGER;

-- CreateIndex
CREATE INDEX "Site_parentSiteId_idx" ON "Site"("parentSiteId");

-- CreateIndex
CREATE INDEX "Site_siteType_idx" ON "Site"("siteType");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_parentSiteId_fkey" FOREIGN KEY ("parentSiteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
