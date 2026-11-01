"use client";

import type { ReactNode } from "react";
import {
  sendOutboundInterest,
  type OutboundInterestCategory,
} from "../../lib/analytics";

interface OutboundAnchorProps {
  href: string;
  category: OutboundInterestCategory;
  children: ReactNode;
  target?: string;
  rel?: string;
}

export function OutboundAnchor({
  href,
  category,
  children,
  target,
  rel,
}: OutboundAnchorProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={() => sendOutboundInterest(window.umami, category)}
    >
      {children}
    </a>
  );
}
