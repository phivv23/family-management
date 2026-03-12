import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/context";

const bodySchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
  expiresIn: z.number().int().positive().max(60 * 60).optional(),
});

export async function POST(req: Request) {
  await requireAuth();
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(parsed.data.bucket)
    .createSignedUrl(parsed.data.path, parsed.data.expiresIn ?? 60);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, url: data.signedUrl });
}
