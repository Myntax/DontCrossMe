import { prisma } from "@db/client";
import { createSource, createKnowledge } from "@/lib/actions";
import {
  SOURCE_TYPES,
  LICENSES,
  KNOWLEDGE_CATEGORIES,
  TAXON_SCOPES,
} from "@engine/enums";
import {
  Card,
  Field,
  Select,
  TextArea,
  Checkbox,
  ErrorBanner,
  enumOptions,
} from "@/components/ui";

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [sources, takeaways, taxa, refDbs] = await Promise.all([
    prisma.source.findMany({
      orderBy: { createdAt: "desc" },
      include: { referenceDatabase: true },
    }),
    prisma.knowledgeItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { taxon: true, sources: true },
    }),
    prisma.taxon.findMany({
      where: { rank: { in: ["SPECIES", "GENUS", "SUBTRIBE", "GREX"] } },
      orderBy: { name: "asc" },
    }),
    prisma.referenceDatabase.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Knowledge base</h1>
      <p className="lead">
        Practical takeaways distilled from literature, databases, and experience —
        each tied to a source. We store paraphrased facts and citations, not
        copyrighted text.
      </p>
      <ErrorBanner error={error} />

      <div className="banner info">
        <strong>Copyright &amp; AI handling.</strong> Each source carries usage
        flags. A takeaway may be sent to the optional AI layer only if it is your
        own, or if <em>every</em> linked source is marked “AI use allowed”. Anything
        else is used by the deterministic engine and shown in the UI, but never sent
        to a model.
      </div>

      <Card title={`${takeaways.length} takeaway(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Takeaway</th>
                <th>Taxon</th>
                <th>Category</th>
                <th>Source(s)</th>
                <th>AI-eligible</th>
                <th>Conf.</th>
              </tr>
            </thead>
            <tbody>
              {takeaways.map((k) => (
                <tr key={k.id}>
                  <td>
                    <strong>{k.title}</strong>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {k.takeaway}
                    </div>
                  </td>
                  <td className="muted">{k.taxon?.name || "—"}</td>
                  <td>
                    <span className="badge">{k.category}</span>
                  </td>
                  <td className="muted">
                    {k.sources.map((s) => s.title).join("; ") ||
                      (k.isUserAuthored ? "own" : "—")}
                  </td>
                  <td>
                    <span className={`badge ${k.aiEligible ? "ai-on" : "ai-off"}`}>
                      {k.aiEligible ? "yes" : "no"}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{k.confidence}</span>
                  </td>
                </tr>
              ))}
              {takeaways.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No takeaways yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a takeaway">
        <form className="stack" action={createKnowledge}>
          <Field label="Title" name="title" required />
          <TextArea
            label="Takeaway"
            name="takeaway"
            required
            hint="a short, factual, paraphrased point — not a copied quote"
          />
          <div className="row">
            <Select
              label="Taxon"
              name="taxonId"
              includeBlank="— optional —"
              options={taxa.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Select
              label="Applies at scope"
              name="taxonScope"
              options={enumOptions(TAXON_SCOPES)}
              defaultValue="SPECIES"
            />
          </div>
          <div className="row">
            <Select
              label="Category"
              name="category"
              options={enumOptions(KNOWLEDGE_CATEGORIES)}
              defaultValue="CULTURE"
            />
            <Select
              label="Confidence"
              name="confidence"
              options={enumOptions(["LOW", "MEDIUM", "HIGH"])}
              defaultValue="MEDIUM"
            />
          </div>
          <Field label="Citation" name="citation" hint="page / section / DOI" />
          <Checkbox
            label="This is my/our own observation or paraphrase (user-authored)"
            name="isUserAuthored"
            defaultChecked
          />
          {sources.length > 0 && (
            <div>
              <label>Link source(s)</label>
              {sources.map((s) => (
                <div className="check" key={s.id}>
                  <input type="checkbox" name="sourceIds[]" value={s.id} id={`src-${s.id}`} />
                  <label htmlFor={`src-${s.id}`} style={{ marginBottom: 0 }}>
                    {s.title}{" "}
                    <span className={`badge ${s.aiUseAllowed ? "ai-on" : "ai-off"}`}>
                      AI {s.aiUseAllowed ? "ok" : "no"}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
          <button type="submit">Add takeaway</button>
        </form>
      </Card>

      <Card title={`${sources.length} source(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>License</th>
                <th>AI</th>
                <th>Redist.</th>
                <th>Comm.</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td className="muted">{s.type}</td>
                  <td className="mono">{s.license}</td>
                  <td>{s.aiUseAllowed ? "✓" : "✗"}</td>
                  <td>{s.redistributionAllowed ? "✓" : "✗"}</td>
                  <td>{s.commercialUseAllowed ? "✓" : "✗"}</td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No sources yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a source">
        <form className="stack" action={createSource}>
          <Field label="Title" name="title" required />
          {refDbs.length > 0 && (
            <Select
              label="From reference database"
              name="referenceDatabaseId"
              includeBlank="— none / standalone —"
              hint="pre-fills licensing from the database's defaults"
              options={refDbs.map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          <div className="row">
            <Field label="Authors" name="authors" />
            <Select
              label="Type"
              name="type"
              options={enumOptions(SOURCE_TYPES)}
              defaultValue="JOURNAL"
            />
          </div>
          <div className="row">
            <Field label="URL" name="url" type="url" />
            <Field label="DOI" name="doi" />
          </div>
          <Field label="Citation" name="citation" />
          <Select
            label="License"
            name="license"
            options={enumOptions(LICENSES)}
            defaultValue="UNKNOWN"
          />
          <div className="banner info" style={{ marginBottom: 0 }}>
            Set these deliberately — they govern how the material may be used.
          </div>
          <Checkbox label="AI use allowed (may be sent to a model)" name="aiUseAllowed" />
          <Checkbox label="Redistribution allowed" name="redistributionAllowed" />
          <Checkbox label="Commercial use allowed" name="commercialUseAllowed" />
          <TextArea label="Access notes" name="accessNotes" />
          <button type="submit">Add source</button>
        </form>
      </Card>
    </div>
  );
}
