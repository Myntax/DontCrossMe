import { prisma } from "@db/client";
import { reclassifyTaxon } from "@/lib/actions";
import { Card, prettyEnum } from "@/components/ui";

export default async function ReclassificationReviewPage() {
  const flagged = await prisma.taxon.findMany({
    where: { needsReview: true },
    orderBy: { name: "asc" },
    include: {
      nothoComponents: { include: { componentGenus: true } },
      revisions: {
        where: { note: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { relatedTaxon: true },
      },
    },
  });

  return (
    <div>
      <h1>Reclassification impact review</h1>
      <p className="lead">
        When a genus is reclassified, hybrid genera and grexes built from it can be
        affected — a nothogenus may even collapse into a single genus. Nothing is
        changed automatically; confirm each impact here.
      </p>

      <Card title={`${flagged.length} taxon(s) need review`}>
        {flagged.length === 0 ? (
          <p className="muted">Nothing to review. 🌱</p>
        ) : (
          flagged.map((t) => {
            const rev = t.revisions[0];
            return (
              <div key={t.id} className="factor" style={{ alignItems: "flex-start" }}>
                <div>
                  <a href={`/taxa/${t.id}`}>
                    <strong>
                      <em>{t.name}</em>
                    </strong>
                  </a>{" "}
                  <span className="badge">{t.rank}</span>
                  {t.isHybrid && <> <span className="badge">hybrid</span></>}
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {rev?.note || "Flagged for review."}
                  </div>
                  {t.nothoComponents.length > 0 && (
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      Components:{" "}
                      {t.nothoComponents.map((c) => c.componentGenus.name).join(" × ")}
                    </div>
                  )}
                </div>
                <div className="pill-row">
                  <a className="btn small secondary" href={`/taxa/${t.id}`}>
                    Open
                  </a>
                  <form action={reclassifyTaxon}>
                    <input type="hidden" name="op" value="clearReview" />
                    <input type="hidden" name="taxonId" value={t.id} />
                    <button className="btn small" type="submit">
                      Mark reviewed
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
