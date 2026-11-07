import type { ContentThumbnail as Thumbnail } from "../../lib/api";

export function ContentThumbnail({ image, className = "" }: {
  image?: Thumbnail | null;
  className?: string;
}) {
  if (!image?.url.startsWith("/media/") || !image.alt_text.trim()) return null;

  return (
    // biome-ignore lint/performance/noImgElement: Uploaded media is served by the same-origin proxy.
    <img className={`content-thumbnail ${className}`} src={image.url} alt={image.alt_text} loading="lazy" decoding="async" />
  );
}
