import { prisma } from "@db/client";
import { cultureTips, assessCross } from "@/lib/suggestions";
import { appConfig } from "@/lib/config";
import { Card, Select, ConfidenceBadge, prettyEnum } from "@/components/ui";

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    cultureTaxon?: string;
    seed?: string;
    pollen?: string;
  }>;
}) {
  const sp = await searchParams;
  const taxa = await prisma.taxon.findMany({
    where: { rank: { in: ["SPECIES", "GENUS", "GREX"] } },
    orderBy: { name: "asc" },
  });
  const taxonOpts = taxa.map((t) => ({ value: t.id, label: `${t.name} (${t.rank})` }));

  const culture = sp.cultureTaxon ? await cultureTips(sp.cultureTaxon) : null;
  const cultureTaxonName = taxa.find((t) => t.id === sp.cultureTaxon)?.name;

  const assessment =
    sp.seed && sp.pollen ? await assessCross(sp.seed, sp.pollen) : null;
  const seedName = taxa.find((t) => t.id === sp.seed)?.name;
  const pollenName = taxa.find((t) => t.id === sp.pollen)?.name;

  return (
    <div>
      <h1>Suggestions</h1>
      <p className="lead">
        Ask the engine for culture tips or a cross-viability read on any pairing —
        including ones you haven&apos;t recorded yet.{" "}
        <span className={`badge ${appConfig.aiEnabled ? "ai-on" : "ai-off"}`}>
          AI {appConfig.aiEnabled ? "on" : "off"}
        </span>
      </p>

      <Card title="Culture tips for an (uncommon) orchid">
        <form
          method="get"
          className="stack"
          style={{ flexDirection: "row", alignItems: "flex-end", gap: "0.7rem" }}
        >
          <div style={{ flex: 1 }}>
            <Select
              label="Taxon"
              name="cultureTaxon"
              includeBlank="— select taxon —"
              options={taxonOpts}
              defaultValue={sp.cultureTaxon}
            />
          </div>
          {sp.seed && <input type="hidden" name="seed" value={sp.seed} />}
          {sp.pollen && <input type="hidden" name="pollen" value={sp.pollen} />}
          <button type="submit">Get tips</button>
        </form>

        {culture && (
          <div style={{ marginTop: "1rem" }}>
            <h3>{cultureTaxonName}</h3>
            {culture.tips.length === 0 ? (
              <p className="muted">
                No culture evidence recorded yet for this taxon or its genus. Add
                observations or takeaways and check back.
              </p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Recommendation</th>
                      <th>Confidence</th>
                      <th>Basis</th>
                      <th>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {culture.tips.map((t) => (
                      <tr key={t.parameter}>
                        <td>{prettyEnum(t.parameter)}</td>
                        <td>{t.recommendation}</td>
                        <td>
                          <span className={`badge ${t.confidence}`}>{t.confidence}</span>
                        </td>
                        <td className="muted">
                          {t.basis === "GENUS_INFERRED" ? "inferred from genus" : "direct"}
                        </td>
                        <td>
                          {t.supportingCount} ({t.positiveCount}+/{t.negativeCount}−)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3>
              Guidance{" "}
              <span className={`badge ${culture.narrative.aiUsed ? "ai-on" : "ai-off"}`}>
                {culture.narrative.aiUsed ? `AI: ${appConfig.aiModel}` : "deterministic"}
              </span>
            </h3>
            <div className="narrative">{culture.narrative.narrative}</div>
          </div>
        )}
      </Card>

      <Card title="Cross-viability calculator">
        <form
          method="get"
          className="stack"
          style={{ flexDirection: "row", alignItems: "flex-end", gap: "0.7rem", flexWrap: "wrap" }}
        >
          {sp.cultureTaxon && (
            <input type="hidden" name="cultureTaxon" value={sp.cultureTaxon} />
          )}
          <div style={{ flex: 1, minWidth: 200 }}>
            <Select
              label="Seed parent"
              name="seed"
              includeBlank="— select —"
              options={taxonOpts}
              defaultValue={sp.seed}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Select
              label="Pollen parent"
              name="pollen"
              includeBlank="— select —"
              options={taxonOpts}
              defaultValue={sp.pollen}
            />
          </div>
          <button type="submit">Assess</button>
        </form>

        {assessment && (
          <div style={{ marginTop: "1rem" }}>
            <div className="topbar">
              <h3 style={{ margin: 0 }}>
                <em>{seedName}</em> × <em>{pollenName}</em>
              </h3>
              <ConfidenceBadge level={assessment.viability.confidence} />
            </div>
            <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
              <div>
                <div className="score-big">{assessment.viability.score}</div>
                <div className="stat-label">out of 100</div>
              </div>
              <p style={{ flex: 1 }}>{assessment.viability.summary}</p>
            </div>
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
            {assessment.interventions.length > 0 && (
              <>
                <h3>Suggested interventions</h3>
                <ul>
                  {assessment.interventions.slice(0, 5).map((s) => (
                    <li key={s.type}>
                      <strong>{s.label}</strong> — {s.description}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
