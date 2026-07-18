// Canonical string sets used across the schema and UI. Kept here (framework- &
// dependency-free) so both the pure engine and the app's Zod validators can
// share one source of truth. SQLite can't store native enums, so these back
// plain String columns.

export const TAXON_RANKS = [
  "FAMILY",
  "SUBFAMILY",
  "TRIBE",
  "SUBTRIBE",
  "GENUS",
  "SPECIES",
  "GREX",
  "CULTIVAR",
] as const;
export type TaxonRank = (typeof TAXON_RANKS)[number];

export const CROSS_TYPES = [
  "INTRASPECIFIC",
  "INTERSPECIFIC",
  "INTERGENERIC",
  "MULTIGENERIC",
] as const;
export type CrossType = (typeof CROSS_TYPES)[number];

export const CROSS_STATUSES = [
  "PLANNED",
  "POLLINATED",
  "POD_SET",
  "FLASKED",
  "SEEDLINGS",
  "BLOOMED",
  "FAILED",
  "ABANDONED",
] as const;
export type CrossStatus = (typeof CROSS_STATUSES)[number];

export const POLLINATION_METHODS = [
  "STANDARD",
  "RECIPROCAL",
  "MENTOR_POLLEN",
  "MIXED_POLLEN",
  "REPEAT",
] as const;

export const SEED_METHODS = [
  "GREEN_POD",
  "DRY_SEED",
  "SYMBIOTIC",
  "ASYMBIOTIC",
] as const;

export const INTERVENTION_TYPES = [
  "EMBRYO_RESCUE",
  "GREEN_POD_FLASK",
  "RECIPROCAL_CROSS",
  "MENTOR_POLLEN",
  "MIXED_POLLEN",
  "STIGMA_PREP",
  "TIMING_ADJUST",
  "PLOIDY_CONVERSION",
  "GROWTH_REGULATOR",
  "POLLEN_STORAGE",
  "OTHER",
] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const CULTURE_PARAMETERS = [
  "TEMPERATURE",
  "LIGHT",
  "WATER",
  "HUMIDITY",
  "MEDIA",
  "FERTILIZER",
  "POTTING",
  "REST_PERIOD",
  "AIR_MOVEMENT",
  "OTHER",
] as const;
export type CultureParameter = (typeof CULTURE_PARAMETERS)[number];

export const OUTCOMES = ["POSITIVE", "NEGATIVE", "NEUTRAL", "UNKNOWN"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const INTERVENTION_OUTCOMES = [
  "SUCCESS",
  "PARTIAL",
  "FAILURE",
  "UNKNOWN",
] as const;

export const CONFIDENCE_LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const USER_ROLES = [
  "ADMIN",
  "COORDINATOR",
  "CONTRIBUTOR",
  "VIEWER",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SOURCE_TYPES = [
  "JOURNAL",
  "BOOK",
  "WEBSITE",
  "DATABASE",
  "PERSONAL_COMM",
  "OTHER",
] as const;

export const LICENSES = [
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC-BY-NC-4.0",
  "PUBLIC_DOMAIN",
  "USER_OWNED",
  "ALL_RIGHTS_RESERVED",
  "UNKNOWN",
] as const;

export const KNOWLEDGE_CATEGORIES = [
  "CULTURE",
  "VIABILITY",
  "INTERVENTION",
  "TAXONOMY",
  "GENERAL",
] as const;

export const TAXON_SCOPES = ["SPECIES", "GENUS", "SUBTRIBE", "GENERAL"] as const;

export const INTAKE_KINDS = ["OBSERVATION", "CROSS", "PLANT", "NOTE"] as const;
export const INTAKE_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
