-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Grower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "consentToShare" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Grower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Taxon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rank" TEXT NOT NULL,
    "authority" TEXT,
    "isHybrid" BOOLEAN NOT NULL DEFAULT false,
    "chromosomeCount" INTEGER,
    "ploidy" TEXT,
    "nativeRange" TEXT,
    "synonymsJson" TEXT,
    "rhsGrexId" TEXT,
    "externalRefsJson" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "parentId" TEXT,
    "seedParentTaxonId" TEXT,
    "pollenParentTaxonId" TEXT,
    CONSTRAINT "Taxon_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Taxon_seedParentTaxonId_fkey" FOREIGN KEY ("seedParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Taxon_pollenParentTaxonId_fkey" FOREIGN KEY ("pollenParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonId" TEXT NOT NULL,
    "growerId" TEXT,
    "clonalName" TEXT,
    "accessionCode" TEXT,
    "source" TEXT,
    "acquiredAt" DATETIME,
    "location" TEXT,
    "notes" TEXT,
    "chromosomeCountOverride" INTEGER,
    "ploidyOverride" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plant_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Plant_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cross" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "crossType" TEXT,
    "plannedGrex" TEXT,
    "notes" TEXT,
    "organizationId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "seedParentPlantId" TEXT,
    "pollenParentPlantId" TEXT,
    "seedParentTaxonId" TEXT,
    "pollenParentTaxonId" TEXT,
    CONSTRAINT "Cross_seedParentPlantId_fkey" FOREIGN KEY ("seedParentPlantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cross_pollenParentPlantId_fkey" FOREIGN KEY ("pollenParentPlantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cross_seedParentTaxonId_fkey" FOREIGN KEY ("seedParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cross_pollenParentTaxonId_fkey" FOREIGN KEY ("pollenParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Cross_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollinationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crossId" TEXT NOT NULL,
    "date" DATETIME,
    "method" TEXT NOT NULL DEFAULT 'STANDARD',
    "operatorGrowerId" TEXT,
    "pollenSource" TEXT,
    "conditions" TEXT,
    "success" BOOLEAN,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollinationEvent_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PollinationEvent_operatorGrowerId_fkey" FOREIGN KEY ("operatorGrowerId") REFERENCES "Grower" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PodSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crossId" TEXT NOT NULL,
    "date" DATETIME,
    "set" BOOLEAN NOT NULL DEFAULT false,
    "podCount" INTEGER,
    "matured" BOOLEAN,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PodSet_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeedBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crossId" TEXT NOT NULL,
    "sownAt" DATETIME,
    "method" TEXT NOT NULL DEFAULT 'ASYMBIOTIC',
    "medium" TEXT,
    "flaskCount" INTEGER,
    "contaminationRate" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeedBatch_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GerminationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedBatchId" TEXT NOT NULL,
    "assessedAt" DATETIME,
    "germinated" BOOLEAN NOT NULL DEFAULT false,
    "germinationRate" REAL,
    "protocormCount" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GerminationResult_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeedlingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seedBatchId" TEXT,
    "crossId" TEXT,
    "deflaskedAt" DATETIME,
    "count" INTEGER,
    "survivalRate" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeedlingBatch_seedBatchId_fkey" FOREIGN KEY ("seedBatchId") REFERENCES "SeedBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SeedlingBatch_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BloomEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT,
    "crossId" TEXT,
    "taxonId" TEXT,
    "date" DATETIME,
    "description" TEXT,
    "awarded" BOOLEAN,
    "awardName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BloomEvent_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BloomEvent_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BloomEvent_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "crossId" TEXT,
    "pollinationEventId" TEXT,
    "type" TEXT NOT NULL,
    "paramsJson" TEXT,
    "appliedAt" DATETIME,
    "outcome" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Intervention_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Intervention_pollinationEventId_fkey" FOREIGN KEY ("pollinationEventId") REFERENCES "PollinationEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CultureObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonId" TEXT,
    "plantId" TEXT,
    "growerId" TEXT,
    "parameter" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "context" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sourceType" TEXT NOT NULL DEFAULT 'OBSERVATION',
    "knowledgeItemId" TEXT,
    "date" DATETIME,
    "notes" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CultureObservation_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CultureObservation_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CultureObservation_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CultureObservation_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "authors" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT,
    "doi" TEXT,
    "citation" TEXT,
    "license" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "redistributionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "aiUseAllowed" BOOLEAN NOT NULL DEFAULT false,
    "commercialUseAllowed" BOOLEAN NOT NULL DEFAULT false,
    "accessNotes" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "takeaway" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "taxonId" TEXT,
    "taxonScope" TEXT NOT NULL DEFAULT 'GENERAL',
    "shortQuote" TEXT,
    "fairUseFlag" BOOLEAN NOT NULL DEFAULT false,
    "citation" TEXT,
    "authoredByUserId" TEXT,
    "isUserAuthored" BOOLEAN NOT NULL DEFAULT true,
    "aiEligible" BOOLEAN NOT NULL DEFAULT false,
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeItem_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeItem_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "crossId" TEXT,
    "taxonId" TEXT,
    "score" REAL,
    "confidence" TEXT,
    "summary" TEXT NOT NULL,
    "reasoningJson" TEXT,
    "evidenceIdsJson" TEXT,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiNarrative" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES "Cross" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Assessment_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submitterName" TEXT,
    "submitterEmail" TEXT,
    "growerId" TEXT,
    "kind" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntakeSubmission_growerId_fkey" FOREIGN KEY ("growerId") REFERENCES "Grower" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "IntakeSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_KnowledgeItemToSource" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_KnowledgeItemToSource_A_fkey" FOREIGN KEY ("A") REFERENCES "KnowledgeItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_KnowledgeItemToSource_B_fkey" FOREIGN KEY ("B") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Grower_userId_key" ON "Grower"("userId");

-- CreateIndex
CREATE INDEX "Grower_organizationId_idx" ON "Grower"("organizationId");

-- CreateIndex
CREATE INDEX "Taxon_rank_idx" ON "Taxon"("rank");

-- CreateIndex
CREATE INDEX "Taxon_name_idx" ON "Taxon"("name");

-- CreateIndex
CREATE INDEX "Taxon_parentId_idx" ON "Taxon"("parentId");

-- CreateIndex
CREATE INDEX "Plant_taxonId_idx" ON "Plant"("taxonId");

-- CreateIndex
CREATE INDEX "Plant_growerId_idx" ON "Plant"("growerId");

-- CreateIndex
CREATE INDEX "Cross_status_idx" ON "Cross"("status");

-- CreateIndex
CREATE INDEX "Cross_organizationId_idx" ON "Cross"("organizationId");

-- CreateIndex
CREATE INDEX "PollinationEvent_crossId_idx" ON "PollinationEvent"("crossId");

-- CreateIndex
CREATE INDEX "PodSet_crossId_idx" ON "PodSet"("crossId");

-- CreateIndex
CREATE INDEX "SeedBatch_crossId_idx" ON "SeedBatch"("crossId");

-- CreateIndex
CREATE INDEX "GerminationResult_seedBatchId_idx" ON "GerminationResult"("seedBatchId");

-- CreateIndex
CREATE INDEX "SeedlingBatch_crossId_idx" ON "SeedlingBatch"("crossId");

-- CreateIndex
CREATE INDEX "Intervention_type_idx" ON "Intervention"("type");

-- CreateIndex
CREATE INDEX "Intervention_crossId_idx" ON "Intervention"("crossId");

-- CreateIndex
CREATE INDEX "CultureObservation_taxonId_idx" ON "CultureObservation"("taxonId");

-- CreateIndex
CREATE INDEX "CultureObservation_parameter_idx" ON "CultureObservation"("parameter");

-- CreateIndex
CREATE INDEX "KnowledgeItem_category_idx" ON "KnowledgeItem"("category");

-- CreateIndex
CREATE INDEX "KnowledgeItem_taxonId_idx" ON "KnowledgeItem"("taxonId");

-- CreateIndex
CREATE INDEX "Assessment_kind_idx" ON "Assessment"("kind");

-- CreateIndex
CREATE INDEX "IntakeSubmission_status_idx" ON "IntakeSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_KnowledgeItemToSource_AB_unique" ON "_KnowledgeItemToSource"("A", "B");

-- CreateIndex
CREATE INDEX "_KnowledgeItemToSource_B_index" ON "_KnowledgeItemToSource"("B");
