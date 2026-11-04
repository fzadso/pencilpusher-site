/* Live preview in the editor: shows the piece the way it will look in the shop. */
(function () {
  if (!window.CMS) return;
  CMS.registerPreviewStyle("https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;1,400&family=Work+Sans:wght@400;500;600&display=swap");
  CMS.registerPreviewStyle("/assets/site.css");
  CMS.registerPreviewStyle("/admin/preview.css");
  var h = window.h;
  var money = function (n) { return "$" + Number(n).toLocaleString("en-US"); };

  var ArtPreview = createClass({
    render: function () {
      var d = this.props.entry.get("data");
      var get = function (k) { return d.get(k); };
      var img = get("image") ? String(this.props.getAsset(get("image"))) : "";
      var sold = !!get("sold"), op = get("original_price"), prints = get("prints_available") !== false;
      var pp = get("print_price") == null || get("print_price") === "" ? 50 : get("print_price");
      var canOrig = !sold && !!op;
      var price = canOrig ? money(op) : (prints ? money(pp) : "");
      var body = this.props.widgetFor("body");
      return h("div", { className: "pv" },
        h("p", { className: "pv-note" }, "Preview: how this piece will look on the website"),
        h("div", { className: "art-page" },
          h("figure", { className: "art-figure" },
            img ? h("img", { src: img, alt: "" }) : h("div", { className: "pv-empty" }, "Add a photo to see it here"),
            sold ? h("span", { className: "sold-tag" }, "Original sold") : null),
          h("div", { className: "card art-side" },
            h("div", { className: "buy-panel" },
              h("h3", { className: "art-title" }, get("title") || "Title"),
              h("p", { className: "meta" }, [get("medium") || "Pencil", get("size"), get("year")].filter(Boolean).join(" · ")),
              (canOrig || prints) ? h("fieldset", { className: "opts" },
                canOrig ? h("label", null, h("input", { type: "radio", checked: true, readOnly: true }), " Original") : null,
                prints && canOrig ? h("label", null, h("input", { type: "radio", readOnly: true }), " Print") : null,
                prints && !canOrig ? h("label", { className: "only" }, sold ? "Original sold · print available" : "Print available") : null) : h("p", { className: "meta" }, "Not for sale"),
              price ? h("div", { className: "buy-row" }, h("span", { className: "price" }, price), h("span", { className: "btn" }, "Add to cart")) : null),
            get("body") ? h("div", { className: "story" }, body) : null,
            prints ? h("p", { className: "note" }, "Print: " + money(pp) + ", same size as the original.") : null)));
    }
  });
  CMS.registerPreviewTemplate("art", ArtPreview);
})();
