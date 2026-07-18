// Seed a small, realistic slice of orchid taxonomy plus enough breeding data to
// make the suggestion engine produce meaningful output out of the box.
// Idempotent: safe to re-run (uses upserts on fixed ids).

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: "org_default" },
    update: {},
    create: { id: "org_default", name: process.env.SOCIETY_NAME || "My Orchid Society" },
  });

  const adminEmail = process.env.ADMIN_EMAIL || "coordinator@example.org";
  const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Coordinator",
      role: "ADMIN",
      passwordHash: hashPassword(adminPassword),
    },
  });

  // --- Taxonomy -----------------------------------------------------------
  const taxa: {
    id: string;
    name: string;
    rank: string;
    parentId?: string;
    chromosomeCount?: number;
    ploidy?: string;
    isHybrid?: boolean;
    seedParentTaxonId?: string;
    pollenParentTaxonId?: string;
    nativeRange?: string;
  }[] = [
    { id: "t_orchidaceae", name: "Orchidaceae", rank: "FAMILY" },
    { id: "t_epidendroideae", name: "Epidendroideae", rank: "SUBFAMILY", parentId: "t_orchidaceae" },
    { id: "t_laeliinae", name: "Laeliinae", rank: "SUBTRIBE", parentId: "t_epidendroideae" },
    { id: "t_cattleya", name: "Cattleya", rank: "GENUS", parentId: "t_laeliinae", chromosomeCount: 40, ploidy: "2n=2x=40" },
    { id: "t_c_labiata", name: "Cattleya labiata", rank: "SPECIES", parentId: "t_cattleya", chromosomeCount: 40, ploidy: "2n=2x=40", nativeRange: "Brazil" },
    { id: "t_c_mossiae", name: "Cattleya mossiae", rank: "SPECIES", parentId: "t_cattleya", chromosomeCount: 40, ploidy: "2n=2x=40", nativeRange: "Venezuela" },
    { id: "t_laelia", name: "Laelia", rank: "GENUS", parentId: "t_laeliinae", chromosomeCount: 40, ploidy: "2n=2x=40" },
    { id: "t_l_purpurata", name: "Laelia purpurata", rank: "SPECIES", parentId: "t_laelia", chromosomeCount: 40, ploidy: "2n=2x=40", nativeRange: "Brazil" },
    { id: "t_cypripedioideae", name: "Cypripedioideae", rank: "SUBFAMILY", parentId: "t_orchidaceae" },
    { id: "t_paphiopedilinae", name: "Paphiopedilinae", rank: "SUBTRIBE", parentId: "t_cypripedioideae" },
    { id: "t_paph", name: "Paphiopedilum", rank: "GENUS", parentId: "t_paphiopedilinae", chromosomeCount: 26 },
    { id: "t_p_roth", name: "Paphiopedilum rothschildianum", rank: "SPECIES", parentId: "t_paph", chromosomeCount: 26, nativeRange: "Borneo" },
    { id: "t_p_sander", name: "Paphiopedilum sanderianum", rank: "SPECIES", parentId: "t_paph", chromosomeCount: 26, nativeRange: "Borneo" },
  ];

  for (const t of taxa) {
    await prisma.taxon.upsert({
      where: { id: t.id },
      update: t,
      create: { organizationId: org.id, ...t },
    });
  }

  // A registered grex giving precedent for C. labiata x C. mossiae.
  await prisma.taxon.upsert({
    where: { id: "t_grex_labmoss" },
    update: {},
    create: {
      id: "t_grex_labmoss",
      name: "Cattleya Enid",
      rank: "GREX",
      isHybrid: true,
      parentId: "t_cattleya",
      seedParentTaxonId: "t_c_labiata",
      pollenParentTaxonId: "t_c_mossiae",
      rhsGrexId: "demo-enid",
      organizationId: org.id,
    },
  });

  // --- People & plants ----------------------------------------------------
  const grower = await prisma.grower.upsert({
    where: { id: "g_jane" },
    update: {},
    create: {
      id: "g_jane",
      name: "Jane Doe",
      email: "jane@example.org",
      location: "Coastal greenhouse",
      consentToShare: true,
      organizationId: org.id,
    },
  });

  const labiata = await prisma.plant.upsert({
    where: { id: "p_labiata" },
    update: {},
    create: {
      id: "p_labiata",
      taxonId: "t_c_labiata",
      growerId: grower.id,
      clonalName: "Coastal Queen",
      organizationId: org.id,
    },
  });
  const mossiae = await prisma.plant.upsert({
    where: { id: "p_mossiae" },
    update: {},
    create: {
      id: "p_mossiae",
      taxonId: "t_c_mossiae",
      growerId: grower.id,
      clonalName: "Highland",
      organizationId: org.id,
    },
  });

  // --- A cross with real outcomes ----------------------------------------
  const cross = await prisma.cross.upsert({
    where: { id: "x_labmoss" },
    update: {},
    create: {
      id: "x_labmoss",
      code: "2024-001",
      goal: "Compact, fragrant lavender hybrid",
      status: "POD_SET",
      crossType: "INTERSPECIFIC",
      seedParentPlantId: labiata.id,
      pollenParentPlantId: mossiae.id,
      seedParentTaxonId: "t_c_labiata",
      pollenParentTaxonId: "t_c_mossiae",
      organizationId: org.id,
    },
  });
  await prisma.pollinationEvent.upsert({
    where: { id: "pe_labmoss_1" },
    update: {},
    create: {
      id: "pe_labmoss_1",
      crossId: cross.id,
      date: new Date("2024-05-01"),
      method: "STANDARD",
      operatorGrowerId: grower.id,
      success: true,
    },
  });
  await prisma.podSet.upsert({
    where: { id: "ps_labmoss_1" },
    update: {},
    create: { id: "ps_labmoss_1", crossId: cross.id, set: true, podCount: 1, matured: true },
  });

  // --- Sources with contrasting AI-use rights ----------------------------
  const restrictedSource = await prisma.source.upsert({
    where: { id: "src_iospe" },
    update: {},
    create: {
      id: "src_iospe",
      title: "Species culture notes (third-party encyclopedia)",
      type: "WEBSITE",
      license: "ALL_RIGHTS_RESERVED",
      aiUseAllowed: false,
      redistributionAllowed: false,
      commercialUseAllowed: false,
      accessNotes: "Captured manually; not to be sent to any AI model.",
      organizationId: org.id,
    },
  });
  const ownSource = await prisma.source.upsert({
    where: { id: "src_own" },
    update: {},
    create: {
      id: "src_own",
      title: "Society growing log (our own notes)",
      type: "PERSONAL_COMM",
      license: "USER_OWNED",
      aiUseAllowed: true,
      redistributionAllowed: true,
      commercialUseAllowed: true,
      organizationId: org.id,
    },
  });

  // --- Knowledge takeaways -----------------------------------------------
  await prisma.knowledgeItem.upsert({
    where: { id: "k_catt_light" },
    update: {},
    create: {
      id: "k_catt_light",
      title: "Cattleya light levels",
      takeaway: "Cattleya labiata grows best in bright, filtered light (~2500–3500 fc).",
      category: "CULTURE",
      taxonId: "t_c_labiata",
      taxonScope: "SPECIES",
      citation: "growing log, 2023",
      isUserAuthored: true,
      aiEligible: true, // user-authored + AI-allowed source
      confidence: "HIGH",
      organizationId: org.id,
      sources: { connect: [{ id: ownSource.id }] },
    },
  });
  await prisma.knowledgeItem.upsert({
    where: { id: "k_catt_rest" },
    update: {},
    create: {
      id: "k_catt_rest",
      title: "Cattleya winter rest",
      takeaway: "A slight winter reduction in water encourages spring flowering in Cattleya.",
      category: "CULTURE",
      taxonId: "t_cattleya",
      taxonScope: "GENUS",
      citation: "encyclopedia entry",
      isUserAuthored: false,
      aiEligible: false, // linked to a no-AI source
      confidence: "MEDIUM",
      organizationId: org.id,
      sources: { connect: [{ id: restrictedSource.id }] },
    },
  });

  // --- Culture observations (feed the culture-tip engine) ----------------
  const obs: { id: string; taxonId: string; parameter: string; valueText: string; outcome: string; sourceType?: string }[] = [
    { id: "o1", taxonId: "t_c_labiata", parameter: "TEMPERATURE", valueText: "intermediate (55-60F nights)", outcome: "POSITIVE" },
    { id: "o2", taxonId: "t_c_labiata", parameter: "TEMPERATURE", valueText: "intermediate (55-60F nights)", outcome: "POSITIVE" },
    { id: "o3", taxonId: "t_c_labiata", parameter: "LIGHT", valueText: "bright filtered light", outcome: "POSITIVE" },
    { id: "o4", taxonId: "t_c_labiata", parameter: "WATER", valueText: "dry slightly between waterings", outcome: "POSITIVE" },
    { id: "o5", taxonId: "t_c_labiata", parameter: "WATER", valueText: "keep constantly wet", outcome: "NEGATIVE" },
    // genus-level evidence used to infer tips for C. mossiae:
    { id: "o6", taxonId: "t_c_mossiae", parameter: "LIGHT", valueText: "bright filtered light", outcome: "POSITIVE" },
  ];
  for (const o of obs) {
    await prisma.cultureObservation.upsert({
      where: { id: o.id },
      update: {},
      create: {
        id: o.id,
        taxonId: o.taxonId,
        growerId: grower.id,
        parameter: o.parameter,
        valueText: o.valueText,
        outcome: o.outcome,
        sourceType: o.sourceType || "OBSERVATION",
        organizationId: org.id,
      },
    });
  }

  // --- A logged intervention (feeds the intervention learner) -------------
  await prisma.intervention.upsert({
    where: { id: "iv_1" },
    update: {},
    create: {
      id: "iv_1",
      crossId: cross.id,
      type: "TIMING_ADJUST",
      outcome: "SUCCESS",
      notes: "Pollinated 4 days after anthesis; pod set cleanly.",
    },
  });

  console.log("Seed complete:");
  console.log(`  org: ${org.name}`);
  console.log(`  admin: ${adminEmail}`);
  console.log(`  taxa: ${taxa.length + 1}, grower: ${grower.name}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
