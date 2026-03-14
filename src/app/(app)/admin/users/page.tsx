import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createTenantUserAction } from "./actions";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const success = params.success === "1";

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/users");
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("tenant_id, full_name")
    .eq("id", user.id)
    .single();

  if (!actorProfile?.tenant_id) {
    return (
      <main>
        <h1 className="section-title">Admin - Users</h1>
        <p className="status-error" style={{ display: "inline-block" }}>
          Your profile is missing a tenant. Add your `profiles` row first.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="section-title">Admin - Users</h1>
      <p className="section-subtitle">
        Create new tenant users. New users are created as supervisors and can sign in immediately with the password you set here.
      </p>

      {error && <div className="status-error">{error}</div>}

      {success && <div className="status-ok">User created.</div>}

      <form action={createTenantUserAction} className="panel form-card" style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <input
          name="full_name"
          placeholder="Full name"
          required
          className="field"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="field"
        />
        <input
          name="password"
          type="password"
          placeholder="Temporary password (min 6 chars)"
          minLength={6}
          required
          className="field"
        />
        <button
          type="submit"
          className="action-button action-primary"
          style={{ marginTop: 4, width: "fit-content" }}
        >
          Add user
        </button>
      </form>
    </main>
  );
}
