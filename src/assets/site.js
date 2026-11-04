/* The Pencil Pusher: cart, gallery strip, full-screen viewer, shop tabs, checkout. No libraries. */
(function () {
  document.documentElement.classList.add("js");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const money = n => "$" + Number(n).toLocaleString("en-US");

  /* ---------- cart (kept in this browser only) ---------- */
  const KEY = "pp-cart";
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} count(); };
  const count = () => { const n = load().reduce((s, i) => s + i.qty, 0); $$("[data-cart-count]").forEach(e => e.textContent = n); };
  count();

  function toast(html) {
    const t = $("#toast"); if (!t) return;
    t.innerHTML = html; t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3200);
  }

  function addToCart(id, type, title) {
    const c = load(), hit = c.find(i => i.id === id && i.type === type);
    if (hit && type === "original") { toast(`The original is already in your cart. <a href="/cart/">View cart</a>`); return; }
    if (hit) hit.qty++; else c.push({ id, type, qty: 1 });
    save(c);
    toast(`Added ${title} (${type}). <a href="/cart/">View cart</a>`);
  }

  /* price switches when Original / Print is chosen */
  document.addEventListener("change", e => {
    const r = e.target.closest(".opts input"); if (!r) return;
    const p = r.closest(".buy-panel").querySelector(".price"); if (p) p.textContent = money(r.dataset.price);
  });

  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) {
      const panel = add.closest(".buy-panel"), sel = panel.querySelector(".opts input:checked");
      if (!sel) return;
      addToCart(add.dataset.add, sel.value, panel.querySelector(".art-title").textContent.trim());
      return;
    }
    const v = e.target.closest("[data-view]");
    if (v && ART.length && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openViewer(v.dataset.view); }
  });

  /* ---------- artwork list for the viewer ---------- */
  let ART = [];
  try { ART = JSON.parse(($("#art-data") || {}).textContent || "[]"); } catch (e) {}

  /* ---------- home page: thumbnails across the top, one large piece ---------- */
  const strip = $("#strip");
  if (strip) {
    const total = $$("button", strip).length;
    strip.addEventListener("click", e => {
      const b = e.target.closest("[data-feature]"); if (!b) return;
      const id = b.dataset.feature, a = ART.find(x => x.id === id); if (!a) return;
      $$("button", strip).forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
      const img = $("#feature-img");
      img.src = a.large; img.removeAttribute("srcset"); img.width = a.w; img.height = a.h;
      img.alt = `${a.title}, ${a.medium.toLowerCase()} by Cindy Smith`;
      const link = $("#feature-link"); link.href = a.url; link.setAttribute("aria-label", `${a.title}: see it in the shop`);
      $$("[data-slide]").forEach(s => s.hidden = s.dataset.slide !== id);
      $("#feature-count").textContent = `${ART.findIndex(x => x.id === id) + 1} of ${total} · ${a.medium}`;
    });
  }

  /* ---------- shop: Pencil / Acrylic tabs ---------- */
  const tabs = $(".tabs");
  if (tabs) {
    const show = () => {
      const m = location.hash === "#acrylic" ? "Acrylic" : "Pencil";
      $$("[data-tab]", tabs).forEach(a => a.dataset.tab === m ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current"));
      $$("[data-section]").forEach(s => s.hidden = s.dataset.section !== m);
    };
    tabs.addEventListener("click", e => { const a = e.target.closest("[data-tab]"); if (!a) return; e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); show(); });
    addEventListener("hashchange", show); show();
  }

  /* ---------- full-screen viewer with every piece across the top ---------- */
  let view, idx = 0, opener;
  function list() {
    // on the shop page, step through the medium being shown
    const sec = $$("[data-section]").find(s => !s.hidden);
    if (!sec) return ART;
    const ids = $$(".card", sec).map(c => c.dataset.id);
    return ART.filter(a => ids.includes(a.id));
  }
  function build() {
    view = document.createElement("div");
    view.className = "viewer"; view.hidden = true;
    view.setAttribute("role", "dialog"); view.setAttribute("aria-modal", "true"); view.setAttribute("aria-label", "Artwork viewer");
    view.innerHTML = `<div class="v-strip"></div><button type="button" class="v-x" aria-label="Close">✕</button>
      <div class="v-stage"><button type="button" class="v-nav" data-step="-1" aria-label="Previous">‹</button><figure><img alt=""></figure><button type="button" class="v-nav" data-step="1" aria-label="Next">›</button></div>
      <div class="v-panel"></div>`;
    document.body.appendChild(view);
    view.addEventListener("click", e => {
      const g = e.target.closest("[data-go]"), s = e.target.closest("[data-step]");
      if (g) show(+g.dataset.go); else if (s) show(idx + +s.dataset.step); else if (e.target.closest(".v-x")) close();
    });
    document.addEventListener("keydown", e => {
      if (view.hidden) return;
      if (e.key === "Escape") close(); if (e.key === "ArrowRight") show(idx + 1); if (e.key === "ArrowLeft") show(idx - 1);
    });
    let x0 = null;
    view.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
    view.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50 && e.target.closest(".v-stage")) show(idx + (dx < 0 ? 1 : -1)); x0 = null; });
  }
  let items = [];
  function show(i) {
    idx = (i + items.length) % items.length; const a = items[idx];
    const img = $("figure img", view); img.src = a.large; img.alt = `${a.title}, ${a.medium.toLowerCase()} by Cindy Smith`;
    const src = $(`.card[data-id="${a.id}"] .buy-panel`) || $(`.art-side[data-id="${a.id}"] .buy-panel`);
    const panel = $(".v-panel", view);
    panel.innerHTML = "";
    if (src) {
      const wrap = document.createElement("div"); wrap.className = "card"; wrap.dataset.id = a.id;
      const clone = src.cloneNode(true);
      $$("input", clone).forEach(r => { r.name = r.name + "-v"; });
      wrap.appendChild(clone); panel.appendChild(wrap);
    } else panel.innerHTML = `<h3 class="art-title">${a.title}</h3>`;
    panel.insertAdjacentHTML("beforeend", `<a class="v-link" href="${a.url}">Open this piece's page →</a>`);
    $$("[data-go]", view).forEach((b, j) => b.classList.toggle("on", j === idx));
    const cur = $("[data-go].on", view); if (cur) cur.scrollIntoView({ block: "nearest", inline: "center" });
  }
  function openViewer(id) {
    if (!view) build();
    items = list(); if (!items.find(a => a.id === id)) items = ART;
    $(".v-strip", view).innerHTML = items.map((a, i) => `<button type="button" data-go="${i}" aria-label="${a.title}"><img src="${a.thumb}" alt=""></button>`).join("");
    opener = document.activeElement; view.hidden = false; document.documentElement.classList.add("locked");
    show(items.findIndex(a => a.id === id)); $(".v-x", view).focus();
  }
  function close() { view.hidden = true; document.documentElement.classList.remove("locked"); if (opener) opener.focus(); }

  /* ---------- contact: preselect "commission" when coming from that page ---------- */
  const about = $("#c-about");
  if (about && /about=commission/.test(location.search)) about.value = "commission";

  /* ---------- cart page ---------- */
  const cartEl = $("#cart");
  if (cartEl) {
    const cfg = JSON.parse($("#shop-data").textContent);
    let products = {};
    const render = () => {
      const c = load().filter(i => products[i.id] && products[i.id][i.type] != null);
      save(c);
      const box = $("#cart-items"), sum = $("#cart-sum");
      if (!c.length) { box.innerHTML = `<p class="empty">Your cart is empty. <a href="/shop/">Visit the shop</a>.</p>`; sum.hidden = true; return; }
      sum.hidden = false;
      box.innerHTML = c.map((i, n) => { const p = products[i.id], each = p[i.type];
        return `<div class="line"><img src="${p.thumb}" alt="">
          <div><h3><a href="${p.url}">${p.title}</a></h3><p class="meta">${i.type === "original" ? "Original" : "Print"} · ${p.medium}${p.size ? " · " + p.size : ""}</p>
          ${i.type === "print" ? `<div class="qty"><button type="button" data-q="${n}" data-d="-1" aria-label="One fewer">−</button><span>${i.qty}</span><button type="button" data-q="${n}" data-d="1" aria-label="One more">+</button></div>` : ""}</div>
          <div class="lp"><span class="price">${money(each * i.qty)}</span><button type="button" class="rm" data-rm="${n}">Remove</button></div></div>`; }).join("");
      const ship = $("input[name=delivery]:checked").value === "ship";
      const items = c.reduce((s, i) => s + products[i.id][i.type] * i.qty, 0);
      const fee = ship ? (c.some(i => i.type === "original") ? cfg.shipOriginal : cfg.shipPrint) : 0;
      $("#sum-items").textContent = money(items);
      $("#sum-ship").textContent = ship ? money(fee) : "Free pickup";
      $("#sum-total").textContent = money(items + fee);
      $("#ship-note").textContent = ship ? "Shipping within the U.S. You'll enter your address at checkout." : cfg.pickup;
    };
    cartEl.addEventListener("click", e => {
      const c = load(), q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
      if (q) { const i = c[+q.dataset.q]; i.qty = Math.max(1, i.qty + +q.dataset.d); save(c); render(); }
      if (rm) { c.splice(+rm.dataset.rm, 1); save(c); render(); }
    });
    cartEl.addEventListener("change", e => { if (e.target.name === "delivery") render(); });
    $("#checkout").addEventListener("click", async () => {
      const btn = $("#checkout"), err = $("#cart-err");
      err.hidden = true; btn.disabled = true; btn.textContent = "Opening secure checkout…";
      try {
        const r = await fetch("/.netlify/functions/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: load(), delivery: $("input[name=delivery]:checked").value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(j.error || "Checkout isn't available right now.");
        location.href = j.url;
      } catch (e) {
        err.textContent = e.message + " Please try again, or use the Contact page and Cindy will help.";
        err.hidden = false; btn.disabled = false; btn.textContent = "Checkout with Square";
      }
    });
    fetch("/products.json").then(r => r.json()).then(j => { j.items.forEach(p => products[p.id] = p); render(); })
      .catch(() => { $("#cart-items").innerHTML = `<p class="empty">The cart couldn't load. Please refresh the page.</p>`; });
  }
})();
