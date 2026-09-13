import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  Droplets,
  LocateFixed,
  MapPin,
  ScanLine,
  ShieldCheck,
  Waves,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { LandingMap } from "@/components/landing-map";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="page-width grid items-center gap-12 pb-14 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-18 lg:pb-17 lg:pt-17">
          <div className="enter">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6e0ca] bg-soft px-3 py-1.5 text-[10px] font-bold tracking-[.1em]">
              <span className="h-1.5 w-1.5 rounded-full bg-green" /> SMALL
              ACTIONS. SHARED WATER.
            </div>
            <h1 className="max-w-xl text-[45px] leading-[1.12] font-semibold tracking-[-2.5px] sm:text-[57px] lg:text-[65px]">
              Every drop counts.
              <br />
              <span className="text-green">
                So does
                <br className="hidden lg:block" /> your report.
              </span>
            </h1>
            <p className="mt-6 max-w-[420px] text-[15px] leading-[1.8] text-muted">
              Record a short video. LeakProof analyses signs of active water
              flow and helps determine whether the location should be inspected.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/scan" className="btn btn-primary !px-6">
                Check possible leak <ArrowUpRight size={18} />
              </Link>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Camera size={14} /> Just 5–10 seconds
              </span>
            </div>
            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck size={14} /> No account needed{" "}
              <span className="mx-2 text-line">|</span> Evidence, with room for
              uncertainty
            </p>
          </div>
          <LandingMap />
        </section>
        <div className="page-width flex flex-col justify-between gap-4 border-y border-line py-5 text-xs sm:flex-row sm:items-center">
          <p className="flex items-center gap-2.5 font-medium">
            <Waves size={18} className="text-green" /> Designed for a city where
            water matters.
          </p>
          <span className="flex items-center gap-2 text-muted">
            <MapPin size={13} /> Aktau, Kazakhstan{" "}
            <span className="mx-1 text-line">/</span> Eco Hackathon 2026
          </span>
        </div>
        <section id="how-it-works" className="page-width py-16 lg:py-20">
          <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow mb-3 text-green">
                From observation to action
              </p>
              <h2 className="text-[30px] font-semibold tracking-[-1.2px] sm:text-[34px]">
                See it. Scan it. Share it.
              </h2>
            </div>
            <p className="max-w-[285px] text-[13px] leading-relaxed text-muted">
              A useful signal starts with you.
              <br />
              Inspection decisions stay with people.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                icon: Camera,
                title: "Capture the signs",
                body: "Record or upload a steady, 5–10 second video. Keep the water and the surrounding ground in view.",
                label: "A short video is enough",
              },
              {
                n: "02",
                icon: ScanLine,
                title: "Understand the evidence",
                body: "Review water presence, movement and spreading. Unclear evidence calls for a better video.",
                label: "An assessment, never a certainty",
              },
              {
                n: "03",
                icon: LocateFixed,
                title: "Put it on the map",
                body: "Pin the location, add a little context and create a report for the dispatcher to review.",
                label: "Help the right place get attention",
              },
            ].map((step) => (
              <article
                key={step.n}
                className="rounded-xl border border-line bg-white p-6 lg:p-7"
              >
                <div className="mb-7 flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-paper text-green">
                    <step.icon size={22} strokeWidth={1.7} />
                  </span>
                  <span className="font-mono text-[11px] text-[#89938c]">
                    {step.n}
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-[-.5px]">
                  {step.title}
                </h3>
                <p className="mt-3 text-[13px] leading-[1.8] text-muted">
                  {step.body}
                </p>
                <p className="mt-6 flex items-center gap-1.5 border-t border-line pt-4 text-[10px] font-medium text-green">
                  <Check size={13} />
                  {step.label}
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="page-width mb-16 grid gap-8 overflow-hidden rounded-[20px] bg-ink px-7 py-9 text-white md:grid-cols-[1fr_1.3fr] md:items-center md:px-10 lg:gap-20 lg:px-12 lg:py-11">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 text-[10px] font-bold tracking-[.12em] text-lime">
              <Droplets size={15} /> OUR SHARED RESOURCE
            </span>
            <h2 className="text-[31px] leading-tight font-semibold tracking-[-1px]">
              Water takes a journey.
              <br />
              Let’s not lose it here.
            </h2>
          </div>
          <div>
            <p className="text-[14px] leading-[1.9] text-[#c4d5cd]">
              Aktau depends on desalination. Every unnoticed leak can mean
              losing water that took energy and effort to make available. A
              timely observation can help direct attention to where it is
              needed.
            </p>
            <Link
              href="/scan"
              className="mt-5 inline-flex items-center gap-2 text-[13px] font-semibold text-lime"
            >
              Be part of the response <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <div className="page-width mb-10 flex flex-col items-start justify-between gap-3 rounded-xl border border-line bg-[#edf1e8] px-5 py-4 sm:flex-row sm:items-center">
          <p className="max-w-3xl text-[11px] leading-relaxed text-muted">
            <strong className="text-ink">An honest first step.</strong>{" "}
            Assessments cannot confirm a leak. Demo results are clearly
            labelled. Reports stay on your device and are not sent to city
            services.
          </p>
          <span className="shrink-0 rounded-md border border-[#ccd5c4] px-2 py-1 text-[9px] font-bold tracking-wider">
            DEMO BUILD
          </span>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
