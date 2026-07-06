import React from "react";
import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  schema?: Record<string, any>;
  // Advanced SEO optimization attributes
  keywords?: string | string[];
  canonicalUrl?: string;
  // Product specific meta tags
  productPrice?: number;
  productCurrency?: string;
  productAvailability?: string;
  productCategory?: string;
  // Article/Blog specific meta tags
  articleAuthor?: string;
  articlePublishedTime?: string;
}

export default function SEO({ 
  title, 
  description = "Sokoplus - Kenya's premium marketplace for local artisans and global quality standards.", 
  image = "/og-image.jpg", 
  url, 
  type = "website",
  schema,
  keywords,
  canonicalUrl,
  productPrice,
  productCurrency = "KES",
  productAvailability,
  productCategory,
  articleAuthor,
  articlePublishedTime
}: SEOProps) {
  const siteTitle = "Sokoplus";
  
  // Clean description: strip any Markdown / special formatting characters & truncate to safe 155-160 length
  const cleanDescription = React.useMemo(() => {
    if (!description) return "";
    const plainText = description
      .replace(/[#*_`~\n\r-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plainText.length > 155 ? `${plainText.substring(0, 152)}...` : plainText;
  }, [description]);

  // Clean title for SERPs (max 60 characters is ideal for search engine display)
  const cleanTitle = React.useMemo(() => {
    if (!title) return siteTitle;
    return title.length > 50 ? `${title.substring(0, 47)}...` : title;
  }, [title]);

  const fullTitle = title ? `${cleanTitle} | ${siteTitle}` : `${siteTitle} - Premium Kenyan Marketplace`;

  // Determine current absolute location if window is defined
  const currentUrl = React.useMemo(() => {
    if (url) return url;
    if (typeof window !== "undefined") {
      return window.location.href;
    }
    return "https://www.sokoplus.co.ke";
  }, [url]);

  const finalCanonical = canonicalUrl || currentUrl;

  // Resolve keywords array or string
  const processedKeywords = React.useMemo(() => {
    const defaultKeywords = ["handmade Kenyan craft", "artisan goods Nairobi", "online marketplace Kenya", "Maasai beadwork", "Sokoplus"];
    if (!keywords) return defaultKeywords.join(", ");
    if (Array.isArray(keywords)) {
      return [...new Set([...keywords, ...defaultKeywords])].join(", ");
    }
    return `${keywords}, ${defaultKeywords.join(", ")}`;
  }, [keywords]);

  // Handle image fallbacks elegantly
  const finalImage = React.useMemo(() => {
    if (image && image.trim() !== "") {
      if (image.startsWith("/") && typeof window !== "undefined") {
        return `${window.location.origin}${image}`;
      }
      return image;
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}/og-image.jpg`;
    }
    return "https://www.sokoplus.co.ke/og-image.jpg";
  }, [image]);

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDescription} />
      <meta name="keywords" content={processedKeywords} />
      <link rel="canonical" href={finalCanonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanDescription} />
      <meta property="og:image" content={finalImage} />
      <meta property="og:site_name" content="Sokoplus" />
      <meta property="og:locale" content="en_KE" />

      {/* Optimized Product Meta Tags (og:product namespace) */}
      {type === "product" && (
        <>
          {productPrice !== undefined && (
            <meta property="product:price:amount" content={productPrice.toString()} />
          )}
          <meta property="product:price:currency" content={productCurrency} />
          {productAvailability && (
            <meta property="product:availability" content={productAvailability} />
          )}
          {productCategory && (
            <meta property="product:category" content={productCategory} />
          )}
        </>
      )}

      {/* Optimized Article Meta Tags for Blog/Stories */}
      {type === "article" && (
        <>
          {articleAuthor && <meta property="article:author" content={articleAuthor} />}
          {articlePublishedTime && <meta property="article:published_time" content={articlePublishedTime} />}
          <meta property="article:section" content="Kenyan Craft & Commerce" />
        </>
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanDescription} />
      <meta name="twitter:image" content={finalImage} />
      <meta name="twitter:site" content="@Sokoplus" />
      <meta name="twitter:creator" content={articleAuthor ? `@${articleAuthor.replace(/\s+/g, "")}` : "@Sokoplus"} />

      {/* Dynamic Schema JSON-LD */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}
