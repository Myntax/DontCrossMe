import { prisma } from "@db/client";
import { createGrower } from "@/lib/actions";
import { Card, Field, TextArea, Checkbox, ErrorBanner } from "@/components/ui";

export default async function GrowersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const growers = await prisma.grower.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { plants: true, observations: true } } },
  });

  return (
    <div>
      <h1>Growers</h1>
      <p className="lead">
        Members of the program. A grower is a record — it exists whether or not
        the person ever logs in, so you can track everyone&apos;s plants and
        observations from here.
      </p>
      <ErrorBanner error={error} />

      <Card title={`${growers.length} grower(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Plants</th>
                <th>Records</th>
                <th>Shares?</th>
              </tr>
            </thead>
            <tbody>
              {growers.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td className="muted">{g.email || g.phone || "—"}</td>
                  <td className="muted">{g.location || "—"}</td>
                  <td>{g._count.plants}</td>
                  <td>{g._count.observations}</td>
                  <td>{g.consentToShare ? "yes" : "no"}</td>
                </tr>
              ))}
              {growers.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No growers yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a grower">
        <form className="stack" action={createGrower}>
          <Field label="Name" name="name" required />
          <div className="row">
            <Field label="Email" name="email" type="email" />
            <Field label="Phone" name="phone" />
          </div>
          <Field label="Location" name="location" hint="e.g. greenhouse, region" />
          <TextArea label="Notes" name="notes" />
          <Checkbox
            label="Consents to sharing their data within the society"
            name="consentToShare"
          />
          <button type="submit">Add grower</button>
        </form>
      </Card>
    </div>
  );
}
