import type { ReactNode } from "react";

export function ContentSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="content-section section-divider" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <div className="content-section-body">{children}</div>
    </section>
  );
}
