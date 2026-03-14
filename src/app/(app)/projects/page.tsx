import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/date";

export default async function ProjectsPage() {
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, full_name")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at, created_at")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="section-title">Projects</h1>
          <div className="section-subtitle">
            {profile?.full_name ? `Welcome, ${profile.full_name}` : "Welcome"}
          </div>
        </div>
        <Link href="/projects/new" className="action-link action-primary">
          + New project
        </Link>
      </div>

      {error && <div className="status-error">{error.message}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(projects || []).map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <Link href={`/projects/${p.id}`} className="card-link" style={{ flex: 1 }}>
              <div className="card-link-title">{p.name}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {formatDateDDMMYYYY(p.start_date)} - {formatDateDDMMYYYY(p.end_date)}
              </div>
            </Link>

            <form action={`/api/projects/${p.id}/delete`} method="post">
              <button
                type="submit"
                className="action-button action-danger"
                aria-label={`Delete ${p.name}`}
                title={`Delete ${p.name}`}
                style={{ width: 48, minHeight: "100%", padding: 0 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </form>
          </div>
        ))}

        {(projects || []).length === 0 && (
          <div className="muted" style={{ marginTop: 18 }}>No active projects yet - create one.</div>
        )}
      </div>
    </main>
  );
}
