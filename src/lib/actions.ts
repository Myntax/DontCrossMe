"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@db/client";
import { buildTaxonInfo } from "@db/evidence-adapter";
import { classifyCross } from "@engine/index";
import { computeAiEligibility } from "@ai/index";
import { getCurrentUser, canEdit, canReview, login, logout } from "./auth";
import {
  growerSchema,
  taxonSchema,
  plantSchema,
  crossSchema,
  pollinationSchema,
  podSetSchema,
  interventionSchema,
  observationSchema,
  sourceSchema,
  knowledgeSchema,
  intakeSchema,
} from "./validation";

function obj(formData: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.endsWith("[]")) {
      const key = k.slice(0, -2);
      const existing = (o[key] as string[] | undefined) ?? [];
      existing.push(String(v));
      o[key] = existing;
    } else {
      o[k] = v;
    }
  }
  return o;
}

async function requireEditor() {
  const user = await getCurrentUser();
  if (!user || !canEdit(user.role)) {
    redirect("/login?error=You+need+edit+permission");
  }
  return user!;
}

function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

// --- Auth ------------------------------------------------------------------

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await login(email, password);
  if (!user) back("/login", "Invalid email or password");
  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

// --- Growers ---------------------------------------------------------------

export async function createGrower(formData: FormData) {
  await requireEditor();
  const parsed = growerSchema.safeParse(obj(formData));
  if (!parsed.success) back("/growers", parsed.error.issues[0].message);
  await prisma.grower.create({
    data: { ...parsed.data, organizationId: "org_default" },
  });
  revalidatePath("/growers");
  redirect("/growers");
}

// --- Taxa ------------------------------------------------------------------

export async function createTaxon(formData: FormData) {
  await requireEditor();
  const parsed = taxonSchema.safeParse(obj(formData));
  if (!parsed.success) back("/taxa", parsed.error.issues[0].message);
  const { parentId, ...rest } = parsed.data;
  await prisma.taxon.create({
    data: {
      ...rest,
      parentId: parentId || null,
      organizationId: "org_default",
    },
  });
  revalidatePath("/taxa");
  redirect("/taxa");
}

// --- Plants ----------------------------------------------------------------

export async function createPlant(formData: FormData) {
  await requireEditor();
  const parsed = plantSchema.safeParse(obj(formData));
  if (!parsed.success) back("/plants", parsed.error.issues[0].message);
  const { growerId, ...rest } = parsed.data;
  await prisma.plant.create({
    data: { ...rest, growerId: growerId || null, organizationId: "org_default" },
  });
  revalidatePath("/plants");
  redirect("/plants");
}

// --- Crosses ---------------------------------------------------------------

async function resolveTaxonId(
  plantId?: string,
  taxonId?: string,
): Promise<string | undefined> {
  if (taxonId) return taxonId;
  if (plantId) {
    const p = await prisma.plant.findUnique({ where: { id: plantId } });
    return p?.taxonId;
  }
  return undefined;
}

export async function createCross(formData: FormData) {
  const user = await requireEditor();
  const parsed = crossSchema.safeParse(obj(formData));
  if (!parsed.success) back("/crosses", parsed.error.issues[0].message);
  const d = parsed.data;

  const seedTaxonId = await resolveTaxonId(d.seedParentPlantId, d.seedParentTaxonId);
  const pollenTaxonId = await resolveTaxonId(d.pollenParentPlantId, d.pollenParentTaxonId);

  let crossType: string | undefined;
  if (seedTaxonId && pollenTaxonId) {
    const a = await buildTaxonInfo(seedTaxonId);
    const b = await buildTaxonInfo(pollenTaxonId);
    if (a && b) crossType = classifyCross(a, b).crossType;
  }

  const cross = await prisma.cross.create({
    data: {
      code: d.code,
      goal: d.goal,
      status: d.status ?? "PLANNED",
      notes: d.notes,
      seedParentPlantId: d.seedParentPlantId || null,
      pollenParentPlantId: d.pollenParentPlantId || null,
      seedParentTaxonId: seedTaxonId || null,
      pollenParentTaxonId: pollenTaxonId || null,
      crossType,
      createdById: user.id,
      organizationId: "org_default",
    },
  });
  revalidatePath("/crosses");
  redirect(`/crosses/${cross.id}`);
}

export async function addPollination(formData: FormData) {
  await requireEditor();
  const parsed = pollinationSchema.safeParse(obj(formData));
  if (!parsed.success) back("/crosses", parsed.error.issues[0].message);
  const d = parsed.data;
  await prisma.pollinationEvent.create({
    data: {
      crossId: d.crossId,
      date: d.date ? new Date(d.date) : null,
      method: d.method ?? "STANDARD",
      operatorGrowerId: d.operatorGrowerId || null,
      pollenSource: d.pollenSource,
      success: d.success === "true" ? true : d.success === "false" ? false : null,
      notes: d.notes,
    },
  });
  if (d.success === "true") {
    await prisma.cross.update({
      where: { id: d.crossId },
      data: { status: "POLLINATED" },
    });
  }
  revalidatePath(`/crosses/${d.crossId}`);
  redirect(`/crosses/${d.crossId}`);
}

export async function addPodSet(formData: FormData) {
  await requireEditor();
  const parsed = podSetSchema.safeParse(obj(formData));
  if (!parsed.success) back("/crosses", parsed.error.issues[0].message);
  const d = parsed.data;
  await prisma.podSet.create({
    data: {
      crossId: d.crossId,
      set: !!d.set,
      podCount: d.podCount,
      matured: d.matured,
      notes: d.notes,
    },
  });
  if (d.set) {
    await prisma.cross.update({
      where: { id: d.crossId },
      data: { status: "POD_SET" },
    });
  }
  revalidatePath(`/crosses/${d.crossId}`);
  redirect(`/crosses/${d.crossId}`);
}

export async function addIntervention(formData: FormData) {
  await requireEditor();
  const parsed = interventionSchema.safeParse(obj(formData));
  if (!parsed.success) back("/crosses", parsed.error.issues[0].message);
  const d = parsed.data;
  await prisma.intervention.create({
    data: {
      crossId: d.crossId || null,
      type: d.type,
      outcome: d.outcome ?? "UNKNOWN",
      notes: d.notes,
    },
  });
  if (d.crossId) revalidatePath(`/crosses/${d.crossId}`);
  redirect(d.crossId ? `/crosses/${d.crossId}` : "/crosses");
}

// --- Observations ----------------------------------------------------------

export async function createObservation(formData: FormData) {
  await requireEditor();
  const parsed = observationSchema.safeParse(obj(formData));
  if (!parsed.success) back("/observations", parsed.error.issues[0].message);
  const d = parsed.data;
  await prisma.cultureObservation.create({
    data: {
      taxonId: d.taxonId || null,
      plantId: d.plantId || null,
      growerId: d.growerId || null,
      parameter: d.parameter,
      valueText: d.valueText,
      context: d.context,
      outcome: d.outcome ?? "UNKNOWN",
      notes: d.notes,
      organizationId: "org_default",
    },
  });
  revalidatePath("/observations");
  redirect("/observations");
}

// --- Knowledge -------------------------------------------------------------

export async function createSource(formData: FormData) {
  await requireEditor();
  const parsed = sourceSchema.safeParse(obj(formData));
  if (!parsed.success) back("/knowledge", parsed.error.issues[0].message);
  await prisma.source.create({
    data: { ...parsed.data, organizationId: "org_default" },
  });
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

export async function createKnowledge(formData: FormData) {
  const user = await requireEditor();
  const parsed = knowledgeSchema.safeParse(obj(formData));
  if (!parsed.success) back("/knowledge", parsed.error.issues[0].message);
  const d = parsed.data;

  const sourceIds = d.sourceIds ?? [];
  const sources = sourceIds.length
    ? await prisma.source.findMany({ where: { id: { in: sourceIds } } })
    : [];
  const isUserAuthored = d.isUserAuthored ?? true;
  // The licensing gate decides AI-eligibility at creation time.
  const aiEligible = computeAiEligibility(
    isUserAuthored,
    sources.map((s) => s.aiUseAllowed),
  );

  await prisma.knowledgeItem.create({
    data: {
      title: d.title,
      takeaway: d.takeaway,
      category: d.category ?? "GENERAL",
      taxonId: d.taxonId || null,
      taxonScope: d.taxonScope ?? "GENERAL",
      citation: d.citation,
      isUserAuthored,
      aiEligible,
      confidence: d.confidence ?? "MEDIUM",
      authoredByUserId: user.id,
      organizationId: "org_default",
      sources: sourceIds.length
        ? { connect: sourceIds.map((id) => ({ id })) }
        : undefined,
    },
  });
  revalidatePath("/knowledge");
  redirect("/knowledge");
}

// --- Intake (account-less) -------------------------------------------------

export async function submitIntake(formData: FormData) {
  // Intentionally NOT gated by auth — this is the account-less member channel.
  const raw = obj(formData);
  const kind = String(raw.kind ?? "OBSERVATION");
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("p_")) payload[k.slice(2)] = v;
  }
  const parsed = intakeSchema.safeParse({
    submitterName: raw.submitterName,
    submitterEmail: raw.submitterEmail,
    growerId: raw.growerId,
    kind,
    payload,
  });
  if (!parsed.success) back("/intake", parsed.error.issues[0].message);
  const d = parsed.data;
  await prisma.intakeSubmission.create({
    data: {
      submitterName: d.submitterName,
      submitterEmail: d.submitterEmail,
      growerId: d.growerId || null,
      kind: d.kind,
      payloadJson: JSON.stringify(d.payload),
    },
  });
  redirect("/intake?submitted=1");
}

export async function reviewIntake(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canReview(user.role)) redirect("/login?error=Review+permission+required");
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const submission = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!submission) back("/intake-review", "Submission not found");

  if (decision === "approve") {
    const payload = JSON.parse(submission!.payloadJson || "{}");
    if (submission!.kind === "OBSERVATION" && payload.parameter && payload.valueText) {
      await prisma.cultureObservation.create({
        data: {
          taxonId: payload.taxonId || null,
          growerId: submission!.growerId,
          parameter: payload.parameter,
          valueText: payload.valueText,
          outcome: payload.outcome || "UNKNOWN",
          context: payload.context || null,
          organizationId: "org_default",
        },
      });
    }
    // (CROSS / PLANT / NOTE kinds are recorded but promoted manually in v1.)
  }

  await prisma.intakeSubmission.update({
    where: { id },
    data: {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath("/intake-review");
  redirect("/intake-review");
}
