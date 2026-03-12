"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createEventAction } from "@/app/(app)/events/actions";
import { eventTypeEnum } from "@/lib/zod/event";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { eventTypeLabel } from "@/lib/i18n/labels";

type MemberOpt = { id: string; full_name: string };

export function EventForm({ activeClanId }: { activeClanId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"DEATH_ANNIVERSARY" | "MEETING" | "BIRTHDAY" | "OTHER">("OTHER");
  const [eventDate, setEventDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [memberId, setMemberId] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("members")
        .select("id,full_name")
        .eq("clan_id", activeClanId)
        .order("full_name", { ascending: true })
        .limit(2000);

      setMembers((data ?? []) as MemberOpt[]);
    })();
  }, [supabase, activeClanId]);

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Tạo sự kiện mới</h1>
              <p className="text-sm text-slate-600">
                Lưu lịch giỗ, họp họ, sinh nhật hoặc các mốc hoạt động khác.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/events">Quay lại</Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Tiêu đề</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Loại sự kiện</Label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={type}
                onChange={(e) => setType(eventTypeEnum.parse(e.target.value))}
              >
                <option value="DEATH_ANNIVERSARY">{eventTypeLabel("DEATH_ANNIVERSARY")}</option>
                <option value="MEETING">{eventTypeLabel("MEETING")}</option>
                <option value="BIRTHDAY">{eventTypeLabel("BIRTHDAY")}</option>
                <option value="OTHER">{eventTypeLabel("OTHER")}</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Ngày diễn ra</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Liên kết thành viên (không bắt buộc)</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">Không liên kết</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label>Ghi chú</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await createEventAction({
                  title,
                  type,
                  eventDate,
                  memberId: memberId || null,
                  note: note || null,
                });

                if (!res.ok) {
                  setError(res.error);
                  return;
                }

                const start = `${eventDate.slice(0, 7)}-01`;
                const month = new Date(`${start}T00:00:00Z`);
                month.setUTCMonth(month.getUTCMonth() + 1);
                const to = month.toISOString().slice(0, 10);
                router.push(`/events?from=${start}&to=${to}&created=1`);
                router.refresh();
              });
            }}
          >
            {pending ? "Đang lưu..." : "Tạo sự kiện"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
