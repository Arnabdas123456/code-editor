"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { Menu, X, Sparkles, ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// INTEGRATION NOTE:
// Built standalone without access to the project's routes/tailwind/theme
// files. Swap these four values for the real ones already in the app before
// shipping — do not ship placeholder hrefs:
//   Features / How It Works / Pricing -> real section ids or routes
//   Login       -> "/login"      (existing auth route)
//   Get Started -> "/get-started" (existing signup/onboarding route)
// If routes are real pages (not in-page anchors), swap the scroll-spy logic
// below for `usePathname()` from "next/navigation" to drive the active state.
// ---------------------------------------------------------------------------

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
] as const;

const LOGIN_HREF = "/login";
const GET_STARTED_HREF = "/get-started";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const prefersReducedMotion = useReducedMotion();
  const navRef = useRef<HTMLElement>(null);

  // --- Scroll-driven glass intensity (smooth motion values, no re-renders) ---
  const { scrollY } = useScroll();
  const glassOpacity = useTransform(scrollY, [0, 120], [0.55, 0.82]);
  const glassBlur = useTransform(scrollY, [0, 120], [14, 22]);
  const borderOpacity = useTransform(scrollY, [0, 120], [0.08, 0.14]);
  const shadowStrength = useTransform(scrollY, [0, 120], [0.22, 0.4]);

  const backdropFilter = useTransform(glassBlur, (v) => `blur(${v}px)`);
  const backgroundColor = useTransform(
    glassOpacity,
    (v) => `rgba(8, 11, 24, ${v})`
  );
  const borderColor = useTransform(
    borderOpacity,
    (v) => `rgba(255, 255, 255, ${v})`
  );
  const boxShadow = useTransform(
    shadowStrength,
    (v) => `0 8px 32px -12px rgba(99, 102, 241, ${v}), 0 1px 0 0 rgba(255,255,255,0.05) inset`
  );

  // --- Subtle pointer-follow tilt (transform-only, rAF-throttled) ---
  const rotateX = useSpring(0, { stiffness: 300, damping: 30, mass: 0.5 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 30, mass: 0.5 });
  const rafRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (prefersReducedMotion) return;
      const el = navRef.current;
      if (!el) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        rotateY.set(px * 3); // max ~1.5deg
        rotateX.set(-py * 3); // max ~1.5deg
      });
    },
    [prefersReducedMotion, rotateX, rotateY]
  );

  const handlePointerLeave = useCallback(() => {
    rotateX.set(0);
    rotateY.set(0);
  }, [rotateX, rotateY]);

  // --- Scroll-spy: highlight the section currently in view ---
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.replace("#", ""));
    const targets = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(`#${visible.target.id}`);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Close mobile menu on escape, lock scroll while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const pillTarget = hoveredLink ?? activeSection;

  return (
    <motion.header
      initial={{ opacity: 0, y: -20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-4 z-50 mx-auto px-3 max-w-5xl sm:top-5 sm:px-4"
      style={{ perspective: 1400 }}
    >
      <NavbarBackground reduceMotion={Boolean(prefersReducedMotion)} />

      <motion.nav
        ref={navRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          backdropFilter,
          WebkitBackdropFilter: backdropFilter,
          backgroundColor,
          borderColor,
          boxShadow,
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative flex items-center justify-between rounded-full border px-4 py-2.5 sm:px-5"
        aria-label="Primary"
      >
        {/* subtle top edge light */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent"
        />

        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
        >
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-500/90 to-purple-600 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-2px_4px_0_rgba(0,0,0,0.25),0_0_16px_-4px_rgba(129,140,248,0.85)] transition-transform duration-300 ease-out group-hover:-translate-y-px group-hover:rotate-6 group-hover:scale-105">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            AI Studio
          </span>
        </Link>

        {/* Desktop center links */}
        <ul
          className="relative hidden items-center gap-1 md:flex"
          onMouseLeave={() => setHoveredLink(null)}
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="relative">
              <a
                href={link.href}
                onMouseEnter={() => setHoveredLink(link.href)}
                className="relative z-10 block rounded-full px-4 py-2 text-sm text-slate-300 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                <motion.span
                  className="inline-block"
                  whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  {link.label}
                </motion.span>
              </a>
              {pillTarget === link.href && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 z-0 rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/10"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              {activeSection === link.href && hoveredLink !== link.href && (
                <motion.span
                  layoutId="nav-active-dot"
                  className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-400 shadow-[0_0_6px_1px_rgba(129,140,248,0.9)]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </li>
          ))}
        </ul>

        {/* Desktop right actions */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={LOGIN_HREF}
            className="rounded-full px-4 py-2 text-sm text-slate-300 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
          >
            Login
          </Link>
          <motion.div
            whileHover={
              prefersReducedMotion ? undefined : { scale: 1.03, y: -1 }
            }
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="group/cta"
          >
            <Link
              href={GET_STARTED_HREF}
              className="relative flex items-center gap-1.5 rounded-full bg-gradient-to-b from-indigo-400 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_4px_16px_-4px_rgba(99,102,241,0.6)] transition-shadow duration-300 group-hover/cta:shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset,0_8px_24px_-4px_rgba(129,140,248,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Get Started
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/cta:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 md:hidden"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </motion.nav>

      {/* Mobile menu panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-[0_12px_32px_-8px_rgba(99,102,241,0.35)] backdrop-blur-xl md:hidden"
          >
            <ul className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${activeSection === link.href
                        ? "text-white"
                        : "text-slate-300"
                      }`}
                  >
                    {link.label}
                    {activeSection === link.href && (
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_1px_rgba(129,140,248,0.9)]" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-1 flex flex-col gap-2 border-t border-white/10 p-2 pt-3">
              <Link
                href={LOGIN_HREF}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-4 py-2.5 text-center text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              >
                Login
              </Link>
              <Link
                href={GET_STARTED_HREF}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-indigo-400 to-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white shadow-[0_1px_0_0_rgba(255,255,255,0.25)_inset,0_4px_16px_-4px_rgba(99,102,241,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

// ---------------------------------------------------------------------------
// Subtle "AI network" ambience behind the navbar: a faint grid + a handful of
// slow-drifting nodes joined by thin lines. Pure CSS/SVG + Framer Motion —
// no WebGL, no particle library. Hidden on mobile and disabled entirely when
// the user prefers reduced motion, to keep the navbar cheap on every page.
// ---------------------------------------------------------------------------
function NavbarBackground({ reduceMotion }: { reduceMotion: boolean }) {
  const nodes = [
    { x: 6, y: 10 },
    { x: 26, y: 78 },
    { x: 52, y: 8 },
    { x: 78, y: 70 },
    { x: 96, y: 20 },
  ];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 hidden overflow-visible opacity-70 sm:block"
    >
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,255,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 60% 100% at 50% 50%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 100% at 50% 50%, black, transparent)",
        }}
      />

      {/* soft gradient glow */}
      <div
        className="absolute left-1/2 top-1/2 h-24 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse, rgba(99,102,241,0.35), rgba(147,51,234,0.15) 45%, transparent 70%)",
        }}
      />

      {/* connection lines */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {nodes.slice(0, -1).map((node, i) => {
          const next = nodes[i + 1];
          return (
            <line
              key={i}
              x1={node.x}
              y1={node.y}
              x2={next.x}
              y2={next.y}
              stroke="rgba(129,140,248,0.25)"
              strokeWidth={0.15}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* floating nodes */}
      {nodes.map((node, i) =>
        reduceMotion ? (
          <span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-indigo-300/70"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          />
        ) : (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-indigo-300/70 shadow-[0_0_6px_1px_rgba(129,140,248,0.6)]"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            animate={{
              y: [0, i % 2 === 0 ? -5 : 5, 0],
              opacity: [0.5, 0.9, 0.5],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.3,
            }}
          />
        )
      )}
    </div>
  );
}