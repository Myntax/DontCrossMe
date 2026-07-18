import { prisma } from "@db/client";
import { submitIntake } from "@/lib/actions";
import { appConfig } from "@/lib/config";
import { CULTURE_PARAMETERS, OUTCOMES } from "@engine/enums";
import {
  Field,
  Select,
  TextArea,
  ErrorBanner,
  OkBanner,
  enumOptions,
} from "@/components/ui";

// Public, account-less submission form. This is the low-friction channel for
// members who don't (yet) use the platform themselves.
export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { error, submitted } = await searchParams;
  const [taxa, growers] = await Promise.all([
    prisma.taxon.findMany({
      where: { rank: { in: ["SPECIES", "GENUS", "GREX"] } },
      orderBy: { name: "asc" },
    }),
    prisma.grower.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div style={{ maxWidth: 620, margin: "5vh auto", padding: "0 1rem" }}>
      <div className="brand" style={{ fontSize: "1.4rem" }}>
        {appConfig.societyName}
        <small>Share a growing observation</small>
      </div>

      <div className="card">
        <p className="lead">
          No account needed. Tell us what worked (or didn&apos;t) for one of your
          orchids and the coordinator will add it to the shared knowledge base.
        </p>
        <ErrorBanner error={error} />
        {submitted && (
          <OkBanner>Thank you! Your observation was submitted for review.</OkBanner>
        )}

        <form className="stack" action={submitIntake} style={{ maxWidth: "100%" }}>
          <input type="hidden" name="kind" value="OBSERVATION" />
          <div className="row">
            <Field label="Your name" name="submitterName" />
            <Field label="Email (optional)" name="submitterEmail" type="email" />
          </div>
          {growers.length > 0 && (
            <Select
              label="Are you a listed grower?"
              name="growerId"
              includeBlank="— not listed / prefer not to say —"
              options={growers.map((g) => ({ value: g.id, label: g.name }))}
            />
          )}
          <Select
            label="Which orchid?"
            name="p_taxonId"
            includeBlank="— select taxon —"
            options={taxa.map((t) => ({ value: t.id, label: t.name }))}
          />
          <div className="row">
            <Select
              label="What aspect of culture?"
              name="p_parameter"
              required
              options={enumOptions(CULTURE_PARAMETERS)}
            />
            <Select
              label="How did it go?"
              name="p_outcome"
              options={enumOptions(OUTCOMES)}
              defaultValue="POSITIVE"
            />
          </div>
          <Field
            label="What did you do?"
            name="p_valueText"
            required
            hint="e.g. bright filtered light; cool nights in winter"
          />
          <Field label="Context" name="p_context" hint="season, stage, etc." />
          <TextArea label="Anything else?" name="p_notes" />
          <button type="submit">Submit observation</button>
        </form>
      </div>
      <p className="muted" style={{ fontSize: "0.82rem", textAlign: "center" }}>
        Coordinator? <a href="/login">Sign in</a>.
      </p>
    </div>
  );
}
