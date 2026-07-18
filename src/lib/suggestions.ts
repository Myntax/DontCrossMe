// The suggestion service: it wires the DB adapter → pure engine → (optional) AI
// narrative. Pages call these functions. With AI off (the default) they return
// the engine's deterministic, cited output; with AI on, a narrative is layered
// on top using only licensing-gate-approved evidence.

import { prisma } from "@db/client";
import {
  buildTaxonInfo,
  getPairOutcomes,
  getSimilarOutcomes,
  getPrecedent,
  getInterventionHistory,
  getCultureRecords,
} from "@db/evidence-adapter";
import {
  assessViability,
  rankCultureTips,
  suggestInterventions,
  type ViabilityResult,
  type CultureTip,
  type InterventionSuggestion,
} from "@engine/index";
import { getAiProvider, type EvidenceSnippet, type SynthesisResult } from "@ai/index";
import { appConfig } from "./config";

async function knowledgeSnippets(
  taxonId: string | null | undefined,
  category?: string,
): Promise<EvidenceSnippet[]> {
  if (!taxonId) return [];
  const items = await prisma.knowledgeItem.findMany({
    where: { taxonId, ...(category ? { category } : {}) },
    include: { sources: true },
    take: 20,
  });
  return items.map((k) => ({
    id: k.id,
    text: k.takeaway,
    aiEligible: k.aiEligible,
    citation: k.citation ?? undefined,
    sourceTitle: k.sources[0]?.title,
  }));
}

export interface CrossAssessment {
  viability: ViabilityResult;
  interventions: InterventionSuggestion[];
  narrative: SynthesisResult;
}

export async function assessCross(
  seedTaxonId: string,
  pollenTaxonId: string,
): Promise<CrossAssessment | null> {
  const seed = await buildTaxonInfo(seedTaxonId);
  const pollen = await buildTaxonInfo(pollenTaxonId);
  if (!seed || !pollen) return null;

  const precedent = await getPrecedent(seedTaxonId, pollenTaxonId);
  const programOutcomes = await getPairOutcomes(seedTaxonId, pollenTaxonId);

  // Compute the relation first to pick the right "similar" prior.
  const pre = assessViability({ seedParent: seed, pollenParent: pollen, precedent });
  const similarOutcomes = await getSimilarOutcomes(pre.crossType);

  const viability = assessViability({
    seedParent: seed,
    pollenParent: pollen,
    precedent,
    programOutcomes,
    similarOutcomes,
  });

  const history = await getInterventionHistory();
  const interventions = suggestInterventions({
    crossType: viability.crossType,
    viabilityScore: viability.score,
    history,
  });

  const provider = getAiProvider();
  const evidence = [
    ...(await knowledgeSnippets(seedTaxonId, "VIABILITY")),
    ...(await knowledgeSnippets(pollenTaxonId, "VIABILITY")),
  ];
  const narrative = await provider.synthesize({
    kind: "VIABILITY",
    deterministicSummary: viability.summary,
    points: viability.factors.map((f) => `${f.label}: ${f.detail}`),
    evidence,
  });

  return { viability, interventions, narrative };
}

export interface CultureAdvice {
  tips: CultureTip[];
  narrative: SynthesisResult;
}

export async function cultureTips(taxonId: string): Promise<CultureAdvice> {
  const info = await buildTaxonInfo(taxonId);
  const genusId = info?.genusId ?? null;
  const records = await getCultureRecords(taxonId, genusId);
  const tips = rankCultureTips(taxonId, genusId, records);

  const provider = getAiProvider();
  const evidence = await knowledgeSnippets(taxonId, "CULTURE");
  const narrative = await provider.synthesize({
    kind: "CULTURE",
    deterministicSummary:
      tips.length > 0
        ? `${tips.length} culture recommendation(s) derived from ${records.length} record(s).`
        : "No culture evidence recorded yet for this taxon or its genus.",
    points: tips.map(
      (t) =>
        `${t.parameter}: ${t.recommendation} (${t.confidence.toLowerCase()} confidence, ${
          t.basis === "GENUS_INFERRED" ? "inferred from genus" : "direct evidence"
        })`,
    ),
    evidence,
  });

  return { tips, narrative };
}

export function aiStatus() {
  return { enabled: appConfig.aiEnabled, model: appConfig.aiModel };
}
