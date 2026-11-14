// POST /api/contact — the Contact / Commission request form and the (optional) newsletter signup.
// Emails the message straight to Cindy through Resend (resend.com), with any photos attached,
// and sets Reply-To to the visitor so she can just hit Reply.
//
// Variables and Secrets:
//   RESEND_API_KEY (secret)
//   CONTACT_TO    where messages go, e.g. Thepencilpusher123@gmail.com
//   CONTACT_FROM  optional sender, e.g. "The Pencil Pusher website <website@thepencilpusher.net>"
//                 (needs the domain verified in Resend; default works without that)
import { bytesToBase64, escapeHtml } from "../../lib/util.js";

const ABOUT = {
  question: "A question about a piece",
  commission: "A commission request",
  print: "A print in another size",
  other: "Something else",
};
const PHOTO_FIELDS = ["photo", "photo2", "photo3"];
const MAX_TOTAL = 20 * 1024 * 1024;

const redirect = (request, path) => Response.redirect(new URL(path, request.url).toString(), 303);

function errorPage(status, message, env) {
  const to = escapeHtml(env.CONTACT_TO || "");
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Message not sent · The Pencil Pusher</title>
<body style="font:17px/1.6 Georgia,serif;background:#25272a;color:#eceae6;max-width:40em;margin:12vh auto;padding:0 20px">
<h1 style="font-weight:400">Sorry, your message didn't go through</h1>
<p>${escapeHtml(message)}</p>
${to ? `<p>You can email Cindy directly at <strong>${to}</strong>.</p>` : ""}
<p><a style="color:#a3d3f2" href="javascript:history.back()">← Go back to your message</a></p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); } catch { return errorPage(400, "The form couldn't be read.", env); }
  if ((form.get("company") || "").toString().trim()) return redirect(request, "/thanks/"); // spam trap

  const kind = form.get("form-name") === "newsletter" ? "newsletter" : "contact";
  const email = (form.get("email") || "").toString().trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorPage(400, "Please go back and check your email address.", env);
  if (!env.RESEND_API_KEY || !env.CONTACT_TO) return errorPage(503, "The contact form isn't set up yet.", env);

  let subject, textBody, html;
  const attachments = [];

  if (kind === "newsletter") {
    subject = `Website: newsletter signup (${email})`;
    textBody = `${email} signed up to hear about new work.`;
    html = `<p><strong>${escapeHtml(email)}</strong> signed up to hear about new work.</p>`;
  } else {
    const name = (form.get("name") || "").toString().trim().slice(0, 200);
    const message = (form.get("message") || "").toString().trim().slice(0, 10000);
    const about = ABOUT[form.get("about")] || ABOUT.other;
    const neededBy = (form.get("needed_by") || "").toString().trim().slice(0, 200);
    if (!name || !message) return errorPage(400, "Please go back and fill in your name and message.", env);

    let total = 0;
    for (const field of PHOTO_FIELDS) {
      const f = form.get(field);
      if (!f || typeof f === "string" || !f.size) continue;
      total += f.size;
      if (total > MAX_TOTAL) return errorPage(413, "The photos are too large together. Please send smaller photos (under 20 MB in total).", env);
      attachments.push({ filename: (f.name || `${field}.jpg`).replace(/[^\w.\- ]/g, "_").slice(0, 100), content: bytesToBase64(new Uint8Array(await f.arrayBuffer())) });
    }

    subject = `Website: ${about} from ${name}`;
    const rows = [["Name", name], ["Email", email], ["About", about], ...(neededBy ? [["Needed by", neededBy]] : []), ["Photos", attachments.length ? `${attachments.length} attached` : "none"]];
    textBody = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${message}\n\n(Reply to this email to answer ${name}.)`;
    html = `<table style="font:15px Arial,sans-serif;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:3px 14px 3px 0;color:#666">${k}</td><td style="padding:3px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join("")}</table>
<p style="font:16px/1.5 Georgia,serif;white-space:pre-wrap;margin-top:16px">${escapeHtml(message)}</p>
<p style="font:13px Arial,sans-serif;color:#666">Reply to this email to answer ${escapeHtml(name)}.</p>`;
  }

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.CONTACT_FROM || "The Pencil Pusher website <onboarding@resend.dev>",
      to: env.CONTACT_TO.split(",").map(s => s.trim()).filter(Boolean),
      reply_to: email,
      subject, text: textBody, html,
      ...(attachments.length ? { attachments } : {}),
    }),
  }).catch(err => ({ ok: false, status: 0, text: async () => err.message }));

  if (!r.ok) {
    console.error("contact: Resend error", r.status, await r.text().catch(() => ""));
    return errorPage(502, "Something went wrong sending it. Please try again in a minute.", env);
  }
  return redirect(request, kind === "newsletter" ? "/thanks/?signup" : "/thanks/");
}
