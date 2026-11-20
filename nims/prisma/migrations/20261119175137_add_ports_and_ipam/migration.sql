-- CreateTable
CREATE TABLE "Interface" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "interfaceType" TEXT NOT NULL DEFAULT 'ethernet',
    "mediaType" TEXT,
    "speedMbps" INTEGER,
    "adminStatus" TEXT NOT NULL DEFAULT 'enabled',
    "operStatus" TEXT NOT NULL DEFAULT 'unknown',
    "macAddress" TEXT,
    "portMode" TEXT,
    "vlanId" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subnet" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cidr" TEXT NOT NULL,
    "ipVersion" TEXT NOT NULL DEFAULT 'IPv4',
    "siteId" INTEGER,
    "gatewayIp" TEXT,
    "vlanId" INTEGER,
    "purpose" TEXT NOT NULL DEFAULT 'management',
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subnet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "ipVersion" TEXT NOT NULL DEFAULT 'IPv4',
    "subnetId" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "interfaceId" INTEGER,
    "purpose" TEXT NOT NULL DEFAULT 'management',
    "allocationStatus" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "hostname" TEXT,
    "assignedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Interface_deviceId_idx" ON "Interface"("deviceId");

-- CreateIndex
CREATE INDEX "Interface_name_idx" ON "Interface"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Interface_deviceId_name_key" ON "Interface"("deviceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Subnet_cidr_key" ON "Subnet"("cidr");

-- CreateIndex
CREATE INDEX "Subnet_cidr_idx" ON "Subnet"("cidr");

-- CreateIndex
CREATE INDEX "Subnet_siteId_idx" ON "Subnet"("siteId");

-- CreateIndex
CREATE INDEX "IpAddress_address_idx" ON "IpAddress"("address");

-- CreateIndex
CREATE INDEX "IpAddress_deviceId_idx" ON "IpAddress"("deviceId");

-- CreateIndex
CREATE INDEX "IpAddress_interfaceId_idx" ON "IpAddress"("interfaceId");

-- CreateIndex
CREATE INDEX "IpAddress_subnetId_idx" ON "IpAddress"("subnetId");

-- CreateIndex
CREATE INDEX "IpAddress_allocationStatus_idx" ON "IpAddress"("allocationStatus");

-- CreateIndex
CREATE INDEX "IpAddress_purpose_idx" ON "IpAddress"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_subnetId_address_key" ON "IpAddress"("subnetId", "address");

-- AddForeignKey
ALTER TABLE "Interface" ADD CONSTRAINT "Interface_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subnet" ADD CONSTRAINT "Subnet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_subnetId_fkey" FOREIGN KEY ("subnetId") REFERENCES "Subnet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "Interface"("id") ON DELETE SET NULL ON UPDATE CASCADE;
