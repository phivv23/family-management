"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createNotificationAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { notificationKindLabel } from "@/lib/i18n/labels";

type EventLite = { id: string; title: string; event_date: string };

export function NotificationForm({ events }: { events: EventLite[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("ANNOUNCEMENT");
  const [eventId, setEventId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1"><Label>Tiêu đề</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Loại</Label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="ANNOUNCEMENT">{notificationKindLabel("ANNOUNCEMENT")}</option>
            <option value="REMINDER">{notificationKindLabel("REMINDER")}</option>
            <option value="MEETING">{notificationKindLabel("MEETING")}</option>
          </select>
        </div>
      </div>
      <div className="space-y-1"><Label>Nội dung</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} /></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1"><Label>Gắn sự kiện</Label>
          <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">(không gắn)</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.event_date})</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label>Ngày nhắc</Label><Input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} /> Ghim thông báo</label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <Button disabled={pending} onClick={() => startTransition(async () => {
        setError(null);
        setSuccess(null);
        const res = await createNotificationAction({ title, body: body || null, kind, eventId: eventId || null, scheduledFor: scheduledFor || null, isPinned });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSuccess("Đã đăng thông báo mới.");
        setTitle("");
        setBody("");
        setEventId("");
        setScheduledFor("");
        setIsPinned(false);
        setKind("ANNOUNCEMENT");
        router.refresh();
      })}>{pending ? "Đang tạo..." : "Đăng thông báo"}</Button>
    </div>
  );
}
