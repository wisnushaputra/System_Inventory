-- CreateTable
CREATE TABLE "TopologyLayout" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "positions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopologyLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopologyLayout_userId_idx" ON "TopologyLayout"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TopologyLayout_userId_scope_key" ON "TopologyLayout"("userId", "scope");

-- AddForeignKey
ALTER TABLE "TopologyLayout" ADD CONSTRAINT "TopologyLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
