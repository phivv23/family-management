"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMemberUpdateRequestAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { genderLabel } from "@/lib/i18n/labels";

type Member = {
  id: string;
  full_name: string;
  gender: string;
  dob: string | null;
  dod: string | null;
  bio: string | null;
};

export function MeRequestForm({ member }: { member: Member }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState(member.full_name);
  const [gender, setGender] = useState(member.gender);
  const [dob, setDob] = useState(member.dob ?? "");
  const [dod, setDod] = useState(member.dod ?? "");
  const [bio, setBio] = useState(member.bio ?? "");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label>Họ tên đề xuất</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Giới tính</Label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="MALE">{genderLabel("MALE")}</option>
            <option value="FEMALE">{genderLabel("FEMALE")}</option>
            <option value="OTHER">{genderLabel("OTHER")}</option>
            <option value="UNKNOWN">{genderLabel("UNKNOWN")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Ngày sinh</Label>
          <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Ngày mất</Label>
          <Input type="date" value={dod} onChange={(e) => setDod(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Tiểu sử</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} />
      </div>
      <div className="space-y-1">
        <Label>Ghi chú cho người duyệt</Label>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ví dụ: bổ sung ngày sinh theo giấy tờ mới" />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          setSuccess(null);
          startTransition(async () => {
            const res = await createMemberUpdateRequestAction({
              memberId: member.id,
              fullName,
              gender,
              dob: dob || null,
              dod: dod || null,
              bio: bio || null,
              note: note || null,
            });
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setSuccess("Đã gửi đề xuất cập nhật hồ sơ.");
            setNote("");
            router.refresh();
          });
        }}
      >
        {pending ? "Đang gửi..." : "Gửi đề xuất"}
      </Button>
    </div>
  );
}
