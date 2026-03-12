"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { registerProfileSchema } from "@/lib/zod/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  clearRegisterAccountDraft,
  clearRegisterProfileDraft,
  loadRegisterAccountDraft,
  loadRegisterProfileDraft,
  saveRegisterProfileDraft,
  type RegisterProfileDraft,
} from "@/lib/auth/register-draft";
import { genderLabel } from "@/lib/i18n/labels";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Form = z.infer<typeof registerProfileSchema>;

const EMPTY_FORM: Form = {
  fullName: "",
  gender: "UNKNOWN",
  dob: "",
  phone: "",
  hometown: "",
  address: "",
  bio: "",
};

function formatProfileRpcError(message: string) {
  if (message.includes("Could not choose the best candidate function between") && message.includes("upsert_my_profile")) {
    return "Cơ sở dữ liệu đang có 2 phiên bản hàm lưu hồ sơ cá nhân. Hãy chạy file SQL vá mới để hợp nhất hàm upsert_my_profile rồi thử lại.";
  }
  return message;
}

function mergeProfileDrafts(draft: RegisterProfileDraft | null, fallback?: Partial<Form> | null): Form {
  return {
    fullName: draft?.fullName ?? fallback?.fullName ?? "",
    gender: draft?.gender ?? fallback?.gender ?? "UNKNOWN",
    dob: draft?.dob ?? fallback?.dob ?? "",
    phone: draft?.phone ?? fallback?.phone ?? "",
    hometown: draft?.hometown ?? fallback?.hometown ?? "",
    address: draft?.address ?? fallback?.address ?? "",
    bio: draft?.bio ?? fallback?.bio ?? "",
  };
}

export default function RegisterProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const nextUrl = searchParams.get("next") || "/onboarding";
  const completeMode = searchParams.get("complete") === "1";

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasAccountDraft, setHasAccountDraft] = useState(false);

  useEffect(() => {
    const profileDraft = loadRegisterProfileDraft();

    if (completeMode) {
      setHasAccountDraft(false);
      setForm(mergeProfileDrafts(profileDraft));
      setReady(true);
      return;
    }

    const accountDraft = loadRegisterAccountDraft();
    setHasAccountDraft(Boolean(accountDraft));
    if (!accountDraft) {
      setReady(true);
      setError("Bạn chưa hoàn tất bước tạo tài khoản. Hãy quay lại bước 1.");
      return;
    }

    setForm(mergeProfileDrafts(profileDraft));
    setReady(true);
  }, [completeMode]);

  useEffect(() => {
    if (!completeMode) return;
    let ignore = false;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user || ignore) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,gender,dob,phone,hometown,address,bio")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (ignore) return;
      setForm((prev) =>
        mergeProfileDrafts(loadRegisterProfileDraft(), {
          ...prev,
          fullName: profile?.full_name ?? prev.fullName,
          gender: (profile?.gender as Form["gender"] | null) ?? prev.gender,
          dob: profile?.dob ?? prev.dob,
          phone: profile?.phone ?? prev.phone,
          hometown: profile?.hometown ?? prev.hometown,
          address: profile?.address ?? prev.address,
          bio: profile?.bio ?? prev.bio,
        })
      );
      setReady(true);
    })();

    return () => {
      ignore = true;
    };
  }, [completeMode, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const parsed = registerProfileSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }

    saveRegisterProfileDraft(parsed.data);
    setBusy(true);

    try {
      if (completeMode) {
        const { error: rpcError } = await supabase.rpc("upsert_my_profile", {
          p_full_name: parsed.data.fullName,
          p_gender: parsed.data.gender,
          p_dob: parsed.data.dob || null,
          p_phone: parsed.data.phone || null,
          p_hometown: parsed.data.hometown || null,
          p_address: parsed.data.address || null,
          p_bio: parsed.data.bio || null,
          p_avatar_url: null,
        });

        if (rpcError) {
          setError(formatProfileRpcError(rpcError.message));
          setBusy(false);
          return;
        }

        clearRegisterProfileDraft();
        setBusy(false);
        router.replace(nextUrl);
        router.refresh();
        return;
      }

      const accountDraft = loadRegisterAccountDraft();
      if (!accountDraft) {
        setError("Phiên đăng ký bước 1 đã hết. Hãy quay lại nhập email và mật khẩu.");
        setBusy(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: accountDraft.email,
        password: accountDraft.password,
        options: {
          data: {
            full_name: parsed.data.fullName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setBusy(false);
        return;
      }

      clearRegisterAccountDraft();

      if (data.session) {
        const { error: rpcError } = await supabase.rpc("upsert_my_profile", {
          p_full_name: parsed.data.fullName,
          p_gender: parsed.data.gender,
          p_dob: parsed.data.dob || null,
          p_phone: parsed.data.phone || null,
          p_hometown: parsed.data.hometown || null,
          p_address: parsed.data.address || null,
          p_bio: parsed.data.bio || null,
          p_avatar_url: null,
        });

        if (rpcError) {
          setError(formatProfileRpcError(rpcError.message));
          setBusy(false);
          return;
        }

        clearRegisterProfileDraft();
        setBusy(false);
        router.replace(nextUrl);
        router.refresh();
        return;
      }

      setBusy(false);
      setNotice(`Tài khoản đã được tạo cho ${accountDraft.email}. Hãy xác thực email rồi đăng nhập để hoàn tất bước hồ sơ cá nhân.`);
      router.replace(`/login?email=${encodeURIComponent(accountDraft.email)}&next=${encodeURIComponent(nextUrl)}&complete=1`);
    } catch (err: any) {
      setBusy(false);
      setError(err?.message ?? "Không thể hoàn tất đăng ký lúc này.");
    }
  }

  if (!ready) {
    return <div className="text-sm text-slate-600">Đang tải bước đăng ký hồ sơ...</div>;
  }

  const headline = completeMode ? "Hoàn tất hồ sơ cá nhân" : "Khai hồ sơ cá nhân cơ bản";
  const subline = completeMode
    ? "Tài khoản đã có nhưng hồ sơ cơ bản chưa đầy đủ. Hãy hoàn tất để hệ thống và quản trị viên đối chiếu chính xác hơn."
    : "Bước này tách riêng với phần tài khoản để quy trình đăng ký sát với dự án thực tế hơn.";

  return (
    <div className="grid min-h-[72vh] gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="hidden border-slate-200 bg-slate-50/80 lg:block">
        <CardContent className="flex h-full flex-col justify-between p-8">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {completeMode ? "Bổ sung hồ sơ" : "Bước 2/2 · Hồ sơ cá nhân"}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{headline}</h1>
              <p className="max-w-xl text-sm leading-6 text-slate-600">{subline}</p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">Hồ sơ cơ bản</div>
              <div className="mt-1">Gồm họ tên, giới tính, ngày sinh, số điện thoại, quê quán và địa chỉ hiện tại.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">Ghi chú đối chiếu</div>
              <div className="mt-1">Dùng cho quản trị viên xác minh và gắn bạn vào đúng hồ sơ thành viên trong cây gia phả.</div>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4 shadow-sm">
              <div className="font-semibold text-slate-900">Không đưa vào metadata đăng nhập</div>
              <div className="mt-1">Thông tin này được lưu về bảng hồ sơ riêng, tránh phình session và sát cách vận hành thực tế hơn.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {completeMode ? "Bổ sung hồ sơ" : "Bước 2/2 · Hồ sơ cá nhân"}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{headline}</h2>
            <p className="text-sm text-slate-600">{subline}</p>
          </div>
        </CardHeader>
        <CardContent>
          {!completeMode && !hasAccountDraft ? (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div>Bạn cần hoàn tất bước tạo tài khoản trước khi khai hồ sơ.</div>
              <Button asChild variant="outline">
                <Link href={`/register?next=${encodeURIComponent(nextUrl)}`}>Quay lại bước 1</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="register-full-name">Họ và tên</Label>
                <Input
                  id="register-full-name"
                  value={form.fullName}
                  onChange={(e) => setForm((s) => ({ ...s, fullName: e.target.value }))}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Giới tính</Label>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    value={form.gender}
                    onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value as Form["gender"] }))}
                  >
                    <option value="UNKNOWN">{genderLabel("UNKNOWN")}</option>
                    <option value="MALE">{genderLabel("MALE")}</option>
                    <option value="FEMALE">{genderLabel("FEMALE")}</option>
                    <option value="OTHER">{genderLabel("OTHER")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-dob">Ngày sinh</Label>
                  <Input
                    id="register-dob"
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm((s) => ({ ...s, dob: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="register-phone">Số điện thoại</Label>
                  <Input
                    id="register-phone"
                    value={form.phone}
                    onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="Ví dụ: 0912345678"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-hometown">Quê quán</Label>
                  <Input
                    id="register-hometown"
                    value={form.hometown}
                    onChange={(e) => setForm((s) => ({ ...s, hometown: e.target.value }))}
                    placeholder="Ví dụ: Nam Định"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-address">Địa chỉ hiện tại</Label>
                <Input
                  id="register-address"
                  value={form.address}
                  onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                  placeholder="Ví dụ: Cầu Giấy, Hà Nội"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="register-bio">Ghi chú đối chiếu</Label>
                <Textarea
                  id="register-bio"
                  value={form.bio}
                  onChange={(e) => setForm((s) => ({ ...s, bio: e.target.value }))}
                  placeholder="Ví dụ: Con thứ hai của chi 3, đang sống tại Hà Nội, mong được gắn vào hồ sơ gia phả đã có sẵn."
                />
              </div>

              {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              {notice ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}

              <div className="flex flex-wrap gap-3">
                {!completeMode ? (
                  <Button asChild variant="outline" type="button">
                    <Link href={`/register?next=${encodeURIComponent(nextUrl)}`}>Quay lại bước 1</Link>
                  </Button>
                ) : null}
                <Button className="h-11 flex-1 min-w-[220px]" disabled={busy} type="submit">
                  {busy
                    ? completeMode
                      ? "Đang lưu hồ sơ..."
                      : "Đang tạo tài khoản..."
                    : completeMode
                      ? "Lưu hồ sơ và tiếp tục"
                      : "Hoàn tất đăng ký"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
