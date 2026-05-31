// Unified field-map PDF export (internal use). Builds one PDF in the browser
// with pdf-lib: cover → region overview → per field (info + primary map front
// page, then one full page per layout). Triggered by the "📄 PDF" button.
//
// Images are pulled through the same-origin /api/img proxy (no CORS dance) and
// downscaled to JPEG so the file stays a sensible size. Uses globals from
// app.js: api(), toast(), modal(); and PDFLib from the CDN.
(function () {
  const W = 792, H = 612;                 // US Letter, landscape (points)
  const MAROON = [0.557, 0.16, 0.16], DARK = [0.13, 0.12, 0.12], GREY = [0.42, 0.42, 0.42];

  // pdf-lib StandardFonts are WinAnsi — drop anything it can't encode.
  const t = (s) => String(s == null ? "" : s).replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, "");
  const layoutLabel = (vid) =>
    vid === "game" ? "Game Day" : vid === "practice" ? "Practice" : vid === "wayfinder" ? "Wayfinder"
      : vid.charAt(0).toUpperCase() + vid.slice(1).replace(/-/g, " ");
  const cityRank = (loc) => /altadena/i.test(loc) ? 1 : /ca.?ada/i.test(loc) ? 2 : 0;

  // Fetch a committed map PNG via the proxy, downscale, return JPEG bytes (or null).
  async function fetchJpeg(slug, variant, maxW) {
    const r = await fetch("/api/img/" + slug + "/" + variant);
    if (!r.ok) return null;
    const bmp = await createImageBitmap(await r.blob());
    const scale = Math.min(1, (maxW || 1600) / bmp.width);
    const cw = Math.round(bmp.width * scale), ch = Math.round(bmp.height * scale);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    cv.getContext("2d").drawImage(bmp, 0, 0, cw, ch);
    if (bmp.close) bmp.close();
    const b64 = cv.toDataURL("image/jpeg", 0.85).split(",")[1]; // atob (not fetch) — CSP connect-src has no data:
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function build() {
    if (!window.PDFLib) return toast("PDF library didn't load.", "error");
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const col = (c) => rgb(c[0], c[1], c[2]);
    modal(true, "Building PDF…", '<p class="subtle">Gathering field maps — this can take a minute.</p>');
    try {
      const fields = (await api("/api/fields")).filter((f) => f.hasMap);
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);

      const header = (page, title) => {
        page.drawRectangle({ x: 0, y: H - 46, width: W, height: 46, color: col(MAROON) });
        page.drawText(t(title), { x: 26, y: H - 31, size: 16, font: bold, color: rgb(1, 1, 1) });
      };
      const drawFit = (page, emb, bx, by, bw, bh) => {
        const s = Math.min(bw / emb.width, bh / emb.height);
        page.drawImage(emb, { x: bx + (bw - emb.width * s) / 2, y: by + (bh - emb.height * s) / 2, width: emb.width * s, height: emb.height * s });
      };
      async function imagePage(slug, variant, title, maxW) {
        const bytes = await fetchJpeg(slug, variant, maxW || 1700);
        if (!bytes) return false;
        const page = doc.addPage([W, H]); header(page, title);
        drawFit(page, await doc.embedJpg(bytes), 24, 24, W - 48, H - 46 - 36);
        return true;
      }

      // ── Cover ──
      const cover = doc.addPage([W, H]);
      try {
        const lr = await fetch("/apple-touch-icon.png");
        if (lr.ok) cover.drawImage(await doc.embedPng(await lr.arrayBuffer()), { x: (W - 110) / 2, y: H - 215, width: 110, height: 110 });
      } catch (_) {}
      const tw = bold.widthOfTextAtSize("AYSO Region 13", 46);
      cover.drawText("AYSO Region 13", { x: (W - tw) / 2, y: H - 295, size: 46, font: bold, color: col(MAROON) });
      const sw = font.widthOfTextAtSize("Field Maps", 28);
      cover.drawText("Field Maps", { x: (W - sw) / 2, y: H - 340, size: 28, font, color: col(DARK) });
      const stamp = "Internal reference — generated " + new Date().toISOString().slice(0, 10);
      cover.drawText(stamp, { x: (W - font.widthOfTextAtSize(stamp, 11)) / 2, y: 50, size: 11, font, color: col(GREY) });

      // ── Region overview ──
      await imagePage("overview", "map", "Region Overview");

      // ── Per field ──
      const ordered = [...fields].sort((a, b) => cityRank(a.locality) - cityRank(b.locality) || a.title.localeCompare(b.title));
      for (let i = 0; i < ordered.length; i++) {
        const f = ordered[i];
        modal(true, "Building PDF…", '<p class="subtle">Field ' + (i + 1) + " of " + ordered.length + " — " + t(f.title) + "</p>");
        let md = null; try { md = await api("/api/map/" + f.slug); } catch (_) {}
        const variants = md && md.variants ? Object.keys(md.variants) : [];
        if (!variants.length) continue;
        const ord = { game: 0, practice: 1, wayfinder: 2 };
        variants.sort((a, b) => (ord[a] != null ? ord[a] : 9) - (ord[b] != null ? ord[b] : 9));

        // Field front page: info (left) + primary map (right).
        const page = doc.addPage([W, H]); header(page, f.title);
        let y = H - 92;
        const row = (k, v) => { if (!v) return; page.drawText(t(k), { x: 36, y, size: 11, font: bold, color: col(MAROON) }); page.drawText(t(v), { x: 150, y, size: 11, font, color: col(DARK) }); y -= 19; };
        row("Location", [f.address, f.locality, f.postalCode].filter(Boolean).join(", "));
        row("Field maps", variants.map(layoutLabel).join(", "));
        row("Surface", f.surface);
        row("Parking", f.parking);
        row("Restrooms", f.restrooms);
        row("Lights", f.lighting);
        row("Snack bar", f.snackBar);
        const primary = await fetchJpeg(f.slug, variants[0], 1400);
        if (primary) drawFit(page, await doc.embedJpg(primary), W * 0.40, 36, W * 0.58, H - 46 - 60);

        // One full page per layout.
        for (const vid of variants) await imagePage(f.slug, vid, f.title + " — " + layoutLabel(vid));
      }

      modal(true, "Building PDF…", '<p class="subtle">Finalizing…</p>');
      const blob = new Blob([await doc.save()], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "ayso-region-13-field-maps.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      modal(false);
      toast("PDF downloaded (" + ordered.length + " fields).", "success");
    } catch (e) {
      modal(false); toast("PDF failed: " + ((e && e.message) || e), "error");
    }
  }

  const btn = document.getElementById("pdfBtn");
  if (btn) btn.addEventListener("click", build);
})();
