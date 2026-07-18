import { notFound } from "next/navigation";
import { prisma } from "@db/client";
import {
  addTaxonName,
  reclassifyTaxon,
  mergeTaxaAction,
  splitTaxonAction,
  addNothoComponent,
  removeNothoComponent,
} from "@/lib/actions";
import { TAXON_RANKS, TAXON_NAME_TYPES } from "@engine/enums";
import {
  Card,
  Field,
  Select,
  Checkbox,
  ErrorBanner,
  enumOptions,
  prettyEnum,
} from "@/components/ui";

export default async function TaxonDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const taxon = await prisma.taxon.findUnique({
    where: { id },
    include: {
      names: { orderBy: { createdAt: "asc" } },
      acceptedTaxon: true,
      parent: true,
      nothoComponents: { include: { componentGenus: true } },
      revisions: { orderBy: { createdAt: "desc" }, include: { relatedTaxon: true } },
      plants: { include: { taxon: true } },
      cultureObservations: true,
    },
  });
  if (!taxon) notFound();

  const others = await prisma.taxon.findMany({
    where: { id: { not: id } },
    orderBy: { name: "asc" },
  });
  const genera = others.filter((t) => t.rank === "GENUS");
  const otherOpts = others.map((t) => ({ value: t.id, label: `${t.name} (${t.rank})` }));
  const genusOpts = genera.map((t) => ({ value: t.id, label: t.name }));
  const isNotho = taxon.isHybrid && taxon.rank === "GENUS";

  return (
    <div>
      <p className="muted">
        <a href="/taxa">← Taxa</a>
      </p>
      <h1>
        <em>{taxon.name}</em>{" "}
        {taxon.formulaAbbreviation && (
          <span className="muted">({taxon.formulaAbbreviation})</span>
        )}
      </h1>
      <div className="pill-row" style={{ marginBottom: "1rem" }}>
        <span className="badge">{taxon.rank}</span>
        <span className={`badge ${taxon.status === "ACCEPTED" ? "ok" : "MEDIUM"}`}>
          {taxon.status}
        </span>
        {taxon.acceptedTaxon && (
          <span className="badge">
            → accepted: <em>{taxon.acceptedTaxon.name}</em>
          </span>
        )}
        {taxon.isHybrid && <span className="badge">hybrid</span>}
        {taxon.needsReview && <span className="badge MEDIUM">needs review</span>}
      </div>
      <ErrorBanner error={error} />

      {taxon.needsReview && (
        <div className="banner info">
          This taxon was flagged after a reclassification. Review the impact, then
          clear the flag.
          <form action={reclassifyTaxon} style={{ marginTop: "0.5rem" }}>
            <input type="hidden" name="op" value="clearReview" />
            <input type="hidden" name="taxonId" value={taxon.id} />
            <button className="btn small" type="submit">
              Mark reviewed
            </button>
          </form>
        </div>
      )}

      {/* Names ------------------------------------------------------------- */}
      <Card title="Names">
        <p className="muted" style={{ marginTop: 0 }}>
          A taxon can carry many names. A name can stay in horticultural use even
          when it is a scientific synonym (e.g. <em>Neofinetia falcata</em>).
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>In use</th>
                <th>Preferred</th>
              </tr>
            </thead>
            <tbody>
              {taxon.names.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No alternate names recorded. The scientific name is{" "}
                    <em>{taxon.name}</em>.
                  </td>
                </tr>
              )}
              {taxon.names.map((n) => (
                <tr key={n.id}>
                  <td>
                    <em>{n.name}</em>
                    {n.note ? (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {n.note}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="badge">{prettyEnum(n.nameType)}</span>
                  </td>
                  <td>{n.inCurrentUse ? "yes" : "no"}</td>
                  <td>{n.isPreferredDisplay ? "★" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Add a name</h3>
        <form className="stack" action={addTaxonName}>
          <input type="hidden" name="taxonId" value={taxon.id} />
          <Field label="Name" name="name" required />
          <div className="row">
            <Select
              label="Type"
              name="nameType"
              options={enumOptions(TAXON_NAME_TYPES)}
              defaultValue="HORTICULTURAL"
            />
            <Field label="Authority" name="authority" />
          </div>
          <Checkbox label="Still in current use" name="inCurrentUse" defaultChecked />
          <Checkbox label="Use as the preferred display label" name="isPreferredDisplay" />
          <Field label="Note" name="note" hint="e.g. tradition, region" />
          <button type="submit">Add name</button>
        </form>
      </Card>

      {/* Nothogenus components -------------------------------------------- */}
      {isNotho && (
        <Card title="Hybrid-genus components">
          <p className="muted" style={{ marginTop: 0 }}>
            The ancestor genera this nothogenus is built from. If these are
            reclassified, this genus may collapse — you&apos;ll be flagged for review.
          </p>
          <ul>
            {taxon.nothoComponents.map((c) => (
              <li key={c.id} style={{ marginBottom: "0.3rem" }}>
                <em>{c.componentGenus.name}</em>{" "}
                <form action={removeNothoComponent} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="nothoGenusId" value={taxon.id} />
                  <button className="btn small secondary" type="submit">
                    remove
                  </button>
                </form>
              </li>
            ))}
            {taxon.nothoComponents.length === 0 && (
              <li className="muted">No components yet.</li>
            )}
          </ul>
          <form
            action={addNothoComponent}
            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
          >
            <input type="hidden" name="nothoGenusId" value={taxon.id} />
            <div style={{ flex: 1 }}>
              <Select
                label="Add component genus"
                name="componentGenusId"
                includeBlank="— select genus —"
                options={genusOpts}
              />
            </div>
            <button type="submit">Add</button>
          </form>
        </Card>
      )}

      {/* Reclassification ------------------------------------------------- */}
      <Card title="Reclassify">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <form className="stack" action={reclassifyTaxon}>
            <input type="hidden" name="op" value="rename" />
            <input type="hidden" name="taxonId" value={taxon.id} />
            <h3>Rename</h3>
            <Field label="New name" name="name" required defaultValue={taxon.name} />
            <Field label="Authority" name="authority" defaultValue={taxon.authority ?? ""} />
            <button type="submit">Rename</button>
          </form>

          <form className="stack" action={reclassifyTaxon}>
            <input type="hidden" name="op" value="move" />
            <input type="hidden" name="taxonId" value={taxon.id} />
            <h3>Move (change parent)</h3>
            <Select
              label="New parent"
              name="parentId"
              includeBlank="— none —"
              options={otherOpts}
              defaultValue={taxon.parentId ?? ""}
            />
            <button type="submit">Move</button>
          </form>

          <form className="stack" action={reclassifyTaxon}>
            <input type="hidden" name="op" value="rank" />
            <input type="hidden" name="taxonId" value={taxon.id} />
            <h3>Reclassify rank</h3>
            <Select
              label="New rank"
              name="rank"
              options={enumOptions(TAXON_RANKS)}
              defaultValue={taxon.rank}
            />
            <button type="submit">Change rank</button>
          </form>

          <form className="stack" action={reclassifyTaxon}>
            <input type="hidden" name="op" value="synonym" />
            <input type="hidden" name="taxonId" value={taxon.id} />
            <h3>Mark as synonym</h3>
            <Select
              label="Accepted taxon"
              name="acceptedTaxonId"
              required
              includeBlank="— select accepted taxon —"
              options={otherOpts}
            />
            <Checkbox
              label="Reassign this taxon's plants/records to the accepted taxon"
              name="reassign"
            />
            <button type="submit">Mark synonym</button>
          </form>
        </div>

        <div className="pill-row" style={{ marginTop: "0.8rem" }}>
          {taxon.status !== "DEPRECATED" ? (
            <form action={reclassifyTaxon}>
              <input type="hidden" name="op" value="deprecate" />
              <input type="hidden" name="taxonId" value={taxon.id} />
              <button className="btn small secondary" type="submit">
                Deprecate
              </button>
            </form>
          ) : null}
          {taxon.status !== "ACCEPTED" ? (
            <form action={reclassifyTaxon}>
              <input type="hidden" name="op" value="restore" />
              <input type="hidden" name="taxonId" value={taxon.id} />
              <button className="btn small secondary" type="submit">
                Restore to accepted
              </button>
            </form>
          ) : null}
        </div>
      </Card>

      {/* Merge & Split ---------------------------------------------------- */}
      <Card title="Merge / Split">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <form className="stack" action={mergeTaxaAction}>
            <input type="hidden" name="sourceId" value={taxon.id} />
            <h3>Merge this taxon into…</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
              Reassigns everything to the target, preserves this taxon&apos;s names
              on it, and redirects this one as a synonym. Nothing is deleted.
            </p>
            <Select
              label="Target taxon"
              name="targetId"
              required
              includeBlank="— select target —"
              options={otherOpts}
            />
            <button type="submit">Merge</button>
          </form>

          <form className="stack" action={splitTaxonAction}>
            <input type="hidden" name="sourceId" value={taxon.id} />
            <h3>Split out a new taxon</h3>
            <Field label="New taxon name" name="name" required />
            <Select
              label="New taxon rank"
              name="rank"
              options={enumOptions(TAXON_RANKS)}
              defaultValue={taxon.rank}
            />
            {taxon.plants.length > 0 && (
              <div>
                <label>Move plants</label>
                {taxon.plants.map((p) => (
                  <div className="check" key={p.id}>
                    <input type="checkbox" name="plantIds[]" value={p.id} id={`pl-${p.id}`} />
                    <label htmlFor={`pl-${p.id}`} style={{ marginBottom: 0 }}>
                      {p.taxon.name}
                      {p.clonalName ? ` '${p.clonalName}'` : ""}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {taxon.cultureObservations.length > 0 && (
              <p className="muted" style={{ fontSize: "0.82rem" }}>
                {taxon.cultureObservations.length} observation(s) stay with this taxon
                unless moved via a later merge.
              </p>
            )}
            <button type="submit">Split</button>
          </form>
        </div>
      </Card>

      {/* Revision history ------------------------------------------------- */}
      <Card title="Revision history">
        {taxon.revisions.length === 0 ? (
          <p className="muted">No changes recorded yet.</p>
        ) : (
          <ul>
            {taxon.revisions.map((r) => (
              <li key={r.id}>
                <span className="badge">{prettyEnum(r.action)}</span>{" "}
                {r.note || ""}
                {r.relatedTaxon ? (
                  <>
                    {" "}
                    (<em>{r.relatedTaxon.name}</em>)
                  </>
                ) : null}{" "}
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
