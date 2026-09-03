export interface ShareStats {
  perYear: number;
  perTrip: number;
  agencies: number;
  city: string;
}

/** Render a 1200×630 share card to a PNG blob, entirely client-side. */
async function draw(s: ShareStats): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  try {
    await document.fonts.ready;
  } catch {
    /* fonts may already be ready */
  }

  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(220, 140, 0, 220, 140, 720);
  glow.addColorStop(0, "rgba(91,83,255,0.16)");
  glow.addColorStop(1, "rgba(91,83,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  const PAD = 84;
  // wordmark
  ctx.fillStyle = "#f5333f";
  ctx.beginPath();
  ctx.arc(PAD + 8, 98, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px 'Bricolage Grotesque', sans-serif";
  ctx.fillText("UNWATCHED", PAD + 30, 108);

  // the number
  ctx.fillStyle = "#f5333f";
  ctx.font = "700 150px 'JetBrains Mono', monospace";
  ctx.fillText(`${s.perYear.toLocaleString()}×`, PAD, 348);

  ctx.fillStyle = "#e6e7ea";
  ctx.font = "500 34px 'Hanken Grotesk', sans-serif";
  ctx.fillText("times my plate is logged per year", PAD, 408);

  ctx.fillStyle = "#9aa0ac";
  ctx.font = "400 26px 'Hanken Grotesk', sans-serif";
  const sub =
    `commuting through ${s.city}` +
    (s.agencies ? ` · ${s.agencies} ${s.agencies === 1 ? "agency" : "agencies"}` : "");
  ctx.fillText(sub, PAD, 454);

  ctx.fillStyle = "#5b53ff";
  ctx.font = "600 28px 'Hanken Grotesk', sans-serif";
  ctx.fillText("See your number  →  unwatched.onrender.com", PAD, H - 72);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

/** Share the exposure card via the native share sheet, or download it. */
export async function shareExposure(s: ShareStats): Promise<void> {
  const blob = await draw(s);
  const file = new File([blob], "unwatched-exposure.png", { type: "image/png" });
  const text = `I'd be logged by license-plate readers ~${s.perYear.toLocaleString()}× a year on my commute. Map yours:`;
  const nav = navigator as Navigator & {
    canShare?: (d: unknown) => boolean;
    share?: (d: unknown) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: "Unwatched", text, url: "https://unwatched.onrender.com" });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // user cancelled — don't download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unwatched-exposure.png";
  a.click();
  URL.revokeObjectURL(url);
}
