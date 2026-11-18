import { processImage } from "../../eleventy.config.js";

// Every artwork file in this folder becomes a page at /art/<name>/
export default {
  layout: "artwork.njk",
  permalink: data => `/art/${data.page.fileSlug}/`,
  eleventyComputed: {
    pic: async data => {
      const p = await processImage(data.image);
      return p && { thumb: p.thumb, large: p.large, width: p.width, height: p.height, webpSrcset: p.webpSrcset, jpegSrcset: p.jpegSrcset };
    },
    // Sizes are always inches, so "16 × 20 in" shows as "16 × 20"
    sizeText: data => String(data.size || "").replace(/\s*(in\.?|inch(es)?|["”″])\s*$/i, "").trim(),
    // Unique search/share description for each piece, e.g.
    // "Cougar Portrait, an original pencil drawing (16 × 20 in) by Boise, Idaho artist Cindy Smith. Original $350; prints $50."
    description: data => {
      const st = data.settings || {};
      const kind = data.medium === "Acrylic" ? "an original acrylic painting" : "an original pencil drawing";
      const size = String(data.size || "").replace(/\s*(in\.?|inch(es)?|["”″])\s*$/i, "").trim();
      const prices = [
        !data.sold && data.original_price ? `Original $${data.original_price}` : (data.sold ? "Original sold" : ""),
        data.prints_available !== false ? `prints $${data.print_price || st.print_price_default || 50}` : "",
      ].filter(Boolean).join("; ");
      return `${data.title}, ${kind}${size ? ` (${size} in)` : ""} by ${st.city || "Boise"}, ${st.region || "Idaho"} artist ${st.artist || "Cindy Smith"}.${prices ? ` ${prices}.` : ""}`;
    },
    // Picture shown when the page is shared (Facebook, texts)
    ogImage: async data => { const p = await processImage(data.image); return p ? p.large : null; },
    printPrice: data => (data.print_price || data.print_price === 0) ? data.print_price : data.settings.print_price_default,
    canBuyOriginal: data => !data.sold && !!data.original_price,
    canBuyPrint: data => data.prints_available !== false,
  },
};
