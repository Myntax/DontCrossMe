import { prisma } from "@db/client";
import { createPlant } from "@/lib/actions";
import { Card, Field, Select, TextArea, ErrorBanner } from "@/components/ui";

export default async function PlantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [plants, taxa, growers] = await Promise.all([
    prisma.plant.findMany({
      orderBy: { createdAt: "desc" },
      include: { taxon: true, grower: true },
    }),
    prisma.taxon.findMany({
      where: { rank: { in: ["SPECIES", "GENUS", "GREX", "CULTIVAR"] } },
      orderBy: { name: "asc" },
    }),
    prisma.grower.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Plants</h1>
      <p className="lead">Specific plants held by growers — the parents of your crosses.</p>
      <ErrorBanner error={error} />

      <Card title={`${plants.length} plant(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Taxon</th>
                <th>Clone</th>
                <th>Grower</th>
                <th>Accession</th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id}>
                  <td>
                    <em>{p.taxon.name}</em>
                  </td>
                  <td>{p.clonalName ? `'${p.clonalName}'` : "—"}</td>
                  <td className="muted">{p.grower?.name || "—"}</td>
                  <td className="mono">{p.accessionCode || "—"}</td>
                </tr>
              ))}
              {plants.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No plants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a plant">
        <form className="stack" action={createPlant}>
          <Select
            label="Taxon"
            name="taxonId"
            required
            includeBlank="— select taxon —"
            options={taxa.map((t) => ({ value: t.id, label: `${t.name} (${t.rank})` }))}
          />
          <div className="row">
            <Field label="Clone / cultivar name" name="clonalName" hint="e.g. Coastal Queen" />
            <Field label="Accession code" name="accessionCode" />
          </div>
          <Select
            label="Grower"
            name="growerId"
            includeBlank="— unassigned —"
            options={growers.map((g) => ({ value: g.id, label: g.name }))}
          />
          <div className="row">
            <Field label="Source" name="source" hint="where it came from" />
            <Field label="Location" name="location" />
          </div>
          <TextArea label="Notes" name="notes" />
          <button type="submit">Add plant</button>
        </form>
      </Card>
    </div>
  );
}
