import { prisma } from "@db/client";
import { createTaxon, importTaxaCsv } from "@/lib/actions";
import { TAXON_RANKS } from "@engine/enums";
import {
  Card,
  Field,
  Select,
  TextArea,
  Checkbox,
  ErrorBanner,
  OkBanner,
  enumOptions,
} from "@/components/ui";

export default async function TaxaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; import?: string }>;
}) {
  const { error, import: importMsg } = await searchParams;
  const [taxa, refDbs] = await Promise.all([
    prisma.taxon.findMany({
      orderBy: [{ rank: "asc" }, { name: "asc" }],
      include: { parent: true },
    }),
    prisma.referenceDatabase.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1>Taxa</h1>
      <p className="lead">
        The taxonomic backbone: family → subfamily → tribe → subtribe → genus →
        species, plus registered hybrid grexes. Distances between taxa drive the
        cross-viability baseline, so fill in genus/subtribe where you can.
      </p>
      <ErrorBanner error={error} />
      {importMsg && <OkBanner>{importMsg}</OkBanner>}

      <Card title={`${taxa.length} taxa`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rank</th>
                <th>Status</th>
                <th>Parent</th>
                <th>2n</th>
                <th>Hybrid?</th>
              </tr>
            </thead>
            <tbody>
              {taxa.map((t) => (
                <tr key={t.id}>
                  <td>
                    <a href={`/taxa/${t.id}`}>
                      <em>{t.name}</em>
                    </a>
                    {t.needsReview && (
                      <> <span className="badge MEDIUM">review</span></>
                    )}
                  </td>
                  <td>
                    <span className="badge">{t.rank}</span>
                    {t.formulaAbbreviation ? (
                      <span className="muted"> {t.formulaAbbreviation}</span>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge ${t.status === "ACCEPTED" ? "ok" : "MEDIUM"}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="muted">{t.parent?.name || "—"}</td>
                  <td>{t.chromosomeCount ?? "—"}</td>
                  <td>{t.isHybrid ? "yes" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a taxon">
        <form className="stack" action={createTaxon}>
          <Field label="Name" name="name" required hint="e.g. Cattleya labiata" />
          <div className="row">
            <Select
              label="Rank"
              name="rank"
              required
              options={enumOptions(TAXON_RANKS)}
              defaultValue="SPECIES"
            />
            <Select
              label="Parent taxon"
              name="parentId"
              includeBlank="— none —"
              options={taxa.map((t) => ({
                value: t.id,
                label: `${t.name} (${t.rank})`,
              }))}
            />
          </div>
          <div className="row">
            <Field label="Authority" name="authority" />
            <Field
              label="Chromosome count (2n)"
              name="chromosomeCount"
              type="number"
              hint="e.g. 40"
            />
          </div>
          <div className="row">
            <Field label="Ploidy" name="ploidy" hint="e.g. 2n=2x=40" />
            <Field label="Native range" name="nativeRange" />
          </div>
          <button type="submit">Add taxon</button>
        </form>
      </Card>

      <Card title="Import taxa (CSV)">
        <p className="muted" style={{ marginTop: 0 }}>
          Paste a sanctioned CSV/Darwin-Core export (columns auto-detected). Synonyms
          link to their accepted names; re-importing updates in place. For large files
          use the CLI (<span className="mono">npm run import-taxa</span>) — see{" "}
          <span className="mono">docs/IMPORT.md</span>. Only import data you&apos;re
          licensed to use.
        </p>
        <form className="stack" action={importTaxaCsv}>
          <TextArea
            label="CSV"
            name="csv"
            required
            hint="first row = headers, e.g. scientificName,taxonRank,taxonomicStatus,acceptedNameUsageID,genus"
          />
          {refDbs.length > 0 && (
            <Select
              label="Attribute to reference database"
              name="referenceDatabaseId"
              includeBlank="— none —"
              options={refDbs.map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          <Checkbox label="Dry run (report only, write nothing)" name="dryRun" defaultChecked />
          <button type="submit">Import</button>
        </form>
      </Card>
    </div>
  );
}
