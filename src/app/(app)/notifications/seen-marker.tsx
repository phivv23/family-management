"use client";

import { useEffect } from "react";
import { markSystemNotificationsSeenAction } from "./actions";

export function NotificationsSeenMarker({ clanId }: { clanId: string }) {
  useEffect(() => {
    void markSystemNotificationsSeenAction(clanId);
  }, [clanId]);

  return null;
}
