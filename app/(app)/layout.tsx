import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { appConfig } from "@/lib/config";

const nav = [
  { section: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { section: "Program" },
  { href: "/growers", label: "Growers" },
  { href: "/plants", label: "Plants" },
  { href: "/taxa", label: "Taxa" },
  { href: "/crosses", label: "Crosses" },
  { href: "/observations", label: "Culture log" },
  { section: "Taxonomy" },
  { href: "/reclassification-review", label: "Reclassification review" },
  { section: "Intelligence" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/knowledge", label: "Knowledge base" },
  { href: "/techniques", label: "Techniques" },
  { href: "/reference-databases", label: "Reference databases" },
  { section: "Intake" },
  { href: "/intake-review", label: "Review queue" },
  { href: "/intake", label: "Public form ↗" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          DontCrossMe
          <small>{appConfig.societyName}</small>
        </div>
        <nav className="nav">
          {nav.map((item, i) =>
            "section" in item ? (
              <div className="section" key={i}>
                {item.section}
              </div>
            ) : (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ),
          )}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          <div className="muted" style={{ fontSize: "0.78rem", marginBottom: "0.4rem" }}>
            {user.name || user.email}
            <br />
            <span className="badge">{user.role}</span>{" "}
            <span className={`badge ${appConfig.aiEnabled ? "ai-on" : "ai-off"}`}>
              AI {appConfig.aiEnabled ? "on" : "off"}
            </span>
          </div>
          <form action={logoutAction}>
            <button className="btn secondary small" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
