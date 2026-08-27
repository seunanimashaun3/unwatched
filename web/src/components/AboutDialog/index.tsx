import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Privacy statement + use-at-your-own-risk disclaimer. A small trigger link
 * (styleable via className) opens a modal. Placed on the landing and reachable
 * from the app so the privacy posture is loud and the legal footing is clear.
 */
export default function AboutDialog({ className, label = "Privacy & terms" }: { className?: string; label?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("transition-colors", className)}>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Privacy and terms">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="glass relative max-h-[85dvh] w-[min(34rem,100%)] overflow-y-auto rounded-2xl border border-border p-5 shadow-2xl sm:p-6">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 text-faint transition-colors hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-xl font-bold tracking-tight">Privacy &amp; terms</h2>
            </div>

            <section className="mb-5">
              <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">Private by design</h3>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <li>• No account, ever — nothing to sign up for.</li>
                <li>• No tracking, analytics, ads, or cookies.</li>
                <li>
                  • Route planning runs <b className="text-foreground">entirely in your browser</b>. Your start,
                  destination, and routes never leave your device — we can't see them and we don't log them.
                </li>
                <li>• Map and camera data are served as plain static files; we don't record who requests what.</li>
              </ul>
            </section>

            <section className="mb-5">
              <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">Use at your own risk</h3>
              <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <li>
                  • This is an <b className="text-foreground">informational tool provided "as is,"</b> with no warranty
                  of any kind.
                </li>
                <li>
                  • Camera locations are <b className="text-foreground">crowdsourced and known to be incomplete</b> — a
                  lower bound, not a guarantee. The absence of a camera on the map does not mean none is there, and
                  mobile, temporary, or unmapped cameras aren't shown.
                </li>
                <li>• Don't rely on it for safety-critical decisions. Obey all traffic laws and drive attentively.</li>
                <li>
                  • It is intended for <b className="text-foreground">lawful purposes only</b> — understanding and
                  reducing your own surveillance exposure. <b className="text-foreground">Do not use it to facilitate,
                  plan, or conceal any illegal activity.</b>
                </li>
                <li>
                  • You use it <b className="text-foreground">entirely at your own risk</b>. The creators and operators
                  accept no liability for how it is used, for the accuracy or completeness of the data, or for any
                  outcome arising from its use.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="mb-1.5 text-[13px] font-semibold text-foreground">Data sources</h3>
              <p className="text-[12.5px] leading-relaxed text-faint">
                Roads: Overture Maps · Cameras: DeFlock / OpenStreetMap · Demographics: US Census ACS 5-year ·
                Basemap: OpenFreeMap / OpenStreetMap. Not affiliated with, or endorsed by, any of these.
              </p>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
