import type { MetadataRoute } from "next";
import { SITE_IS_CONFIGURED, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    // A sitemap pointing at localhost would only confuse crawlers.
    ...(SITE_IS_CONFIGURED ? { sitemap: `${SITE_URL}/sitemap.xml` } : {}),
  };
}
