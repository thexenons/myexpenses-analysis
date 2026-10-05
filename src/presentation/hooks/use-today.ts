import { useEffect, useState } from "react";

import { isoDateInTimeZone } from "../../domain/analytics/date-periods.ts";
import type { IsoDate } from "../../domain/analytics/types.ts";

export function useToday(timeZone: string): IsoDate {
  const [snapshot, setSnapshot] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setSnapshot((previous) =>
        isoDateInTimeZone(previous, timeZone) === isoDateInTimeZone(now, timeZone)
          ? previous
          : now,
      );
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [timeZone]);

  return isoDateInTimeZone(snapshot, timeZone);
}
