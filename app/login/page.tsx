import { loginAction } from "@/lib/actions";
import { appConfig } from "@/lib/config";
import { ErrorBanner } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div style={{ maxWidth: 380, margin: "8vh auto", padding: "0 1rem" }}>
      <div className="brand" style={{ fontSize: "1.4rem" }}>
        DontCrossMe
        <small>{appConfig.societyName}</small>
      </div>
      <div className="card">
        <h1 style={{ fontSize: "1.2rem" }}>Sign in</h1>
        <p className="lead">Coordinator access to the breeding program.</p>
        <ErrorBanner error={error} />
        <form className="stack" action={loginAction}>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>
          <button type="submit">Sign in</button>
        </form>
      </div>
      <p className="muted" style={{ fontSize: "0.82rem" }}>
        Members without accounts can still contribute via the{" "}
        <a href="/intake">observation intake form</a>.
      </p>
    </div>
  );
}
