import { prisma } from "@db/client";
import { createObservation } from "@/lib/actions";
import { CULTURE_PARAMETERS, OUTCOMES } from "@engine/enums";
import {
  Card,
  Field,
  Select,
  TextArea,
  ErrorBanner,
  enumOptions,
  prettyEnum,
} from "@/components/ui";

export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [observations, taxa, growers] = await Promise.all([
    prisma.cultureObservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { taxon: true, grower: true },
    }),
    prisma.taxon.findMany({
      where: { rank: { in: ["SPECIES", "GENUS", "GREX"] } },
      orderBy: { name: "asc" },
    }),
    prisma.grower.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Culture log</h1>
      <p className="lead">
        First-hand culture observations. Every record — especially the ones marked
        positive or negative — sharpens the culture-tip suggestions.
      </p>
      <ErrorBanner error={error} />

      <Card title="Record an observation">
        <form className="stack" action={createObservation}>
          <div className="row">
            <Select
              label="Taxon"
              name="taxonId"
              includeBlank="— select taxon —"
              options={taxa.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              label="Grower"
              name="growerId"
              includeBlank="— optional —"
              options={growers.map((g) => ({ value: g.id, label: g.name }))}
            />
          </div>
          <div className="row">
            <Select
              label="Parameter"
              name="parameter"
              required
              options={enumOptions(CULTURE_PARAMETERS)}
            />
            <Select
              label="Outcome"
              name="outcome"
              options={enumOptions(OUTCOMES)}
              defaultValue="POSITIVE"
              hint="did it work?"
            />
          </div>
          <Field
            label="Value / recommendation"
            name="valueText"
            required
            hint="e.g. bright filtered light; cool nights"
          />
          <Field label="Context" name="context" hint="e.g. winter; during spike" />
          <TextArea label="Notes" name="notes" />
          <button type="submit">Add observation</button>
        </form>
      </Card>

      <Card title={`${observations.length} recent record(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Taxon</th>
                <th>Parameter</th>
                <th>Value</th>
                <th>Outcome</th>
                <th>Grower</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <em>{o.taxon?.name || "—"}</em>
                  </td>
                  <td>{prettyEnum(o.parameter)}</td>
                  <td>{o.valueText}</td>
                  <td>
                    <span className={`badge ${o.outcome === "POSITIVE" ? "ok" : ""}`}>
                      {o.outcome}
                    </span>
                  </td>
                  <td className="muted">{o.grower?.name || "—"}</td>
                </tr>
              ))}
              {observations.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No observations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
