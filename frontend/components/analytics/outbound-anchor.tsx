import type { ReactNode } from "react";
interface OutboundAnchorProps {
  href: string; category: "contact_email" | "contact_profile" | "repository" | "demo";
  children: ReactNode; target?: string; rel?: string;
}
// Outbound links no longer produce analytics events.
export function OutboundAnchor({ href, children, target, rel }: OutboundAnchorProps) {
  return <a href={href} target={target} rel={rel}>{children}</a>;
}
