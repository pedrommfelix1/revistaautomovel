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

export function useArticleHead(input: { title?: string | null; description?: string | null; image?: string | null; slug?: string | null }) {
  useEffect(() => {
    const title = input.title?.trim() || "Motor de Linha";
    const description = input.description?.trim() || "Ensaios, cultura e design automóvel com uma leitura editorial cuidada.";
    document.title = `${title} · Motor de Linha`;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    if (input.image) {
      const imageUrl = input.image.startsWith("http") ? input.image : `${window.location.origin}${input.image}`;
      upsertMeta('meta[property="og:image"]', "property", "og:image", imageUrl);
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", imageUrl);
    }
    if (input.slug) {
      const canonical = `${window.location.origin}/artigo/${input.slug}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = canonical;
    }
  }, [input.title, input.description, input.image, input.slug]);
}
