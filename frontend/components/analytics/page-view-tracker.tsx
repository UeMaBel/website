"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createPageViewPayload,
  getUmamiScriptUrl,
  isPublicAnalyticsPath,
  sendPageView,
  type PageViewPayload,
  type UmamiTracker,
} from "../../lib/analytics";

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

interface PageViewTrackerProps {
  enabled: boolean;
  scriptUrl: string;
  siteOrigin: string;
  websiteId: string;
}

export function PageViewTracker({ enabled, scriptUrl, siteOrigin, websiteId }: PageViewTrackerProps) {
  const pathname = usePathname();
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const lastObservedPath = useRef<string | null>(null);
  const hasObservedPublicPage = useRef(false);
  const pendingViews = useRef<PageViewPayload[]>([]);
  const validScriptUrl = getUmamiScriptUrl(scriptUrl, siteOrigin);
  const validWebsiteId = /^[a-zA-Z0-9_-]{1,128}$/.test(websiteId);
  const configured = enabled && validScriptUrl !== null && validWebsiteId;
  const publicPath = pathname ? isPublicAnalyticsPath(pathname) : false;

  useEffect(() => {
    if (!pathname || pathname === lastObservedPath.current) return;
    lastObservedPath.current = pathname;

    if (!configured || !isPublicAnalyticsPath(pathname)) return;

    const payload = createPageViewPayload(
      pathname,
      websiteId,
      window.location.hostname,
      window.location.origin,
      hasObservedPublicPage.current ? undefined : document.referrer,
    );
    if (!payload) return;
    hasObservedPublicPage.current = true;

    if (scriptReady) {
      sendPageView(window.umami, payload);
    } else if (!scriptFailed) {
      pendingViews.current.push(payload);
    }
  }, [configured, pathname, scriptFailed, scriptReady, websiteId]);

  useEffect(() => {
    if (!scriptReady) return;
    const queuedViews = pendingViews.current.splice(0);
    queuedViews.forEach((payload) => {
      sendPageView(window.umami, payload);
    });
  }, [scriptReady]);

  if (!configured || !publicPath || !validScriptUrl) return null;

  return (
    <Script
      id="umami-analytics"
      src={validScriptUrl}
      strategy="afterInteractive"
      data-website-id={websiteId}
      data-auto-track="false"
      data-do-not-track="true"
      data-exclude-search="true"
      data-exclude-hash="true"
      onReady={() => setScriptReady(true)}
      onError={() => {
        pendingViews.current = [];
        setScriptFailed(true);
      }}
    />
  );
}
