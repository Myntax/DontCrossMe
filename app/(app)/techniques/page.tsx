import { prisma } from "@db/client";
import {
  createInterventionTechnique,
  toggleInterventionTechnique,
} from "@/lib/actions";
import { CROSS_TYPES } from "@engine/enums";
import { parseStringArray } from "@db/json";
import { Card, Field, TextArea, Checkbox, ErrorBanner, prettyEnum } from "@/components/ui";

export default async function TechniquesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const techniques = await prisma.interventionTechnique.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { basePriority: "desc" }],
  });

  return (
    <div>
      <h1>Intervention techniques</h1>
      <p className="lead">
        The catalog the suggestion engine draws from. Built-ins ship with the app;
        add your own as the field develops — new techniques appear in cross
        suggestions immediately and build their own success record over time.
      </p>
      <ErrorBanner error={error} />

      <Card title={`${techniques.length} technique(s)`}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Technique</th>
                <th>Applies to</th>
                <th>Max viability</th>
                <th>Priority</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {techniques.map((t) => (
                <tr key={t.id} style={{ opacity: t.isActive ? 1 : 0.5 }}>
                  <td>
                    <strong>{t.label}</strong>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {t.description}
                    </div>
                    <span className="mono">{t.key}</span>
                  </td>
                  <td className="muted">
                    {parseStringArray(t.appliesToJson).map(prettyEnum).join(", ")}
                  </td>
                  <td>{t.maxViability}</td>
                  <td>{t.basePriority}</td>
                  <td>
                    <span className="badge">{t.isBuiltIn ? "built-in" : "custom"}</span>
                  </td>
                  <td>
                    <form action={toggleInterventionTechnique}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="btn small secondary" type="submit">
                        {t.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a technique">
        <form className="stack" action={createInterventionTechnique}>
          <div className="row">
            <Field label="Key" name="key" required hint="e.g. CO2_ENRICHMENT" />
            <Field label="Label" name="label" required />
          </div>
          <TextArea label="Description" name="description" required />
          <div>
            <label>Applies to cross types</label>
            {CROSS_TYPES.map((ct) => (
              <div className="check" key={ct}>
                <input type="checkbox" name="appliesTo[]" value={ct} id={`ct-${ct}`} />
                <label htmlFor={`ct-${ct}`} style={{ marginBottom: 0 }}>
                  {prettyEnum(ct)}
                </label>
              </div>
            ))}
          </div>
          <div className="row">
            <Field
              label="Max viability"
              name="maxViability"
              type="number"
              defaultValue={60}
              hint="only suggest at/below this"
            />
            <Field label="Base priority" name="basePriority" type="number" defaultValue={5} />
          </div>
          <button type="submit">Add technique</button>
        </form>
      </Card>
    </div>
  );
}
