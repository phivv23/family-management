"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteEventAction, updateEventAction } from "@/app/(app)/events/actions";
import { eventTypeEnum } from "@/lib/zod/event";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type EventRow = {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  member_id: string | null;
  note: string | null;
};

type MemberOpt = { id: string; full_name: string };

export function EventDetailClient({
  canManage,
  id,
  clanId,
}: {
  canManage: boolean;
  id: string;
  clanId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundMsg, setNotFoundMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"DEATH_ANNIVERSARY" | "MEETING" | "BIRTHDAY" | "OTHER">("OTHER");
  const [eventDate, setEventDate] = useState("");
  const [memberId, setMemberId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setNotFoundMsg(null);

      const { data, error: eventError } = await supabase
        .from("events")
        .select("id,title,event_type,event_date,member_id,note")
        .eq("id", id)
        .eq("clan_id", clanId)
        .maybeSingle();

      if (cancelled) return;

      if (eventError) {
        setError(eventError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setNotFoundMsg("Không tìm thấy sự kiện hoặc sự kiện không thuộc dòng họ đang chọn.");
        setLoading(false);
        return;
      }

      setEvent(data as EventRow);
      setTitle(data.title);
      setType(eventTypeEnum.parse(data.event_type));
      setEventDate(data.event_date);
      setMemberId(data.member_id ?? "");
      setNote(data.note ?? "");

      const { data: mems, error: memError } = await supabase
        .from("members")
        .select("id,full_name")
        .eq("clan_id", clanId)
        .order("full_name", { ascending: true })
        .limit(2000);

      if (cancelled) return;

      if (memError) {
        setError(memError.message);
      } else {
        setMembers((mems ?? []) as MemberOpt[]);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, id, clanId]);

  if (loading) {
    return <div className="text-sm text-slate-600">Đang tải dữ liệu sự kiện...</div>;
  }

  if (notFoundMsg) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {notFoundMsg}
        </div>
        <Button asChild variant="outline">
          <Link href="/events">Quay lại danh sách sự kiện</Link>
        </Button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Không thể tải dữ liệu sự kiện."}
        </div>
        <Button asChild variant="outline">
          <Link href="/events">Quay lại danh sách sự kiện</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{event.title}</h1>
          <p className="text-sm text-slate-600">Chi tiết sự kiện</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/events">Quay lại</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="font-semibold">Thông tin sự kiện</div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Tiêu đề</Label>
            <Input disabled={!canManage} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Loại sự kiện</Label>
              <select
                disabled={!canManage}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
                value={type}
                onChange={(e) => setType(eventTypeEnum.parse(e.target.value))}
              >
                <option value="DEATH_ANNIVERSARY">Giỗ</option>
                <option value="MEETING">Họp họ</option>
                <option value="BIRTHDAY">Sinh nhật</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Ngày diễn ra</Label>
              <Input
                disabled={!canManage}
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Liên kết thành viên (không bắt buộc)</Label>
            <select
              disabled={!canManage}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50"
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
            <Textarea disabled={!canManage} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const res = await updateEventAction({
                      id,
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

                    router.refresh();
                  });
                }}
              >
                {pending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>

              <Button
                disabled={pending}
                variant="outline"
                onClick={() => {
                  const ok = window.confirm("Bạn có chắc muốn xóa sự kiện này?");
                  if (!ok) return;

                  startTransition(async () => {
                    const res = await deleteEventAction(id);
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }

                    router.push("/events");
                    router.refresh();
                  });
                }}
              >
                Xóa sự kiện
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Bạn không có quyền chỉnh sửa (chỉ admin/clan_manager).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
