import Image from "@11ty/eleventy-img";
import path from "node:path";

// Turn a CMS image path like "/uploads/fox.jpg" into resized web images.
// Large phone photos are shrunk automatically; nothing is ever enlarged.
export async function processImage(src, widths = [480, 960, 1800]) {
  if (!src) return null;
  const file = path.join("src", src.replace(/^\//, ""));
  let meta;
  try { meta = await Image(file, {
    widths,
    formats: ["webp", "jpeg"],
    outputDir: "_site/img/",
    urlPath: "/img/",
    sharpJpegOptions: { quality: 82, progressive: true },
    sharpWebpOptions: { quality: 80 },
  }); } catch (err) {
    // A photo the site can't read (e.g. an iPhone HEIC file) shouldn't take the whole site down.
    console.warn(`[images] Skipped ${src}: ${err.message}`);
    return null;
  }
  const jpg = meta.jpeg, webp = meta.webp;
  const big = jpg[jpg.length - 1];
  return {
    meta,
    width: big.width,
    height: big.height,
    thumb: jpg[0].url,
    large: big.url,
    webpSrcset: webp.map(i => i.srcset).join(", "),
    jpegSrcset: jpg.map(i => i.srcset).join(", "),
  };
}

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/admin");
  // Original uploads are NOT published as-is (phone photos can contain GPS location).
  // Only the resized copies made below (metadata removed) go on the website.
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // {% picture "/uploads/x.jpg", "Alt text", "(max-width: 600px) 100vw, 50vw", "class" %}
  eleventyConfig.addNunjucksAsyncShortcode("picture", async (src, alt, sizes = "100vw", cls = "", loading = "lazy") => {
    const p = await processImage(src);
    if (!p) return "";
    return `<picture><source type="image/webp" srcset="${p.webpSrcset}" sizes="${sizes}"><img src="${p.large}" srcset="${p.jpegSrcset}" sizes="${sizes}" alt="${alt || ""}" width="${p.width}" height="${p.height}" loading="${loading}" decoding="async"${cls ? ` class="${cls}"` : ""}></picture>`;
  });

  eleventyConfig.addCollection("art", api =>
    api.getFilteredByGlob("src/art/*.md").sort((a, b) => b.date - a.date));

  eleventyConfig.addFilter("money", n => (n || n === 0) ? "$" + Number(n).toLocaleString("en-US") : "");
  eleventyConfig.addFilter("byMedium", (items, m) => items.filter(i => i.data.medium === m));
  eleventyConfig.addFilter("featured", items => { const f = items.filter(i => i.data.featured !== false); return f.length ? f : items; });
  eleventyConfig.addFilter("json", v => JSON.stringify(v).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("isoDate", d => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("plain", s => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
