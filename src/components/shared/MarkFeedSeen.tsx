"use client";

import { useEffect } from "react";
import { markFeedSeen } from "@/components/shared/NewReportsBell";

/** Looking at the feed is what "seen" means, so the bell resets here. */
export function MarkFeedSeen() {
  useEffect(() => {
    markFeedSeen();
  }, []);

  return null;
}
