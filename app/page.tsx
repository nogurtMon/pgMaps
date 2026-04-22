import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });

const FEATURES = [
  {
    title: "Import anything",
    desc: "GeoJSON, Shapefile, KML, GeoPackage, CSV, XLSX, or any ArcGIS Feature Server URL — imported directly into PostGIS with one click.",
  },
  {
    title: "Visualize at scale",
    desc: "Render points, lines, and polygons as server-side vector tile layers. Handles millions of features easily.",
  },
  {
    title: "Style & filter",
    desc: "Per-layer fill, stroke, opacity, and radius. Categorical, threshold, and numeric color rules. Attribute, temporal, and range filters applied server-side.",
  },
  {
    title: "Share live maps",
    desc: "Generate a public read-only link that embeds your layers, styles, and active filters. Anyone can explore it — no account needed.",
  },
  {
    title: "Attribute table",
    desc: "Browse, search, sort, and filter any layer's data. Zoom the map directly to any individual feature.",
  },
  {
    title: "Table management",
    desc: "Create spatial indexes, assign SRIDs, add primary keys, cast geometry types, and cluster tables for improved tile performance.",
  },
];

export default function LandingPage() {
  return (
    <div className={`${inter.className} min-h-screen bg-background text-foreground`}>

      {/* Nav */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold tracking-widest text-primary uppercase text-xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Postgresql_elephant.png" alt="" className="w-5 h-5" />
          PostGIS Frontend
        </span>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/nogurtMon/postgis-frontend"
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          A Web Interface for{" "}
          <span className="text-primary">PostGIS Databases</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Import spatial data, visualize it on an interactive map, then share that map with anyone.
          Open-source and self-hosted.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables"
            target="_blank" rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://vercel.com/button" alt="Deploy with Vercel" className="h-8" />
          </a>
          <a
            href="https://github.com/nogurtMon/postgis-frontend"
            target="_blank" rel="noopener noreferrer"
            className="border px-5 py-2.5 rounded-md text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Demo video */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }} className="rounded-xl overflow-hidden border shadow-lg">
          <iframe
            src="https://www.loom.com/embed/72ae683acdd145118e60f5eef6476930"
            frameBorder="0"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-bold mb-6 text-center">Features</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="border rounded-lg p-4 bg-muted/20 hover:bg-muted/40 transition-colors">
              <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live demo */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <h2 className="text-xl font-bold mb-2 text-center">Live demo</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">A real shared map — no login required.</p>
        <div className="relative rounded-xl overflow-hidden border shadow-lg" style={{ height: "520px" }}>
          <iframe
            src="https://www.postgis-frontend.com/share/81abbce7-c8db-4bad-ad0a-5905dc307da3"
            className="w-full h-full"
            frameBorder="0"
            allowFullScreen
          />
          <a
            href="https://www.postgis-frontend.com/share/81abbce7-c8db-4bad-ad0a-5905dc307da3"
            target="_blank" rel="noopener noreferrer"
            className="absolute top-3 right-3 flex items-center gap-1.5 bg-background/80 backdrop-blur-sm border rounded-md px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-background transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            Open full screen
          </a>
        </div>
      </section>

      {/* Deploy */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-xl font-bold mb-2">Self-host in minutes</h2>
        <p className="text-sm text-muted-foreground mb-6">Deploy to Vercel with one click, or run locally with Docker or Node.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/nogurtMon/postgis-frontend&env=DSN_ENCRYPTION_KEY,APP_PASSWORD,POSTGRES_URL&envDescription=DSN_ENCRYPTION_KEY%3A%20run%20%60node%20-e%20%22console.log(require('crypto').randomBytes(32).toString('hex'))%22%60%20to%20generate.%20APP_PASSWORD%3A%20password%20to%20access%20the%20app.%20POSTGRES_URL%3A%20Postgres%20connection%20string%20for%20app%20storage%20%E2%80%94%20create%20a%20free%20database%20at%20neon.tech.&envLink=https://github.com/nogurtMon/postgis-frontend%23environment-variables"
            target="_blank" rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://vercel.com/button" alt="Deploy with Vercel" className="h-8" />
          </a>
          <a
            href="https://github.com/nogurtMon/postgis-frontend"
            target="_blank" rel="noopener noreferrer"
            className="border px-5 py-2 rounded-md text-sm font-medium hover:bg-muted/40 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        PostGIS Frontend is open-source under the MIT license.
        Built with Next.js, MapLibre GL, and deck.gl.
      </footer>
    </div>
  );
}
