import { notFound } from "next/navigation";
import { prisma } from "@db/client";
import { assessCross } from "@/lib/suggestions";
import { appConfig } from "@/lib/config";
import { addPollination, addPodSet, addIntervention } from "@/lib/actions";
import { INTERVENTION_OUTCOMES, POLLINATION_METHODS } from "@engine/enums";
import {
  Card,
  Field,
  Select,
  TextArea,
  Checkbox,
  ConfidenceBadge,
  enumOptions,
  prettyEnum,
} from "@/components/ui";

export default async function CrossDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cross = await prisma.cross.findUnique({
    where: { id },
    include: {
      seedParentPlant: { include: { taxon: true } },
      pollenParentPlant: { include: { taxon: true } },
      seedParentTaxon: true,
      pollenParentTaxon: true,
      pollinations: { orderBy: { createdAt: "desc" }, include: { operatorGrower: true } },
      podSets: { orderBy: { createdAt: "desc" } },
      interventions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!cross) notFound();

  const seedTaxonId = cross.seedParentPlant?.taxonId ?? cross.seedParentTaxonId ?? null;
  const pollenTaxonId = cross.pollenParentPlant?.taxonId ?? cross.pollenParentTaxonId ?? null;
  const seedName = cross.seedParentPlant?.taxon.name ?? cross.seedParentTaxon?.name ?? "?";
  const pollenName = cross.pollenParentPlant?.taxon.name ?? cross.pollenParentTaxon?.name ?? "?";

  const assessment =
    seedTaxonId && pollenTaxonId ? await assessCross(seedTaxonId, pollenTaxonId) : null;

  const growers = await prisma.grower.findMany({ orderBy: { name: "asc" } });
  const techniques = await prisma.interventionTechnique.findMany({
    where: { isActive: true },
    orderBy: { label: "asc" },
  });

  return (
    <div>
      <p className="muted">
        <a href="/crosses">← Crosses</a>
      </p>
      <h1>
        <em>{seedName}</em> × <em>{pollenName}</em>
      </h1>
      <div className="pill-row" style={{ marginBottom: "1rem" }}>
        <span className="badge">{cross.code || cross.id.slice(0, 6)}</span>
        <span className="badge">{cross.crossType || "type unknown"}</span>
        <span className="badge">{cross.status}</span>
      </div>
      {cross.goal && <p className="lead">Goal: {cross.goal}</p>}

      {assessment ? (
        <Card
          title="Cross-viability assessment"
          actions={<ConfidenceBadge level={assessment.viability.confidence} />}
        >
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <div>
              <div className="score-big">{assessment.viability.score}</div>
              <div className="stat-label">out of 100</div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ marginTop: 0 }}>{assessment.viability.summary}</p>
            </div>
          </div>

          <h3>Why this score</h3>
          {assessment.viability.factors.map((f, i) => (
            <div className="factor" key={i}>
              <span>
                <strong>{f.label}.</strong> {f.detail}
              </span>
              <span className={`contrib ${f.contribution >= 0 ? "pos" : "neg"}`}>
                {f.contribution >= 0 ? "+" : ""}
                {f.contribution}
              </span>
            </div>
          ))}

          <h3>
            Guidance{" "}
            <span className={`badge ${assessment.narrative.aiUsed ? "ai-on" : "ai-off"}`}>
              {assessment.narrative.aiUsed ? `AI: ${appConfig.aiModel}` : "deterministic"}
            </span>
          </h3>
          <div className="narrative">{assessment.narrative.narrative}</div>
          {assessment.narrative.note && (
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              {assessment.narrative.note}
            </p>
          )}
        </Card>
      ) : (
        <Card title="Cross-viability assessment">
          <p className="muted">
            Set both parents (as plants or taxa) to compute a viability assessment.
          </p>
        </Card>
      )}

      {assessment && assessment.interventions.length > 0 && (
        <Card title="Suggested interventions">
          <p className="muted" style={{ marginTop: 0 }}>
            Ranked for this cross type and viability. Log the ones you try below —
            the ranking learns from your results over time.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Technique</th>
                  <th>Why</th>
                  <th>Local track record</th>
                </tr>
              </thead>
              <tbody>
                {assessment.interventions.slice(0, 6).map((s) => (
                  <tr key={s.type}>
                    <td>
                      <strong>{s.label}</strong>
                      <div className="muted" style={{ fontSize: "0.82rem" }}>
                        {s.description}
                      </div>
                    </td>
                    <td className="muted">{s.rationale}</td>
                    <td>
                      {s.observed
                        ? `${s.observed.successes}/${s.observed.attempts}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card title="Log a pollination">
          <form className="stack" action={addPollination}>
            <input type="hidden" name="crossId" value={cross.id} />
            <Field label="Date" name="date" type="date" />
            <Select
              label="Method"
              name="method"
              options={enumOptions(POLLINATION_METHODS)}
              defaultValue="STANDARD"
            />
            <Select
              label="Operator"
              name="operatorGrowerId"
              includeBlank="— who did it —"
              options={growers.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Select
              label="Initial take?"
              name="success"
              includeBlank="— unknown —"
              options={[
                { value: "true", label: "Yes — pod forming" },
                { value: "false", label: "No — failed" },
              ]}
            />
            <button type="submit">Record pollination</button>
          </form>
        </Card>

        <Card title="Log pod set / outcome">
          <form className="stack" action={addPodSet}>
            <input type="hidden" name="crossId" value={cross.id} />
            <Checkbox label="Pod set (capsule formed)" name="set" />
            <div className="row">
              <Field label="Pod count" name="podCount" type="number" />
            </div>
            <Checkbox label="Matured to dehiscence" name="matured" />
            <TextArea label="Notes" name="notes" />
            <button type="submit">Record outcome</button>
          </form>
        </Card>
      </div>

      <Card title="Log an intervention">
        <form className="stack" action={addIntervention}>
          <input type="hidden" name="crossId" value={cross.id} />
          <div className="row">
            <Select
              label="Technique"
              name="type"
              required
              includeBlank="— select technique —"
              options={techniques.map((t) => ({ value: t.key, label: t.label }))}
            />
            <Select
              label="Outcome"
              name="outcome"
              options={enumOptions(INTERVENTION_OUTCOMES)}
              defaultValue="UNKNOWN"
            />
          </div>
          <TextArea label="Notes" name="notes" />
          <button type="submit">Record intervention</button>
        </form>
      </Card>

      <Card title="History">
        <h3>Pollinations</h3>
        {cross.pollinations.length === 0 ? (
          <p className="muted">None logged.</p>
        ) : (
          <ul>
            {cross.pollinations.map((p) => (
              <li key={p.id}>
                {p.date ? new Date(p.date).toLocaleDateString() : "date?"} ·{" "}
                {prettyEnum(p.method)} ·{" "}
                {p.success === true ? "took" : p.success === false ? "failed" : "pending"}
                {p.operatorGrower ? ` · ${p.operatorGrower.name}` : ""}
              </li>
            ))}
          </ul>
        )}
        <h3>Pod sets</h3>
        {cross.podSets.length === 0 ? (
          <p className="muted">None logged.</p>
        ) : (
          <ul>
            {cross.podSets.map((p) => (
              <li key={p.id}>
                {p.set ? "Set" : "No set"}
                {p.podCount ? ` · ${p.podCount} pod(s)` : ""}
                {p.matured ? " · matured" : ""}
              </li>
            ))}
          </ul>
        )}
        <h3>Interventions</h3>
        {cross.interventions.length === 0 ? (
          <p className="muted">None logged.</p>
        ) : (
          <ul>
            {cross.interventions.map((iv) => (
              <li key={iv.id}>
                {prettyEnum(iv.type)} — <span className="badge">{iv.outcome}</span>
                {iv.notes ? ` · ${iv.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
