-- CreateTable
CREATE TABLE "TaxonName" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameType" TEXT NOT NULL DEFAULT 'ACCEPTED_SCIENTIFIC',
    "authority" TEXT,
    "inCurrentUse" BOOLEAN NOT NULL DEFAULT true,
    "isPreferredDisplay" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxonName_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxonRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taxonId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "relatedTaxonId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "note" TEXT,
    "changedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxonRevision_taxonId_fkey" FOREIGN KEY ("taxonId") REFERENCES "Taxon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaxonRevision_relatedTaxonId_fkey" FOREIGN KEY ("relatedTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NothoGenusComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nothoGenusId" TEXT NOT NULL,
    "componentGenusId" TEXT NOT NULL,
    CONSTRAINT "NothoGenusComponent_nothoGenusId_fkey" FOREIGN KEY ("nothoGenusId") REFERENCES "Taxon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NothoGenusComponent_componentGenusId_fkey" FOREIGN KEY ("componentGenusId") REFERENCES "Taxon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferenceDatabase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "defaultLicense" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "defaultAiUseAllowed" BOOLEAN NOT NULL DEFAULT false,
    "defaultRedistributionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "defaultCommercialUseAllowed" BOOLEAN NOT NULL DEFAULT false,
    "captureGuidance" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EVALUATING',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InterventionTechnique" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "appliesToJson" TEXT NOT NULL,
    "maxViability" INTEGER NOT NULL DEFAULT 100,
    "basePriority" INTEGER NOT NULL DEFAULT 5,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Source" (
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
    "referenceDatabaseId" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Source_referenceDatabaseId_fkey" FOREIGN KEY ("referenceDatabaseId") REFERENCES "ReferenceDatabase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Source" ("accessNotes", "aiUseAllowed", "authors", "citation", "commercialUseAllowed", "createdAt", "doi", "id", "license", "organizationId", "redistributionAllowed", "title", "type", "updatedAt", "url") SELECT "accessNotes", "aiUseAllowed", "authors", "citation", "commercialUseAllowed", "createdAt", "doi", "id", "license", "organizationId", "redistributionAllowed", "title", "type", "updatedAt", "url" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE INDEX "Source_referenceDatabaseId_idx" ON "Source"("referenceDatabaseId");
CREATE TABLE "new_Taxon" (
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
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "nothoFormulaType" TEXT,
    "formulaAbbreviation" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "acceptedTaxonId" TEXT,
    "parentId" TEXT,
    "seedParentTaxonId" TEXT,
    "pollenParentTaxonId" TEXT,
    CONSTRAINT "Taxon_acceptedTaxonId_fkey" FOREIGN KEY ("acceptedTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Taxon_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Taxon_seedParentTaxonId_fkey" FOREIGN KEY ("seedParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Taxon_pollenParentTaxonId_fkey" FOREIGN KEY ("pollenParentTaxonId") REFERENCES "Taxon" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Taxon" ("authority", "chromosomeCount", "createdAt", "externalRefsJson", "id", "isHybrid", "name", "nativeRange", "organizationId", "parentId", "ploidy", "pollenParentTaxonId", "rank", "rhsGrexId", "seedParentTaxonId", "synonymsJson", "updatedAt") SELECT "authority", "chromosomeCount", "createdAt", "externalRefsJson", "id", "isHybrid", "name", "nativeRange", "organizationId", "parentId", "ploidy", "pollenParentTaxonId", "rank", "rhsGrexId", "seedParentTaxonId", "synonymsJson", "updatedAt" FROM "Taxon";
DROP TABLE "Taxon";
ALTER TABLE "new_Taxon" RENAME TO "Taxon";
CREATE INDEX "Taxon_rank_idx" ON "Taxon"("rank");
CREATE INDEX "Taxon_name_idx" ON "Taxon"("name");
CREATE INDEX "Taxon_parentId_idx" ON "Taxon"("parentId");
CREATE INDEX "Taxon_status_idx" ON "Taxon"("status");
CREATE INDEX "Taxon_acceptedTaxonId_idx" ON "Taxon"("acceptedTaxonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TaxonName_taxonId_idx" ON "TaxonName"("taxonId");

-- CreateIndex
CREATE INDEX "TaxonName_name_idx" ON "TaxonName"("name");

-- CreateIndex
CREATE INDEX "TaxonRevision_taxonId_idx" ON "TaxonRevision"("taxonId");

-- CreateIndex
CREATE INDEX "TaxonRevision_action_idx" ON "TaxonRevision"("action");

-- CreateIndex
CREATE INDEX "NothoGenusComponent_componentGenusId_idx" ON "NothoGenusComponent"("componentGenusId");

-- CreateIndex
CREATE UNIQUE INDEX "NothoGenusComponent_nothoGenusId_componentGenusId_key" ON "NothoGenusComponent"("nothoGenusId", "componentGenusId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceDatabase_name_key" ON "ReferenceDatabase"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionTechnique_key_key" ON "InterventionTechnique"("key");
