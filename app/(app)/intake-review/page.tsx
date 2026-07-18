import { prisma } from "@db/client";
import { reviewIntake } from "@/lib/actions";
import { Card, ErrorBanner, prettyEnum } from "@/components/ui";

export default async function IntakeReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const pending = await prisma.intakeSubmission.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { grower: true },
  });
  const recent = await prisma.intakeSubmission.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { reviewedAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <h1>Review queue</h1>
      <p className="lead">
        Submissions from members using the account-less intake form. Approving an
        observation files it into the culture log.
      </p>
      <ErrorBanner error={error} />

      <Card title={`${pending.length} pending`}>
        {pending.length === 0 ? (
          <p className="muted">Nothing waiting. 🌱</p>
        ) : (
          pending.map((s) => {
            const payload = JSON.parse(s.payloadJson || "{}") as Record<string, string>;
            return (
              <div key={s.id} className="factor" style={{ alignItems: "center" }}>
                <div>
                  <span className="badge">{s.kind}</span>{" "}
                  <strong>{s.submitterName || s.grower?.name || "Anonymous"}</strong>
                  {s.submitterEmail ? ` · ${s.submitterEmail}` : ""}
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {Object.entries(payload)
                      .map(([k, v]) => `${prettyEnum(k)}: ${v}`)
                      .join(" · ")}
                  </div>
                </div>
                <div className="pill-row">
                  <form action={reviewIntake}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn small" type="submit">
                      Approve
                    </button>
                  </form>
                  <form action={reviewIntake}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="btn small secondary" type="submit">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </Card>

      {recent.length > 0 && (
        <Card title="Recently reviewed">
          <ul>
            {recent.map((s) => (
              <li key={s.id}>
                <span className="badge">{s.status}</span> {s.kind} from{" "}
                {s.submitterName || "Anonymous"}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
