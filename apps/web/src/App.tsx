function App() {
  return (
    <div className="min-h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-lg">
        <div className="flex-1">
          <span className="btn btn-ghost text-xl">YouTube DJ Prep</span>
        </div>
        <div className="flex-none">
          <div className="join">
            <input
              type="radio"
              name="theme-buttons"
              className="theme-controller btn join-item btn-sm"
              aria-label="Dark"
              value="dark"
              defaultChecked
            />
            <input
              type="radio"
              name="theme-buttons"
              className="theme-controller btn join-item btn-sm"
              aria-label="Light"
              value="light"
            />
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <div className="hero rounded-box bg-base-100 shadow-xl">
          <div className="hero-content flex-col gap-6 py-12 text-center">
            <div>
              <h1 className="text-4xl font-bold">Monorepo ready</h1>
              <p className="mt-2 text-base-content/80">
                Vite + React + DaisyUI (web) and Next.js App Router (api). Run{" "}
                <code className="kbd kbd-sm">pnpm dev</code> from the repo root.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="badge badge-primary">apps/web</span>
              <span className="badge badge-secondary">apps/api</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
