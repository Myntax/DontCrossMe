import { prisma } from "@db/client";
import { createCross } from "@/lib/actions";
import { Card, Field, Select, TextArea, ErrorBanner } from "@/components/ui";

export default async function CrossesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [crosses, plants, taxa] = await Promise.all([
    prisma.cross.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        seedParentPlant: { include: { taxon: true } },
        pollenParentPlant: { include: { taxon: true } },
        seedParentTaxon: true,
        pollenParentTaxon: true,
      },
    }),
    prisma.plant.findMany({ include: { taxon: true }, orderBy: { createdAt: "desc" } }),
    prisma.taxon.findMany({
      where: { rank: { in: ["SPECIES", "GENUS", "GREX"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  const plantOpts = plants.map((p) => ({
    value: p.id,
    label: `${p.taxon.name}${p.clonalName ? ` '${p.clonalName}'` : ""}`,
  }));
  const taxonOpts = taxa.map((t) => ({ value: t.id, label: `${t.name} (${t.rank})` }));

  return (
    <div>
      <h1>Crosses</h1>
      <p className="lead">
        Plan and track crosses. Pick specific plants where you have them, or taxa
        when you don&apos;t. The cross type and a viability assessment are computed
        automatically.
      </p>
      <ErrorBanner error={error} />

      <Card title={`${crosses.length} cross(es)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Seed parent</th>
                <th>Pollen parent</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {crosses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/crosses/${c.id}`}>{c.code || c.id.slice(0, 6)}</a>
                  </td>
                  <td>
                    <em>
                      {c.seedParentPlant?.taxon.name ?? c.seedParentTaxon?.name ?? "?"}
                    </em>
                  </td>
                  <td>
                    <em>
                      {c.pollenParentPlant?.taxon.name ?? c.pollenParentTaxon?.name ?? "?"}
                    </em>
                  </td>
                  <td>
                    <span className="badge">{c.crossType || "—"}</span>
                  </td>
                  <td>
                    <span className="badge">{c.status}</span>
                  </td>
                </tr>
              ))}
              {crosses.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No crosses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Plan a cross">
        <form className="stack" action={createCross}>
          <Field label="Code / label" name="code" hint="optional, e.g. 2024-001" />
          <h3>Seed parent (pod)</h3>
          <div className="row">
            <Select
              label="Plant"
              name="seedParentPlantId"
              includeBlank="— by plant —"
              options={plantOpts}
            />
            <Select
              label="…or taxon"
              name="seedParentTaxonId"
              includeBlank="— by taxon —"
              options={taxonOpts}
            />
          </div>
          <h3>Pollen parent</h3>
          <div className="row">
            <Select
              label="Plant"
              name="pollenParentPlantId"
              includeBlank="— by plant —"
              options={plantOpts}
            />
            <Select
              label="…or taxon"
              name="pollenParentTaxonId"
              includeBlank="— by taxon —"
              options={taxonOpts}
            />
          </div>
          <TextArea label="Goal" name="goal" hint="what you're breeding for" />
          <button type="submit">Create cross</button>
        </form>
      </Card>
    </div>
  );
}
