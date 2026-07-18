import { prisma } from "@db/client";
import { Card } from "@/components/ui";
import { appConfig } from "@/lib/config";

export default async function DashboardPage() {
  const [growers, plants, taxa, crosses, observations, knowledge, pending] =
    await Promise.all([
      prisma.grower.count(),
      prisma.plant.count(),
      prisma.taxon.count(),
      prisma.cross.count(),
      prisma.cultureObservation.count(),
      prisma.knowledgeItem.count(),
      prisma.intakeSubmission.count({ where: { status: "PENDING" } }),
    ]);

  const recentCrosses = await prisma.cross.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      seedParentTaxon: true,
      pollenParentTaxon: true,
      seedParentPlant: { include: { taxon: true } },
      pollenParentPlant: { include: { taxon: true } },
    },
  });

  const stats = [
    { label: "Growers", value: growers },
    { label: "Plants", value: plants },
    { label: "Taxa", value: taxa },
    { label: "Crosses", value: crosses },
    { label: "Culture records", value: observations },
    { label: "Takeaways", value: knowledge },
  ];

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="lead">
        {appConfig.societyName} · the coordinator hub. The knowledge base grows,
        and the suggestions improve, every time you log an outcome.
      </p>

      {pending > 0 && (
        <div className="banner info">
          {pending} member submission{pending === 1 ? "" : "s"} awaiting review —{" "}
          <a href="/intake-review">open the review queue</a>.
        </div>
      )}

      <div className="grid">
        {stats.map((s) => (
          <div className="card" key={s.label}>
            <div className="stat">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <Card
        title="Recent crosses"
        actions={<a className="btn small" href="/crosses">All crosses</a>}
      >
        {recentCrosses.length === 0 ? (
          <p className="muted">No crosses yet. Record your first on the Crosses page.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Parents</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentCrosses.map((c) => {
                  const seed =
                    c.seedParentPlant?.taxon.name ??
                    c.seedParentTaxon?.name ??
                    "?";
                  const pollen =
                    c.pollenParentPlant?.taxon.name ??
                    c.pollenParentTaxon?.name ??
                    "?";
                  return (
                    <tr key={c.id}>
                      <td>
                        <a href={`/crosses/${c.id}`}>{c.code || c.id.slice(0, 6)}</a>
                      </td>
                      <td>
                        {seed} × {pollen}
                      </td>
                      <td>
                        <span className="badge">{c.crossType || "—"}</span>
                      </td>
                      <td>
                        <span className="badge">{c.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Data & portability">
        <p className="muted" style={{ marginTop: 0 }}>
          Your data is yours. Export the whole instance to JSON (to back up, or to
          fork into your own copy), or import a previous export into an empty database.
        </p>
        <div className="pill-row">
          <a className="btn small" href="/api/export">
            Download JSON export
          </a>
        </div>
      </Card>
    </div>
  );
}
