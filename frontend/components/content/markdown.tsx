import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";

const components: Components = {
  pre({ children }) {
    // biome-ignore lint/a11y/useSemanticElements lint/a11y/noNoninteractiveTabindex: Name and focus the actual scroll container so keyboard readers can scroll long code lines.
    return <pre tabIndex={0} role="region" aria-label="Code example">{children}</pre>;
  },
  img({ alt, src, title }) {
    if (!alt?.trim()) {
      return <span>Image omitted: descriptive alternative text is required.</span>;
    }
    if (typeof src !== "string" || !src) {
      return <span>Image unavailable: {alt}</span>;
    }
    return (
      // biome-ignore lint/performance/noImgElement: Markdown uploads have no intrinsic dimensions; use the public media URL without an optimization proxy.
      <img src={src} alt={alt} title={title} className={src === "/icons/email.svg" || src === "/icons/github.svg" ? "markdown-icon" : undefined} loading="lazy" decoding="async" />
    );
  },
};

export function Markdown({ source }: { source: string }) {
  return <div className="markdown"><ReactMarkdown skipHtml remarkPlugins={[remarkBreaks]} components={components}>{source}</ReactMarkdown></div>;
}
