import { redirect } from "next/navigation";
import { Syne, DM_Mono, DM_Sans } from "next/font/google";
import { LandingNav } from "@/components/landing-nav";
import Script from "next/script";

const syne = Syne({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-syne" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-mono" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-sans" });

const FEATURES = [
  {
    icon: "📥",
    title: "Import data from any format",
    desc: "One click loads your data straight into PostGIS — no preprocessing, no pipeline, no friction.",
    tags: ["GeoJSON", "Shapefile", "KML", "GeoPackage", "CSV", "XLSX", "ArcGIS URL"],
  },
  {
    icon: "⚡",
    title: "Render millions of features",
    desc: "Server-side vector tile layers keep your maps fast at any scale.",
    tags: [],
  },
  {
    icon: "🎨",
    title: "Style & filter layers",
    desc: "Fill, stroke, opacity and radius. Categorical, threshold, and numeric color rules.",
    tags: [],
  },
  {
    icon: "🔗",
    title: "Share live maps",
    desc: "Stream your PostGIS data to live, interactive maps that anyone can view.",
    tags: [],
  },
  {
    icon: "🗂️",
    title: "Explore your attributes",
    desc: "Browse, search, sort, and filter any layer's data table.",
    tags: [],
  },
  {
    icon: "🛠️",
    title: "Table management included",
    desc: "Spatial indexes, SRIDs, primary keys, geometry casts, table clustering — all from a clean UI.",
    tags: [],
  },
];

const VERCEL_URL =
  "https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables";

export default function LandingPage() {
  if (!process.env.SHOW_LANDING_PAGE) redirect("/map");

  return (
    <>
      <style>{`
        :root {
          --ink:     #07101d;
          --surface: #0c1a2e;
          --panel:   #102038;
          --border:  #1a3352;
          --muted:   #3d6080;
          --body:    #7aaec8;
          --text:    #c4ddf0;
          --bright:  #e8f4ff;
          --pg:      #336791;
          --pg-mid:  #4a8ab5;
          --pg-hi:   #62b0e8;
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--ink) !important;
          color: var(--text) !important;
          overflow-x: hidden;
        }

        /* Noise overlay */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
          z-index: 9999;
        }

        /* Grid background */
        .lp-grid-bg {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--border) 1px, transparent 1px),
            linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 100%);
          opacity: 0.45;
          pointer-events: none;
        }

        /* ── NAV ── */
        .lp-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          height: 56px;
          background: rgba(11, 15, 20, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }

        .lp-nav-logo {
          font-family: var(--font-syne), sans-serif;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.05em;
          text-transform: none;
          color: var(--bright);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lp-nav-logo-dot { color: var(--pg-hi); }

        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 28px;
          list-style: none;
          margin: 0; padding: 0;
        }

        .lp-nav-links a {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--muted);
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: color 0.2s;
        }
        .lp-nav-links a:hover { color: var(--bright); }

        .lp-nav-gh {
          display: flex;
          align-items: center;
          gap: 7px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--bright) !important;
          background: var(--border);
          padding: 6px 14px;
          border-radius: 4px;
          border: 1px solid #1e3d5c;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .lp-nav-gh:hover {
          background: #1a3352;
          border-color: var(--muted);
        }

        /* ── HERO ── */
        .lp-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 120px 24px 80px;
          overflow: hidden;
        }

        .lp-hero-glow {
          position: absolute;
          top: -10%; left: 50%;
          transform: translateX(-50%);
          width: 900px; height: 600px;
          background: radial-gradient(ellipse, rgba(51,103,145,0.18) 0%, rgba(74,138,181,0.08) 40%, transparent 70%);
          pointer-events: none;
        }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(51,103,145,0.15);
          border: 1px solid rgba(98,176,232,0.25);
          border-radius: 99px;
          padding: 5px 14px 5px 10px;
          margin-bottom: 36px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--pg-hi);
          letter-spacing: 0.08em;
          animation: lp-fadeUp 0.6s ease both;
        }

        .lp-badge-dot {
          width: 6px; height: 6px;
          background: var(--pg-hi);
          border-radius: 50%;
          animation: lp-pulse 2s ease infinite;
        }

        .lp-h1 {
          font-family: var(--font-syne), sans-serif;
          font-weight: 700;
          font-size: clamp(32px, 5vw, 60px);
          line-height: 1.1;
          color: var(--bright);
          letter-spacing: -0.02em;
          max-width: 800px;
          animation: lp-fadeUp 0.7s 0.1s ease both;
        }

        .lp-h1 em {
          font-style: normal;
          color: var(--pg-hi);
        }

        .lp-hero-sub {
          margin-top: 24px;
          font-family: var(--font-sans), sans-serif;
          font-size: clamp(16px, 2vw, 19px);
          color: var(--body);
          font-weight: 300;
          max-width: 520px;
          line-height: 1.7;
          animation: lp-fadeUp 0.7s 0.2s ease both;
        }

        .lp-hero-ctas {
          margin-top: 44px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          animation: lp-fadeUp 0.7s 0.3s ease both;
        }

        .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--pg);
          color: #e8f4ff;
          font-family: var(--font-syne), sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.02em;
          padding: 13px 26px;
          border-radius: 6px;
          text-decoration: none;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .lp-btn-primary:hover {
          background: var(--pg-mid);
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(51,103,145,0.45);
        }

        .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: var(--text);
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          padding: 13px 22px;
          border-radius: 6px;
          border: 1px solid var(--border);
          text-decoration: none;
          transition: border-color 0.2s, color 0.2s;
        }
        .lp-btn-ghost:hover {
          border-color: var(--muted);
          color: var(--bright);
        }

        /* ── HERO MAP MOCKUP ── */
        .lp-hero-map {
          margin-top: 64px;
          width: 100%;
          max-width: 880px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(51,103,145,0.12);
          animation: lp-fadeUp 0.8s 0.4s ease both;
        }

        .lp-map-bar {
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          padding: 11px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lp-map-dots { display: flex; gap: 6px; }
        .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-dot-r { background: #ff5f57; }
        .lp-dot-y { background: #ffbd2e; }
        .lp-dot-g { background: #28c840; }

        .lp-map-url {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--muted);
          background: var(--ink);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 4px 12px;
          flex: 1;
          text-align: center;
        }

        .lp-map-canvas {
          background: #07101d;
          height: 380px;
          position: relative;
          overflow: hidden;
        }

        .lp-map-canvas svg {
          width: 100%;
          height: 100%;
        }

        .lp-map-overlay-panel {
          position: absolute;
          top: 14px; left: 14px;
          background: rgba(10,22,40,0.94);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          min-width: 170px;
          backdrop-filter: blur(8px);
        }

        .lp-overlay-title {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--muted);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .lp-layer-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px 0;
        }

        .lp-layer-swatch {
          width: 11px; height: 11px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .lp-layer-name {
          font-family: var(--font-sans), sans-serif;
          font-size: 12px;
          color: var(--text);
        }

        .lp-map-share-badge {
          position: absolute;
          bottom: 14px; right: 14px;
          background: rgba(51,103,145,0.18);
          border: 1px solid rgba(98,176,232,0.3);
          border-radius: 6px;
          padding: 7px 12px;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--pg-hi);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* ── LOOM THUMBNAIL ── */
        .lp-loom-wrap {
          max-width: 1060px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }

        .lp-loom-card {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--surface);
          display: flex;
          align-items: center;
          gap: 0;
          transition: border-color 0.2s;
          text-decoration: none;
        }
        .lp-loom-card:hover { border-color: var(--muted); }
        .lp-loom-card:hover .lp-loom-play { transform: scale(1.08); }

        .lp-loom-thumb {
          width: 280px;
          flex-shrink: 0;
          position: relative;
          aspect-ratio: 16/9;
          background: var(--ink);
          overflow: hidden;
        }

        .lp-loom-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.85;
        }

        .lp-loom-play {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        .lp-loom-play-btn {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: rgba(51,103,145,0.25);
          border: 1.5px solid rgba(98,176,232,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--pg-hi);
        }

        .lp-loom-text {
          padding: 20px 28px;
          flex: 1;
        }

        .lp-loom-eyebrow {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--pg-hi);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .lp-loom-title {
          font-family: var(--font-syne), sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: var(--bright);
          margin-bottom: 6px;
        }

        .lp-loom-sub {
          font-family: var(--font-sans), sans-serif;
          font-size: 13px;
          color: var(--body);
          font-weight: 300;
        }

        .lp-loom-arrow {
          padding: 0 24px 0 0;
          color: var(--muted);
          flex-shrink: 0;
          transition: color 0.2s, transform 0.2s;
        }
        .lp-loom-card:hover .lp-loom-arrow {
          color: var(--pg-hi);
          transform: translateX(3px);
        }

        /* ── SECTION COMMON ── */
        .lp-section {
          padding: 96px 24px;
          max-width: 1060px;
          margin: 0 auto;
        }

        .lp-label {
          display: block;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--pg-hi);
          margin-bottom: 14px;
        }

        .lp-h2 {
          font-family: var(--font-syne), sans-serif;
          font-weight: 600;
          font-size: clamp(22px, 3vw, 34px);
          color: var(--bright);
          letter-spacing: -0.01em;
          line-height: 1.2;
          max-width: 600px;
        }

        /* ── FEATURES ── */
        .lp-features-grid {
          margin-top: 56px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .lp-feature-card {
          background: var(--surface);
          padding: 32px 28px;
          transition: background 0.2s;
          position: relative;
          overflow: hidden;
        }

        .lp-feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--pg-mid), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .lp-feature-card:hover { background: var(--panel); }
        .lp-feature-card:hover::before { opacity: 1; }

        .lp-feature-icon {
          font-size: 20px;
          margin-bottom: 14px;
          display: block;
        }

        .lp-feature-card h3 {
          font-family: var(--font-syne), sans-serif;
          font-weight: 600;
          font-size: 15px;
          color: var(--bright);
          margin-bottom: 8px;
          letter-spacing: -0.005em;
        }

        .lp-feature-card p {
          font-family: var(--font-sans), sans-serif;
          font-size: 13px;
          color: var(--body);
          line-height: 1.7;
          font-weight: 300;
          margin: 0;
        }

        .lp-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 10px;
        }

        .lp-tag {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          background: var(--ink);
          border: 1px solid var(--border);
          border-radius: 3px;
          padding: 2px 7px;
          color: var(--pg-mid);
          letter-spacing: 0.04em;
        }

        /* ── DEMO ── */
        .lp-demo-frame {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 40px 100px rgba(0,0,0,0.55);
          height: 600px;
          margin-top: 40px;
        }

        .lp-demo-frame iframe {
          width: 100%;
          height: 100%;
          border: 0;
        }

        .lp-demo-open {
          position: absolute;
          top: 12px; right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px; height: 30px;
          background: rgba(7,16,29,0.82);
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .lp-demo-open:hover { background: var(--surface); border-color: var(--muted); }

        .lp-demo-brand {
          position: absolute;
          bottom: 12px; left: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(7,16,29,0.82);
          text-decoration: none;
        }

        .lp-demo-brand span {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--pg-hi);
        }

        /* ── DEPLOY ── */
        .lp-deploy-grid {
          margin-top: 52px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .lp-deploy-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 28px 24px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .lp-deploy-card:hover {
          border-color: var(--muted);
          transform: translateY(-3px);
        }

        .lp-deploy-step {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--muted);
          letter-spacing: 0.1em;
          margin-bottom: 12px;
        }

        .lp-deploy-card h3 {
          font-family: var(--font-syne), sans-serif;
          font-weight: 600;
          font-size: 16px;
          color: var(--bright);
          margin-bottom: 8px;
        }

        .lp-deploy-card p {
          font-family: var(--font-sans), sans-serif;
          font-size: 13px;
          color: var(--body);
          font-weight: 300;
          margin: 0;
          line-height: 1.6;
        }

        .lp-deploy-cmd {
          margin-top: 14px;
          background: var(--ink);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 9px 12px;
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--pg-hi);
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ── FINAL CTA ── */
        .lp-cta {
          position: relative;
          text-align: center;
          padding: 100px 24px 120px;
          border-top: 1px solid var(--border);
          overflow: hidden;
        }

        .lp-cta-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 80% at 50% 100%, rgba(51,103,145,0.14) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── FOOTER ── */
        .lp-footer {
          border-top: 1px solid var(--border);
          padding: 24px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .lp-footer p, .lp-footer a {
          font-family: var(--font-mono), monospace;
          font-size: 11px;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.2s;
        }
        .lp-footer a:hover { color: var(--text); }

        /* ── REVEAL ── */
        .lp-reveal {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .lp-reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── ANIMATIONS ── */
        @keyframes lp-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }

        .lp-hamburger {
          display: none;
          background: none;
          border: none;
          color: var(--text);
          cursor: pointer;
          padding: 4px;
        }

        .lp-mobile-menu {
          position: fixed;
          top: 56px; left: 0; right: 0;
          background: rgba(11, 15, 20, 0.97);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          z-index: 99;
        }

        .lp-mobile-menu a {
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          color: var(--text);
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: color 0.2s;
        }
        .lp-mobile-menu a:hover { color: var(--bright); }

        /* ── RESPONSIVE ── */
        @media (max-width: 768px) {
          .lp-nav { padding: 0 20px; }
          .lp-nav-desktop { display: none; }
          .lp-hamburger { display: flex; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-deploy-grid   { grid-template-columns: 1fr; }
          .lp-footer        { flex-direction: column; gap: 10px; text-align: center; }
          .lp-loom-wrap     { padding: 0 16px 48px; }
          .lp-loom-card     { flex-direction: column; }
          .lp-loom-thumb    { width: 100%; aspect-ratio: 16/9; }
          .lp-loom-text     { padding: 16px 18px; }
          .lp-loom-arrow    { display: none; }
        }
      `}</style>

      <Script id="lp-scroll-reveal" strategy="afterInteractive" dangerouslySetInnerHTML={{__html: `
        (function() {
          var obs = new IntersectionObserver(function(entries) {
            entries.forEach(function(e) {
              if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
              }
            });
          }, { threshold: 0.1 });
          document.querySelectorAll('.lp-reveal').forEach(function(el) { obs.observe(el); });
        })();
      `}} />

      <div className={`${syne.variable} ${dmMono.variable} ${dmSans.variable}`}>

        {/* ── NAV ── */}
        <LandingNav fontClass={`${syne.variable} ${dmMono.variable} ${dmSans.variable}`} />

        {/* ── HERO ── */}
        <section className="lp-hero">
          <div className="lp-grid-bg" />
          <div className="lp-hero-glow" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Postgresql_elephant.png" alt="" style={{ position: "absolute", width: 420, height: 420, opacity: 0.04, bottom: -60, right: -60, pointerEvents: "none", userSelect: "none" }} />

          <div className="lp-badge">
            <div className="lp-badge-dot" />
            Open-source &amp; self-hosted
          </div>

          <h1 className="lp-h1">
           The missing frontend for <em>PostGIS databases</em>
          </h1>

          <p className="lp-hero-sub">
            Import any spatial format, render millions of features and share live maps—no account required.
          </p>

          <div className="lp-hero-ctas">
            <a href="#demo" className="lp-btn-primary">
              <PlayIcon />
              See it live
            </a>
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="lp-btn-ghost">
              <GithubIcon />
              View on GitHub
            </a>
          </div>

          {/* SVG Map Mockup */}
          <div className="lp-hero-map">
            <div className="lp-map-bar">
              <div className="lp-map-dots">
                <div className="lp-dot lp-dot-r" />
                <div className="lp-dot lp-dot-y" />
                <div className="lp-dot lp-dot-g" />
              </div>
              <div className="lp-map-url">your-domain.com/share/map-a4f8c2d1</div>
            </div>
            <div className="lp-map-canvas">
              <svg viewBox="0 0 900 380" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <rect width="900" height="380" fill="#07101d"/>
                <g stroke="#112438" strokeWidth="0.5" opacity="0.6">
                  <line x1="0" y1="76" x2="900" y2="76"/><line x1="0" y1="152" x2="900" y2="152"/>
                  <line x1="0" y1="228" x2="900" y2="228"/><line x1="0" y1="304" x2="900" y2="304"/>
                  <line x1="180" y1="0" x2="180" y2="380"/><line x1="360" y1="0" x2="360" y2="380"/>
                  <line x1="540" y1="0" x2="540" y2="380"/><line x1="720" y1="0" x2="720" y2="380"/>
                </g>
                <path d="M60,40 C90,30 160,45 200,60 C240,75 260,90 280,80 C320,60 370,70 400,90 C430,110 420,140 440,150 C460,160 500,145 530,155 C560,165 570,180 560,200 C545,225 520,230 510,250 C495,275 510,300 500,320 C490,335 470,338 450,330 C420,318 390,300 360,308 C330,316 300,332 270,328 C240,322 220,305 200,295 C175,282 150,290 125,280 C100,270 75,252 65,228 C50,200 55,175 45,152 C30,118 25,85 40,62 Z" fill="#0f2240" stroke="#1e3d60" strokeWidth="1"/>
                <path d="M580,50 C610,40 660,55 700,70 C740,85 770,100 800,95 C840,88 870,70 900,75 L900,175 C880,180 850,170 820,175 C790,180 770,195 740,200 C710,205 680,190 650,195 C620,200 600,218 575,213 C555,208 540,190 545,170 C550,150 575,140 580,120 C585,100 565,75 580,50 Z" fill="#0f2240" stroke="#1e3d60" strokeWidth="1"/>
                <path d="M130,195 C160,185 200,190 240,180 C280,170 310,150 350,155 C390,160 420,180 460,175" fill="none" stroke="#336791" strokeWidth="1.5" opacity="0.9"/>
                <path d="M500,215 C530,210 560,220 600,210 C640,200 670,185 710,190" fill="none" stroke="#336791" strokeWidth="1.5" opacity="0.6"/>
                <polygon points="200,255 240,235 280,250 270,282 225,287" fill="rgba(51,103,145,0.20)" stroke="#4a8ab5" strokeWidth="1.2"/>
                <polygon points="400,272 445,258 475,272 460,305 415,310" fill="rgba(51,103,145,0.15)" stroke="#4a8ab5" strokeWidth="1.2"/>
                <polygon points="630,242 670,228 700,240 688,270 645,274" fill="rgba(51,103,145,0.20)" stroke="#4a8ab5" strokeWidth="1.2"/>
                <circle cx="155" cy="160" r="4" fill="#62b0e8" opacity="0.95"/>
                <circle cx="155" cy="160" r="10" fill="rgba(98,176,232,0.12)" stroke="rgba(98,176,232,0.35)" strokeWidth="1"/>
                <circle cx="310" cy="126" r="4" fill="#62b0e8" opacity="0.95"/>
                <circle cx="310" cy="126" r="10" fill="rgba(98,176,232,0.12)" stroke="rgba(98,176,232,0.35)" strokeWidth="1"/>
                <circle cx="490" cy="143" r="4" fill="#62b0e8" opacity="0.95"/>
                <circle cx="490" cy="143" r="10" fill="rgba(98,176,232,0.12)" stroke="rgba(98,176,232,0.35)" strokeWidth="1"/>
                <circle cx="680" cy="150" r="4" fill="#62b0e8" opacity="0.95"/>
                <circle cx="680" cy="150" r="10" fill="rgba(98,176,232,0.12)" stroke="rgba(98,176,232,0.35)" strokeWidth="1"/>
                <circle cx="800" cy="106" r="4" fill="#62b0e8" opacity="0.95"/>
                <circle cx="800" cy="106" r="10" fill="rgba(98,176,232,0.12)" stroke="rgba(98,176,232,0.35)" strokeWidth="1"/>
                <rect x="740" y="358" width="80" height="2" fill="#3d6080"/>
                <rect x="740" y="354" width="1" height="10" fill="#3d6080"/>
                <rect x="820" y="354" width="1" height="10" fill="#3d6080"/>
                <text x="773" y="350" fontFamily="monospace" fontSize="9" fill="#3d6080" textAnchor="middle">50 km</text>
              </svg>
              <div className="lp-map-overlay-panel">
                <div className="lp-overlay-title">Layers</div>
                <div className="lp-layer-row">
                  <div className="lp-layer-swatch" style={{background:'#62b0e8'}} />
                  <span className="lp-layer-name">Sites (1.2M pts)</span>
                </div>
                <div className="lp-layer-row">
                  <div className="lp-layer-swatch" style={{background:'#336791', borderRadius:1}} />
                  <span className="lp-layer-name">Watersheds</span>
                </div>
                <div className="lp-layer-row">
                  <div className="lp-layer-swatch" style={{background:'#4a8ab5', borderRadius:1}} />
                  <span className="lp-layer-name">Parcels</span>
                </div>
              </div>
              <div className="lp-map-share-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Shared · read-only · no login
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section id="features" className="lp-section">
          <span className="lp-label lp-reveal">Features</span>
          <h2 className="lp-h2 lp-reveal">Streamline common PostGIS workflows.</h2>

          <div className="lp-features-grid lp-reveal">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <span className="lp-feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                {f.tags.length > 0 && (
                  <div className="lp-tags">
                    {f.tags.map((t) => (
                      <span key={t} className="lp-tag">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── LOOM WALKTHROUGH THUMBNAIL ── */}
        {/* ── LIVE DEMO ── */}
        <section id="demo" className="lp-section" style={{paddingTop: 0}}>
          <span className="lp-label lp-reveal">Live Demo</span>
          <h2 className="lp-h2 lp-reveal">Interactive maps, streamed live from PostGIS.</h2>
          <p className="lp-reveal" style={{marginTop:12, fontFamily:'var(--font-sans)', fontSize:15, color:'var(--body)', fontWeight:300}}>
            Create and share live, interactive maps—in minutes.
          </p>

          <div className="lp-demo-frame lp-reveal">
            <iframe
              src="https://www.postgis-frontend.com/share/4a34704d-b51f-4fd5-9ab0-646e7a6335e3"
              allowFullScreen
            />
          </div>
        </section>

        {/* ── WALKTHROUGH ── */}
        <div className="lp-loom-wrap lp-reveal">
          <a
            href="https://www.loom.com/share/72ae683acdd145118e60f5eef6476930"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-loom-card"
          >
            <div className="lp-loom-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://cdn.loom.com/sessions/thumbnails/72ae683acdd145118e60f5eef6476930-4145080d7e64ef96-full-play.gif#t=0.1" alt="Watch the walkthrough" />
              <div className="lp-loom-play">
                <div className="lp-loom-play-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            </div>
            <div className="lp-loom-text">
              <div className="lp-loom-eyebrow">Walkthrough · 2 min</div>
              <div className="lp-loom-title">See the full workflow in action</div>
              <div className="lp-loom-sub">How to create and share a live map — start to finish.</div>
            </div>
            <div className="lp-loom-arrow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </div>
          </a>
        </div>

        {/* ── DEPLOY ── */}
        <section id="deploy" className="lp-section">
          <span className="lp-label lp-reveal">Self-host in minutes</span>
          <h2 className="lp-h2 lp-reveal">Three ways to deploy.</h2>

          <div className="lp-deploy-grid lp-reveal">
            <div className="lp-deploy-card" style={{borderColor:'var(--pg-mid)'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
                <div className="lp-deploy-step" style={{margin:0}}>Option 01</div>
                <span style={{fontFamily:'var(--font-mono)', fontSize:10, color:'var(--pg-hi)', background:'rgba(98,176,232,0.12)', border:'1px solid rgba(98,176,232,0.25)', borderRadius:99, padding:'2px 9px', letterSpacing:'0.06em'}}>Recommended</span>
              </div>
              <h3>Docker</h3>
              <p>Run anywhere with a single command. No dependencies, no configuration — just Docker.</p>
              <div className="lp-deploy-cmd">docker compose up -d --build</div>
              <div style={{marginTop:14}}>
                <a href="https://github.com/nogurtMon/postgis-frontend#docker" target="_blank" rel="noopener noreferrer" style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--pg-hi)', textDecoration:'none'}}>
                  Setup instructions ↗
                </a>
              </div>
            </div>

            <div className="lp-deploy-card">
              <div className="lp-deploy-step">Option 02</div>
              <h3>Vercel</h3>
              <p>One-click deploy. Connect your PostGIS instance and go live instantly.</p>
              <div style={{marginTop:16}}>
                <a href={VERCEL_URL} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="https://vercel.com/button" alt="Deploy with Vercel" style={{height:28}} />
                </a>
              </div>
            </div>

            <div className="lp-deploy-card">
              <div className="lp-deploy-step">Option 03</div>
              <h3>Local / Node</h3>
              <p>Classic install for any server or cloud VM. Works wherever Node.js runs.</p>
              <div className="lp-deploy-cmd">npm install &amp;&amp; npm run dev</div>
              <div style={{marginTop:14}}>
                <a href="https://github.com/nogurtMon/postgis-frontend#local-development" target="_blank" rel="noopener noreferrer" style={{fontFamily:'var(--font-mono)', fontSize:11, color:'var(--pg-hi)', textDecoration:'none'}}>
                  Setup instructions ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <div className="lp-cta">
          <div className="lp-cta-glow" />
          <span className="lp-label" style={{justifyContent:'center',display:'flex'}}>Get started</span>
          <h2 className="lp-h2" style={{margin:'0 auto 16px', maxWidth:480, textAlign:'center'}}>
            Let your spatial data be seen.
          </h2>
          <p style={{fontFamily:'var(--font-sans)', fontSize:16, color:'var(--body)', fontWeight:300, marginBottom:40}}>
            Create and share live maps with clients, colleagues or anyone.
          </p>
          <div className="lp-hero-ctas" style={{animation:'none'}}>
            <a href={VERCEL_URL} target="_blank" rel="noopener noreferrer" className="lp-btn-primary">
              Deploy now
            </a>
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="lp-btn-ghost">
              <GithubIcon />
              View on GitHub
            </a>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="lp-footer">
          <p>PostGIS Frontend — open-source, MIT licensed. Built with Next.js, MapLibre GL, and deck.gl.</p>
          <p>
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer">GitHub</a>
            &nbsp;·&nbsp;
            <a href="https://www.postgis-frontend.com/share/81abbce7-c8db-4bad-ad0a-5905dc307da3" target="_blank" rel="noopener noreferrer">Live Demo</a>
          </p>
        </footer>

      </div>
    </>
  );
}

/* ── SVG ICONS ── */
function GithubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6"/>
      <path d="M10 14 21 3"/>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    </svg>
  );
}