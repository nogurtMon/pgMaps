import { redirect } from "next/navigation";
import { DM_Mono, DM_Sans } from "next/font/google";
import { LandingNav } from "@/components/landing-nav";

const dmMono = DM_Mono({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-mono" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-sans" });


export default function LandingPage() {
  if (!process.env.SHOW_LANDING_PAGE) redirect("/maps");

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── LIGHT MODE (default) ── */
        :root {
          --bg:      #ffffff;
          --surface: #f4f7fa;
          --raised:  #eaecf0;
          --border:  #d4dde6;
          --border2: #b8c9d8;
          --muted:   #848484;
          --body:    #3d5060;
          --text:    #1e2d3c;
          --bright:  #0d1820;
          --blue:    #336791;
          --blue-l:  #0064a5;
          --blue-ll: #008bb9;
          --nav-bg:  rgba(255,255,255,0.92);
          --code-bg: #f0f4f8;
          --shadow:  rgba(0,0,0,0.10);
        }

        /* ── DARK MODE ── */
        :root.lp-dark {
          --bg:      #07111a;
          --surface: #0c1824;
          --raised:  #122030;
          --border:  #1c2f42;
          --border2: #254460;
          --muted:   #6a8ea8;
          --body:    #94b4c8;
          --text:    #c8d8e8;
          --bright:  #f0f4f8;
          --blue:    #336791;
          --blue-l:  #0064a5;
          --blue-ll: #008bb9;
          --nav-bg:  rgba(7,17,26,0.92);
          --code-bg: #0c1824;
          --shadow:  rgba(0,0,0,0.45);
        }

        html { scroll-behavior: smooth; }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans), system-ui, sans-serif;
          font-weight: 400;
          line-height: 1.6;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
          transition: background 0.2s, color 0.2s;
        }

        a { color: inherit; text-decoration: none; }

        /* ── NAV ── */
        .nav {
          position: sticky;
          top: 0;
          z-index: 100;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          background: var(--nav-bg);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--border);
          transition: background 0.2s, border-color 0.2s;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--bright);
          letter-spacing: -0.01em;
        }

        .nav-logo img { width: 22px; height: 22px; }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 6px;
          list-style: none;
        }

        .nav-links a {
          font-size: 13px;
          color: var(--body);
          padding: 5px 10px;
          border-radius: 5px;
          transition: color 0.15s, background 0.15s;
        }

        .nav-links a:hover { color: var(--bright); background: var(--raised); }

        .nav-right { display: flex; align-items: center; gap: 8px; }

        .nav-version {
          font-size: 10px;
          font-family: var(--font-mono), monospace;
          color: var(--muted);
          border: 1px solid var(--border);
          padding: 3px 8px;
          border-radius: 3px;
          letter-spacing: 0.04em;
        }

        .nav-gh {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-family: var(--font-mono), monospace;
          color: var(--text);
          border: 1px solid var(--border2);
          padding: 5px 12px;
          border-radius: 5px;
          background: var(--surface);
          transition: border-color 0.15s, color 0.15s;
        }

        .nav-gh:hover { border-color: var(--muted); color: var(--bright); }

        .theme-toggle {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 5px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s;
          flex-shrink: 0;
        }

        .theme-toggle:hover { border-color: var(--border2); color: var(--text); }
        .theme-toggle .icon-sun { display: none; }
        .theme-toggle .icon-moon { display: block; }
        :root.lp-dark .theme-toggle .icon-sun { display: block; }
        :root.lp-dark .theme-toggle .icon-moon { display: none; }

        /* ── HERO ── */
        .hero {
          padding: 80px 32px 0;
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }

        .hero-text { padding-bottom: 80px; }

        .hero-eyebrow {
          font-size: 12px;
          font-family: var(--font-mono), monospace;
          color: var(--blue-l);
          letter-spacing: 0.05em;
          margin-bottom: 20px;
        }

        .hero-h1 {
          font-size: clamp(28px, 3.5vw, 44px);
          font-weight: 600;
          color: var(--bright);
          letter-spacing: -0.025em;
          line-height: 1.15;
          margin-bottom: 20px;
        }

        .hero-sub {
          font-size: 16px;
          color: var(--body);
          font-weight: 400;
          line-height: 1.75;
          max-width: 420px;
          margin-bottom: 36px;
        }

        .hero-ctas { display: flex; gap: 10px; flex-wrap: wrap; }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: var(--blue);
          color: #ffffff;
          font-size: 13px;
          font-weight: 500;
          padding: 10px 20px;
          border-radius: 5px;
          transition: background 0.15s;
        }

        .btn-primary:hover { background: var(--blue-l); }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: var(--text);
          border: 1px solid var(--border2);
          padding: 10px 18px;
          border-radius: 5px;
          background: var(--surface);
          transition: border-color 0.15s, color 0.15s;
        }

        .btn-secondary:hover { border-color: var(--muted); color: var(--bright); }

        /* ── APP SCREENSHOT ── */
        .hero-screen { position: relative; padding-bottom: 80px; }

        .screen-wrap {
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border2);
          box-shadow: 0 20px 56px var(--shadow);
        }

        .screen-bar {
          background: var(--raised);
          border-bottom: 1px solid var(--border);
          padding: 9px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .screen-dots { display: flex; gap: 5px; }
        .dot { width: 9px; height: 9px; border-radius: 50%; }
        .dot-r { background: #ff5f57; }
        .dot-y { background: #febc2e; }
        .dot-g { background: #28c840; }

        .screen-addr {
          flex: 1;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: var(--muted);
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 3px;
          padding: 3px 10px;
          text-align: center;
        }

        .screen-canvas {
          background: #071018;
          height: 340px;
          position: relative;
          overflow: hidden;
        }

        .map-panel {
          position: absolute;
          top: 12px; left: 12px;
          background: rgba(9,18,32,0.95);
          border: 1px solid rgba(37,68,96,0.8);
          border-radius: 6px;
          padding: 10px 13px;
          min-width: 160px;
        }

        .panel-label {
          font-size: 10px;
          font-family: var(--font-mono), monospace;
          color: #6a8ea8;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .layer-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
        .layer-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

        .layer-name {
          font-size: 12px;
          color: #c8d8e8;
          font-family: var(--font-sans), sans-serif;
        }

        .map-badge {
          position: absolute;
          bottom: 12px; right: 12px;
          background: rgba(9,18,32,0.9);
          border: 1px solid rgba(37,68,96,0.8);
          border-radius: 4px;
          padding: 5px 10px;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          color: #008bb9;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        /* ── DIVIDER ── */
        .divider { border: none; border-top: 1px solid var(--border); margin: 0; }

        /* ── SECTIONS ── */
        .section { max-width: 1100px; margin: 0 auto; padding: 72px 32px; }
        .section-header { margin-bottom: 48px; }

        .section-tag {
          font-size: 11px;
          font-family: var(--font-mono), monospace;
          color: var(--blue-l);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .section-h2 {
          font-size: clamp(20px, 2.5vw, 28px);
          font-weight: 600;
          color: var(--bright);
          letter-spacing: -0.02em;
          line-height: 1.25;
        }

        .section-sub {
          margin-top: 10px;
          font-size: 15px;
          color: var(--body);
          max-width: 520px;
          line-height: 1.7;
        }

        /* ── FEATURES ── */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        .feature {
          padding: 28px 26px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }

        .feature:nth-child(3n) { border-right: none; }
        .feature:nth-last-child(-n+3) { border-bottom: none; }
        .feature:hover { background: var(--surface); }

        .feature-icon {
          width: 32px; height: 32px;
          border-radius: 6px;
          background: var(--raised);
          border: 1px solid var(--border2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
          color: var(--blue-l);
        }

        .feature h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--bright);
          margin-bottom: 6px;
          letter-spacing: -0.01em;
        }

        .feature p { font-size: 13px; color: var(--body); line-height: 1.65; }

        .feature-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }

        .feature-tag {
          font-size: 10px;
          font-family: var(--font-mono), monospace;
          color: var(--muted);
          border: 1px solid var(--border);
          border-radius: 3px;
          padding: 2px 6px;
          background: var(--bg);
        }

        /* ── DEPLOY / CTA ── */
        .deploy-card {
          background: var(--surface);
          border: 1px solid var(--blue);
          border-radius: 7px;
          padding: 24px 22px;
        }

        .deploy-card h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--bright);
          letter-spacing: -0.01em;
          margin-bottom: 8px;
        }

        .deploy-card p {
          font-size: 13px;
          color: var(--body);
          line-height: 1.6;
        }

        .deploy-cmd {
          margin-top: 16px;
          font-size: 11px;
          font-family: var(--font-mono), monospace;
          color: var(--blue-l);
          background: var(--code-bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 8px 12px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .deploy-link {
          display: inline-block;
          margin-top: 14px;
          font-size: 11px;
          font-family: var(--font-mono), monospace;
          color: var(--blue-l);
          transition: color 0.15s;
        }

        .deploy-link:hover { color: var(--blue-ll); }

        .cta-section {
          border-top: 1px solid var(--border);
          padding: 80px 32px;
          text-align: center;
        }

        .cta-inner { max-width: 520px; margin: 0 auto; }

        .cta-h2 {
          font-size: clamp(22px, 2.5vw, 30px);
          font-weight: 600;
          color: var(--bright);
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }

        .cta-sub {
          font-size: 15px;
          color: var(--body);
          line-height: 1.7;
          margin-bottom: 32px;
        }

        .cta-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }

        /* ── FOOTER ── */
        .footer {
          border-top: 1px solid var(--border);
          padding: 20px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .footer-left {
          font-size: 12px;
          font-family: var(--font-mono), monospace;
          color: var(--muted);
        }

        .footer-links { display: flex; gap: 20px; }

        .footer-links a {
          font-size: 12px;
          font-family: var(--font-mono), monospace;
          color: var(--muted);
          transition: color 0.15s;
        }

        .footer-links a:hover { color: var(--text); }

        /* ── RESPONSIVE ── */
        @media (max-width: 820px) {
          .nav { padding: 0 20px; }
          .nav-links { display: none; }
          .hero { grid-template-columns: 1fr; gap: 40px; padding: 52px 20px 0; }
          .hero-text { padding-bottom: 0; }
          .hero-screen { padding-bottom: 52px; }
          .hero-sub { max-width: none; }
          .features-grid { grid-template-columns: 1fr; }
          .feature { border-right: none; }
          .feature:nth-last-child(-n+3) { border-bottom: 1px solid var(--border); }
          .feature:last-child { border-bottom: none; }
          .footer { flex-direction: column; gap: 12px; text-align: center; }
          .section { padding: 52px 20px; }
        }
      `}</style>

      <script dangerouslySetInnerHTML={{__html: `
        (function() {
          try {
            var saved = localStorage.getItem('lp-theme');
            if (saved === 'dark') document.documentElement.classList.add('lp-dark');
          } catch(e) {}
          document.addEventListener('DOMContentLoaded', function() {
            var btn = document.getElementById('theme-btn');
            if (btn) btn.addEventListener('click', function() {
              var isDark = document.documentElement.classList.toggle('lp-dark');
              try { localStorage.setItem('lp-theme', isDark ? 'dark' : 'light'); } catch(e) {}
            });
          });
        })();
      `}} />

      <div className={`${dmMono.variable} ${dmSans.variable}`}>

        {/* NAV */}
        <nav className="nav">
          <a href="/" className="nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Postgresql_elephant.png" alt="PostGIS" />
            PostGIS Frontend
          </a>

          <ul className="nav-links">
            <li><a href="#features">Features</a></li>
            <li><a href="#deploy">Deploy</a></li>
          </ul>

          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span className="nav-version">v0.1.0 beta</span>
            <button id="theme-btn" className="theme-toggle" aria-label="Toggle light/dark mode">
              <span className="icon-moon"><MoonIcon /></span>
              <span className="icon-sun"><SunIcon /></span>
            </button>
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="nav-gh">
              <GithubIcon />
              GitHub
            </a>
          </div>
        </nav>

        {/* HERO */}
        <div className="hero">
          <div className="hero-text">
            <p className="hero-eyebrow">Open source · Self-hosted · MIT license · <span style={{color:'var(--blue-ll)'}}>v0.1.0 public beta</span></p>
            <h1 className="hero-h1">A Web Interface for PostGIS</h1>
            <p className="hero-sub">
              Create, read, update, delete and share — at scale, all from a self-hosted web app that deploys in minutes.
            </p>
            <div className="hero-ctas">
              <a href="#deploy" className="btn-primary">
                Get started
              </a>
              <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <GithubIcon />
                View on GitHub
              </a>
            </div>
          </div>

          <div className="hero-screen">
            <div className="screen-wrap">
              <div className="screen-bar">
                <div className="screen-dots">
                  <div className="dot dot-r" />
                  <div className="dot dot-y" />
                  <div className="dot dot-g" />
                </div>
                <div className="screen-addr">localhost:3000/map</div>
              </div>
              <div className="screen-canvas">
                <svg viewBox="0 0 520 340" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style={{width:'100%',height:'100%'}}>
                  <rect width="520" height="340" fill="#071018"/>
                  {/* Base road grid */}
                  <g stroke="#0e1e2e" strokeWidth="0.5">
                    <line x1="0" y1="68" x2="520" y2="68"/>
                    <line x1="0" y1="136" x2="520" y2="136"/>
                    <line x1="0" y1="204" x2="520" y2="204"/>
                    <line x1="0" y1="272" x2="520" y2="272"/>
                    <line x1="104" y1="0" x2="104" y2="340"/>
                    <line x1="208" y1="0" x2="208" y2="340"/>
                    <line x1="312" y1="0" x2="312" y2="340"/>
                    <line x1="416" y1="0" x2="416" y2="340"/>
                  </g>
                  {/* Land mass */}
                  <path d="M20,30 C50,20 110,28 155,44 C200,60 225,82 255,75 C295,65 335,78 365,96 C390,112 382,138 400,148 C420,158 452,142 475,152 C500,163 515,178 508,198 C496,224 472,228 460,250 C446,274 458,302 446,320 C434,336 412,340 392,330 C360,316 332,298 302,307 C272,316 248,332 218,326 C188,320 168,302 148,292 C122,278 98,287 74,276 C50,264 28,246 20,220 C8,192 12,165 4,140 C-8,108 -4,72 12,50 Z" fill="#0c1e30" stroke="#152a40" strokeWidth="0.8"/>
                  {/* Second land */}
                  <path d="M360,20 C390,12 430,26 464,40 C498,54 520,68 520,68 L520,160 C504,165 480,155 456,160 C430,166 412,182 388,186 C362,190 340,175 316,180 C298,184 286,198 266,193 C250,188 240,172 244,152 C248,132 268,122 272,102 C276,82 258,56 276,36 Z" fill="#0c1e30" stroke="#152a40" strokeWidth="0.8"/>
                  {/* Roads */}
                  <path d="M30,148 C80,140 140,148 190,138 C240,128 280,112 330,118 C370,122 398,138 430,132" fill="none" stroke="#1e3854" strokeWidth="1.5"/>
                  <path d="M280,200 C310,196 345,208 385,198 C415,190 448,175 480,180" fill="none" stroke="#1e3854" strokeWidth="1.5"/>
                  {/* Parcels / polygons - layer A */}
                  <polygon points="95,222 132,208 156,222 148,252 108,256" fill="rgba(51,103,145,0.22)" stroke="#336791" strokeWidth="0.8"/>
                  <polygon points="218,238 258,222 280,238 270,270 230,274" fill="rgba(51,103,145,0.18)" stroke="#336791" strokeWidth="0.8"/>
                  <polygon points="355,215 392,200 415,215 404,246 362,250" fill="rgba(51,103,145,0.22)" stroke="#336791" strokeWidth="0.8"/>
                  {/* Points - layer B */}
                  <circle cx="72" cy="136" r="3.5" fill="#6db3e6" opacity="0.9"/>
                  <circle cx="72" cy="136" r="8" fill="rgba(109,179,230,0.1)" stroke="rgba(109,179,230,0.3)" strokeWidth="0.8"/>
                  <circle cx="186" cy="108" r="3.5" fill="#6db3e6" opacity="0.9"/>
                  <circle cx="186" cy="108" r="8" fill="rgba(109,179,230,0.1)" stroke="rgba(109,179,230,0.3)" strokeWidth="0.8"/>
                  <circle cx="298" cy="120" r="3.5" fill="#6db3e6" opacity="0.9"/>
                  <circle cx="298" cy="120" r="8" fill="rgba(109,179,230,0.1)" stroke="rgba(109,179,230,0.3)" strokeWidth="0.8"/>
                  <circle cx="420" cy="112" r="3.5" fill="#6db3e6" opacity="0.9"/>
                  <circle cx="420" cy="112" r="8" fill="rgba(109,179,230,0.1)" stroke="rgba(109,179,230,0.3)" strokeWidth="0.8"/>
                  {/* Scale bar */}
                  <rect x="430" y="320" width="64" height="1.5" fill="#253545"/>
                  <rect x="430" y="316" width="1" height="10" fill="#253545"/>
                  <rect x="494" y="316" width="1" height="10" fill="#253545"/>
                  <text x="462" y="313" fontFamily="monospace" fontSize="8" fill="#4a6a84" textAnchor="middle">50 km</text>
                </svg>

                <div className="map-panel">
                  <div className="panel-label">Layers</div>
                  <div className="layer-row">
                    <div className="layer-swatch" style={{background:'#6db3e6'}} />
                    <span className="layer-name">monitoring_sites</span>
                  </div>
                  <div className="layer-row">
                    <div className="layer-swatch" style={{background:'#336791', borderRadius:'2px'}} />
                    <span className="layer-name">parcels</span>
                  </div>
                  <div className="layer-row">
                    <div className="layer-swatch" style={{background:'#4a90c4', borderRadius:'2px'}} />
                    <span className="layer-name">watersheds</span>
                  </div>
                </div>

                <div className="map-badge">
                  <ShareIcon />
                  Shared · read-only
                </div>
              </div>
            </div>
          </div>
        </div>

        <hr className="divider" style={{marginTop: 80}} />

        {/* FEATURES */}
        <section id="features" className="section">
          <div className="section-header">
            <p className="section-tag">Features</p>
            <h2 className="section-h2">Built for PostGIS power users</h2>
            <p className="section-sub">
              Import, render, style, query, create, edit, delete, and share spatial data — all from one interface.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature">
              <div className="feature-icon"><ImportIcon /></div>
              <h3>Import</h3>
              <p>Load spatial files directly into PostGIS tables without preprocessing.</p>
              <div className="feature-tags">
                {["GeoJSON","Shapefile","KML","GeoPackage","CSV","ArcGIS URL"].map(t => (
                  <span key={t} className="feature-tag">{t}</span>
                ))}
              </div>
            </div>
            <div className="feature">
              <div className="feature-icon"><LayersIcon /></div>
              <h3>Vector tile rendering</h3>
              <p>Server-side MVT generation streams millions of features to the browser with no client-side data transfer.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><StyleIcon /></div>
              <h3>Styling &amp; filtering</h3>
              <p>Per-layer fill, stroke, and opacity. Categorical, threshold, and numeric color rules on any attribute column.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><TableIcon /></div>
              <h3>Full CRUD editing</h3>
              <p>Create, edit, and delete features. Draw new geometries on the map or update attributes directly in the table.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><ShareIcon2 /></div>
              <h3>Live sharing</h3>
              <p>Publish read-only map links. Viewers see your latest PostGIS data without requiring access to your database.</p>
            </div>
            <div className="feature">
              <div className="feature-icon"><DbIcon /></div>
              <h3>Table management</h3>
              <p>Spatial indexes, SRID assignment, geometry casts, primary keys, column renames — all from the UI.</p>
            </div>
          </div>
        </section>

        {/* DEPLOY + CTA */}
        <div className="cta-section" id="deploy">
          <div className="cta-inner">
            <h2 className="cta-h2">Self-host with Docker</h2>
            <p className="cta-sub">
              Open source and self-hosted. Your data stays on your infrastructure.
            </p>
            <div className="deploy-card featured" style={{textAlign:'left', marginBottom: 24}}>
              <p style={{fontSize:13, color:'var(--body)', fontWeight:300, lineHeight:1.6, marginBottom:0}}>
                Single command. Includes a bundled Postgres instance for app storage. Bring your own PostGIS database for spatial data.
              </p>
              <div className="deploy-cmd">docker compose up -d --build</div>
              <a href="https://github.com/nogurtMon/postgis-frontend#docker" target="_blank" rel="noopener noreferrer" className="deploy-link">
                Setup guide ↗
              </a>
            </div>
            <div className="cta-btns">
              <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer" className="btn-primary">
                <GithubIcon />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="footer">
          <span className="footer-left">PostGIS Frontend · MIT License · Built with Next.js, MapLibre GL, deck.gl</span>
          <div className="footer-links">
            <a href="https://github.com/nogurtMon/postgis-frontend" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://www.postgis-frontend.com/share/81abbce7-c8db-4bad-ad0a-5905dc307da3" target="_blank" rel="noopener noreferrer">Demo</a>
          </div>
        </footer>

      </div>
    </>
  );
}

/* SVG Icons */
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}

function StyleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="9" y1="9" x2="9" y2="21"/>
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function ShareIcon2() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function DbIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}
