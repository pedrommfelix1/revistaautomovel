import { useEffect } from "react";

function upsertMeta(selector: string, attribute: "name" | "property", value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertJsonLd(id: string, data: Record<string, unknown> | null) {
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    script?.remove();
    return;
  }
  if (!script) {
    script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

export function useArticleHead(input: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  slug?: string | null;
  authorName?: string | null;
  publishedAt?: Date | string | null;
  updatedAt?: Date | string | null;
}) {
  useEffect(() => {
    const title = input.title?.trim() || "Auto Turbo";
    const description = input.description?.trim() || "Ensaios, cultura e design automóvel com uma leitura editorial cuidada.";
    document.title = `${title} · Auto Turbo`;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    const imageUrl = input.image ? (input.image.startsWith("http") ? input.image : `${window.location.origin}${input.image}`) : null;
    if (imageUrl) {
      upsertMeta('meta[property="og:image"]', "property", "og:image", imageUrl);
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", imageUrl);
    }
    const canonical = input.slug ? `${window.location.origin}/artigo/${input.slug}` : null;
    if (canonical) {
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // NewsArticle structured data — one of the technical signals Google's
    // algorithmic News/Top-stories inclusion looks at (no manual submission
    // exists any more; eligibility is entirely automated based on content
    // quality plus signals like this).
    const jsonLd = input.slug
      ? {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: title,
          description,
          ...(imageUrl ? { image: [imageUrl] } : {}),
          ...(input.publishedAt ? { datePublished: new Date(input.publishedAt).toISOString() } : {}),
          ...(input.updatedAt ? { dateModified: new Date(input.updatedAt).toISOString() } : {}),
          ...(input.authorName ? { author: { "@type": "Person", name: input.authorName } } : {}),
          publisher: {
            "@type": "Organization",
            name: "Auto Turbo",
            logo: { "@type": "ImageObject", url: `${window.location.origin}/favicon.png` },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        }
      : null;
    upsertJsonLd("article-jsonld", jsonLd);

    return () => upsertJsonLd("article-jsonld", null);
  }, [input.title, input.description, input.image, input.slug, input.authorName, input.publishedAt, input.updatedAt]);
}
