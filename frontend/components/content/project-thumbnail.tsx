import type { ContentThumbnail as Thumbnail } from "../../lib/api";
import { ContentThumbnail } from "./content-thumbnail";

export function ProjectThumbnail({ image, index }: { image?: Thumbnail | null; index: number }) {
  if (image?.url.startsWith("/media/") && image.alt_text.trim()) {
    return <ContentThumbnail image={image} frameClassName="work-thumbnail" />;
  }

  return (
    <div className={`project-art project-art-${index % 2}`} aria-hidden="true">
      <span>{index % 2 === 0 ? "{ · }" : "↗"}</span>
      <span className="art-caption">
        ENGINEERING / {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}
