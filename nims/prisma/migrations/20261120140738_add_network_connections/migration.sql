-- CreateTable
CREATE TABLE "NetworkConnection" (
    "id" SERIAL NOT NULL,
    "endpointAInterfaceId" INTEGER NOT NULL,
    "endpointBInterfaceId" INTEGER NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT 'physical',
    "medium" TEXT,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'documented',
    "capacityMbps" INTEGER,
    "description" TEXT,
    "createdBy" INTEGER,
    "updatedBy" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkConnection_endpointAInterfaceId_idx" ON "NetworkConnection"("endpointAInterfaceId");

-- CreateIndex
CREATE INDEX "NetworkConnection_endpointBInterfaceId_idx" ON "NetworkConnection"("endpointBInterfaceId");

-- CreateIndex
CREATE INDEX "NetworkConnection_relationType_idx" ON "NetworkConnection"("relationType");

-- CreateIndex
CREATE INDEX "NetworkConnection_status_idx" ON "NetworkConnection"("status");

-- CreateIndex
CREATE INDEX "NetworkConnection_archivedAt_idx" ON "NetworkConnection"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkConnection_endpointAInterfaceId_endpointBInterfaceId_key" ON "NetworkConnection"("endpointAInterfaceId", "endpointBInterfaceId");

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_endpointAInterfaceId_fkey" FOREIGN KEY ("endpointAInterfaceId") REFERENCES "Interface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_endpointBInterfaceId_fkey" FOREIGN KEY ("endpointBInterfaceId") REFERENCES "Interface"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkConnection" ADD CONSTRAINT "NetworkConnection_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
