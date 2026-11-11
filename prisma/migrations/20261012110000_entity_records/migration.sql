-- CreateTable
CREATE TABLE "DataRecord" (
    "namespace" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "digest" TEXT NOT NULL,
    "learnerId" TEXT,
    "ownerEmail" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRecord_pkey" PRIMARY KEY ("namespace","collection","id")
);

-- CreateIndex
CREATE INDEX "DataRecord_namespace_learnerId_idx" ON "DataRecord"("namespace", "learnerId");

-- CreateIndex
CREATE INDEX "DataRecord_namespace_ownerEmail_idx" ON "DataRecord"("namespace", "ownerEmail");
