// Zod schemas shared by server actions and the intake API. Field value sets are
// imported from the engine so validation and the schema stay in lock-step.

import { z } from "zod";
import {
  TAXON_RANKS,
  CROSS_STATUSES,
  CROSS_TYPES,
  POLLINATION_METHODS,
  SEED_METHODS,
  INTERVENTION_OUTCOMES,
  CULTURE_PARAMETERS,
  OUTCOMES,
  SOURCE_TYPES,
  LICENSES,
  KNOWLEDGE_CATEGORIES,
  TAXON_SCOPES,
  TAXON_NAME_TYPES,
  REFERENCE_DB_KINDS,
  REFERENCE_DB_STATUSES,
  INTAKE_KINDS,
} from "@engine/enums";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v !== "" ? Number(v) : undefined))
  .refine((v) => v === undefined || !Number.isNaN(v), "must be a number");

export const growerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: optionalString,
  phone: optionalString,
  location: optionalString,
  notes: optionalString,
  consentToShare: z.coerce.boolean().optional(),
});

export const taxonSchema = z.object({
  name: z.string().trim().min(1),
  rank: z.enum(TAXON_RANKS),
  parentId: optionalString,
  authority: optionalString,
  chromosomeCount: optionalInt,
  ploidy: optionalString,
  nativeRange: optionalString,
});

export const plantSchema = z.object({
  taxonId: z.string().trim().min(1, "Taxon is required"),
  growerId: optionalString,
  clonalName: optionalString,
  accessionCode: optionalString,
  source: optionalString,
  location: optionalString,
  notes: optionalString,
});

export const crossSchema = z.object({
  code: optionalString,
  goal: optionalString,
  status: z.enum(CROSS_STATUSES).optional(),
  seedParentPlantId: optionalString,
  pollenParentPlantId: optionalString,
  seedParentTaxonId: optionalString,
  pollenParentTaxonId: optionalString,
  notes: optionalString,
});

export const pollinationSchema = z.object({
  crossId: z.string().min(1),
  date: optionalString,
  method: z.enum(POLLINATION_METHODS).optional(),
  operatorGrowerId: optionalString,
  pollenSource: optionalString,
  success: optionalString, // "true" | "false" | ""
  notes: optionalString,
});

export const podSetSchema = z.object({
  crossId: z.string().min(1),
  set: z.coerce.boolean().optional(),
  podCount: optionalInt,
  matured: z.coerce.boolean().optional(),
  notes: optionalString,
});

export const seedBatchSchema = z.object({
  crossId: z.string().min(1),
  method: z.enum(SEED_METHODS).optional(),
  medium: optionalString,
  flaskCount: optionalInt,
  notes: optionalString,
});

export const interventionSchema = z.object({
  crossId: optionalString,
  // Any active technique key (built-in or user-added), not a fixed enum.
  type: z.string().trim().min(1, "A technique is required"),
  outcome: z.enum(INTERVENTION_OUTCOMES).optional(),
  notes: optionalString,
});

export const interventionTechniqueSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "_")),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  appliesTo: z.array(z.enum(CROSS_TYPES)).min(1, "Pick at least one cross type"),
  maxViability: z.coerce.number().int().min(0).max(100).optional(),
  basePriority: z.coerce.number().int().min(0).max(100).optional(),
});

export const taxonNameSchema = z.object({
  taxonId: z.string().min(1),
  name: z.string().trim().min(1),
  nameType: z.enum(TAXON_NAME_TYPES).optional(),
  authority: optionalString,
  inCurrentUse: z.coerce.boolean().optional(),
  isPreferredDisplay: z.coerce.boolean().optional(),
  note: optionalString,
});

export const referenceDatabaseSchema = z.object({
  name: z.string().trim().min(1),
  description: optionalString,
  url: optionalString,
  kind: z.enum(REFERENCE_DB_KINDS).optional(),
  defaultLicense: z.enum(LICENSES).optional(),
  defaultAiUseAllowed: z.coerce.boolean().optional(),
  defaultRedistributionAllowed: z.coerce.boolean().optional(),
  defaultCommercialUseAllowed: z.coerce.boolean().optional(),
  captureGuidance: optionalString,
  status: z.enum(REFERENCE_DB_STATUSES).optional(),
});

export const observationSchema = z.object({
  taxonId: optionalString,
  plantId: optionalString,
  growerId: optionalString,
  parameter: z.enum(CULTURE_PARAMETERS),
  valueText: z.string().trim().min(1, "A value/recommendation is required"),
  context: optionalString,
  outcome: z.enum(OUTCOMES).optional(),
  notes: optionalString,
});

export const sourceSchema = z.object({
  title: z.string().trim().min(1),
  authors: optionalString,
  type: z.enum(SOURCE_TYPES).optional(),
  url: optionalString,
  doi: optionalString,
  citation: optionalString,
  license: z.enum(LICENSES).optional(),
  redistributionAllowed: z.coerce.boolean().optional(),
  aiUseAllowed: z.coerce.boolean().optional(),
  commercialUseAllowed: z.coerce.boolean().optional(),
  accessNotes: optionalString,
  referenceDatabaseId: optionalString,
});

export const knowledgeSchema = z.object({
  title: z.string().trim().min(1),
  takeaway: z.string().trim().min(1),
  category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
  taxonId: optionalString,
  taxonScope: z.enum(TAXON_SCOPES).optional(),
  citation: optionalString,
  isUserAuthored: z.coerce.boolean().optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  sourceIds: z.array(z.string()).optional(),
});

export const intakeSchema = z.object({
  submitterName: optionalString,
  submitterEmail: optionalString,
  growerId: optionalString,
  kind: z.enum(INTAKE_KINDS),
  payload: z.record(z.string(), z.any()),
});
