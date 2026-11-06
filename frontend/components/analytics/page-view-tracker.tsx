"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isPublicAnalyticsPath, referrerSource, sendContribution, type ReferrerSource } from "../../lib/analytics";
interface ViewingPage {
  path: string; source: ReferrerSource; started: number | null; pending: number; sentSeconds: number; counted: boolean;
}
export function PageViewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const page = useRef<ViewingPage | null>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    const privacyPreference = () => navigator.doNotTrack === "1"
      || ("globalPrivacyControl" in navigator && navigator.globalPrivacyControl === true);
    if (!enabled || !pathname || !isPublicAnalyticsPath(pathname) || privacyPreference()) {
      page.current = null;
      return;
    }
    if (page.current?.path !== pathname) {
      page.current = {
        path: pathname,
        source: firstPage.current ? referrerSource(document.referrer, window.location.origin) : "direct",
        started: null, pending: 0, sentSeconds: 0, counted: false,
      };
      firstPage.current = false;
    }
    const current = page.current;
    function flush() {
      if (current.started !== null) {
        current.pending += Math.min(30_000, Math.max(0, performance.now() - current.started));
        current.started = null;
      }
      const seconds = Math.min(30, 1800 - current.sentSeconds, Math.floor(current.pending / 5000) * 5);
      if (seconds > 0 && !privacyPreference()) {
        sendContribution({ path: current.path, referrer: current.source, views: 0, seconds });
        current.pending -= seconds * 1000;
        current.sentSeconds += seconds;
      }
    }
    function resume() {
      if (document.visibilityState !== "visible" || privacyPreference()) return;
      if (!current.counted) {
        sendContribution({ path: current.path, referrer: current.source, views: 1, seconds: 0 });
        current.counted = true;
      }
      if (current.started === null && current.sentSeconds < 1800) current.started = performance.now();
    }
    function visibility() { if (document.visibilityState === "visible") resume(); else flush(); }
    function heartbeat() { flush(); resume(); }
    resume();
    const interval = window.setInterval(heartbeat, 30_000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("pageshow", resume);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("pageshow", resume);
      flush();
    };
  }, [enabled, pathname]);
  return null;
}
