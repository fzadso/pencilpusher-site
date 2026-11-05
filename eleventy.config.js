import Image from "@11ty/eleventy-img";
import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

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
  // Uploaded photos are published at /uploads/ (the editor uses them for previews),
  // but re-saved first so hidden details like GPS location are removed.
  eleventyConfig.on("eleventy.before", async () => {
    const out = "_site/uploads";
    await fs.mkdir(out, { recursive: true });
    for (const name of await fs.readdir("src/uploads")) {
      const src = path.join("src/uploads", name), dest = path.join(out, name);
      try {
        const done = await fs.stat(dest).catch(() => null);
        if (done && done.mtimeMs >= (await fs.stat(src)).mtimeMs) continue;
        await sharp(src).rotate().toFile(dest); // rotate() applies the photo's orientation; metadata is dropped
      } catch (err) {
        console.warn(`[uploads] Skipped ${name}: ${err.message}`);
      }
    }
  });
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
  // Shop order: pieces whose original is still for sale first, then sold ones (prints still for sale)
  eleventyConfig.addFilter("availableFirst", items => [...items].sort((a, b) => (a.data.sold ? 1 : 0) - (b.data.sold ? 1 : 0)));
  eleventyConfig.addFilter("byMedium", (items, m) => items.filter(i => i.data.medium === m));
  // Home page gallery: the pieces Cindy picked, in her order (first one shows large).
  // Optionally followed by any other pieces, newest first. Falls back to all art.
  eleventyConfig.addFilter("homeGallery", (items, home = {}) => {
    const bySlug = new Map(items.map(i => [i.fileSlug, i]));
    const picked = (home.gallery || []).map(s => bySlug.get(s)).filter(Boolean);
    const seen = new Set(picked);
    const rest = home.add_new_automatically === false ? [] : items.filter(i => !seen.has(i));
    const list = [...picked, ...rest];
    return list.length ? list : items;
  });
  // Previous / next piece of the same medium, wrapping around
  eleventyConfig.addFilter("neighbors", (items, url) => {
    const i = items.findIndex(x => x.url === url);
    if (i < 0 || items.length < 2) return null;
    return { prev: items[(i - 1 + items.length) % items.length], next: items[(i + 1) % items.length] };
  });
  eleventyConfig.addFilter("json", v => JSON.stringify(v).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("isoDate", d => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("plain", s => String(s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
