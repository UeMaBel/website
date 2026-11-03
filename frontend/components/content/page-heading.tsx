import type { ReactNode } from "react";

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-heading">
      <h1><span className="page-title">{title}</span></h1>
      {children}
    </div>
  );
}
