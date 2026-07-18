import { prisma } from "@db/client";
import { createReferenceDatabase } from "@/lib/actions";
import { REFERENCE_DB_KINDS, REFERENCE_DB_STATUSES, LICENSES } from "@engine/enums";
import {
  Card,
  Field,
  Select,
  TextArea,
  Checkbox,
  ErrorBanner,
  enumOptions,
} from "@/components/ui";

export default async function ReferenceDatabasesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const dbs = await prisma.referenceDatabase.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sources: true } } },
  });

  return (
    <div>
      <h1>Reference databases</h1>
      <p className="lead">
        A registry of external databases, onboarded as they&apos;re discovered. Each
        carries default usage rights that pre-fill sources drawn from it — keeping
        the copyright/AI gate consistent per database.
      </p>
      <ErrorBanner error={error} />

      <Card title={`${dbs.length} database(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Default license</th>
                <th>AI</th>
                <th>Status</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {dbs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <strong>{d.name}</strong>
                    {d.captureGuidance ? (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {d.captureGuidance}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge">{d.kind}</span>
                  </td>
                  <td className="mono">{d.defaultLicense}</td>
                  <td>
                    <span className={`badge ${d.defaultAiUseAllowed ? "ai-on" : "ai-off"}`}>
                      {d.defaultAiUseAllowed ? "ok" : "no"}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{d.status}</span>
                  </td>
                  <td>{d._count.sources}</td>
                </tr>
              ))}
              {dbs.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    None registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Register a database">
        <form className="stack" action={createReferenceDatabase}>
          <Field label="Name" name="name" required hint="e.g. Kew POWO / WCVP" />
          <TextArea label="Description" name="description" />
          <div className="row">
            <Field label="URL" name="url" type="url" />
            <Select
              label="Kind"
              name="kind"
              options={enumOptions(REFERENCE_DB_KINDS)}
              defaultValue="TAXONOMY"
            />
          </div>
          <TextArea
            label="Capture guidance"
            name="captureGuidance"
            hint="how to bring data in + terms-of-use notes"
          />
          <Select
            label="Default license"
            name="defaultLicense"
            options={enumOptions(LICENSES)}
            defaultValue="UNKNOWN"
          />
          <div className="banner info" style={{ marginBottom: 0 }}>
            Defaults pre-fill sources drawn from this database. Set them deliberately.
          </div>
          <Checkbox label="AI use allowed by default" name="defaultAiUseAllowed" />
          <Checkbox label="Redistribution allowed by default" name="defaultRedistributionAllowed" />
          <Checkbox label="Commercial use allowed by default" name="defaultCommercialUseAllowed" />
          <Select
            label="Status"
            name="status"
            options={enumOptions(REFERENCE_DB_STATUSES)}
            defaultValue="EVALUATING"
          />
          <button type="submit">Register database</button>
        </form>
      </Card>
    </div>
  );
}
