import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return NextResponse.json(
      { error: profileError?.message || "Profile missing tenant." },
      { status: 400 }
    );
  }

  const tenantId = profile.tenant_id;

  const { data: handovers, error: handoversError } = await supabase
    .from("handovers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId);

  if (handoversError) {
    return NextResponse.json({ error: handoversError.message }, { status: 400 });
  }

  const handoverIds = (handovers || []).map((handover) => handover.id);

  if (handoverIds.length > 0) {
    const { data: photos, error: photosError } = await supabase
      .from("handover_photos")
      .select("storage_path")
      .eq("tenant_id", tenantId)
      .in("handover_id", handoverIds);

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 400 });
    }

    const storagePaths = (photos || [])
      .map((photo) => photo.storage_path)
      .filter(Boolean);

    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("briefz-photos")
        .remove(storagePaths);

      if (storageError) {
        return NextResponse.json({ error: storageError.message }, { status: 400 });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("tenant_id", tenantId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/projects", req.url), 303);
}
