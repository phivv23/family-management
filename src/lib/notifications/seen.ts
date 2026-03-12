export function systemNotificationSeenCookieName(clanId: string) {
  return `qldh_sys_notif_seen_${clanId}`;
}

export function normalizeSeenAtCookie(value: string | undefined | null) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}
