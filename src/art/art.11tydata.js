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
    printPrice: data => (data.print_price || data.print_price === 0) ? data.print_price : data.settings.print_price_default,
    canBuyOriginal: data => !data.sold && !!data.original_price,
    canBuyPrint: data => data.prints_available !== false,
  },
};
