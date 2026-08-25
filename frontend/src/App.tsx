import { Link, Route, Routes } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Finance OS</p>
            <h1 className="mt-2 text-2xl font-semibold">AI financial operating system</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-300">
            <Link to="/" className="hover:text-white">Dashboard</Link>
            <Link to="/login" className="rounded-full border border-cyan-400/60 bg-cyan-400/10 px-4 py-2 text-cyan-300 hover:bg-cyan-400/20">
              Log in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <Routes>
          <Route
            path="/"
            element={
              <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <p className="mb-4 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-cyan-300">
                    Capture • Understand • Predict
                  </p>
                  <h2 className="max-w-xl text-5xl font-bold tracking-tight text-white">
                    Spend smarter with an AI financial command center.
                  </h2>
                  <p className="mt-6 max-w-xl text-lg text-slate-300">
                    See how money flows, detect anomalies, model goals, and get actionable financial guidance powered by deterministic analytics.
                  </p>
                  <div className="mt-8 flex gap-4">
                    <button className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 hover:bg-cyan-300">
                      Investigate my spending
                    </button>
                    <button className="rounded-full border border-slate-700 px-5 py-3 font-medium text-slate-100 hover:border-slate-500">
                      View dashboard
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-cyan-950/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">This month</p>
                      <p className="mt-2 text-4xl font-bold text-white">₹42,140</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">+18.4%</div>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Dining</span>
                        <span>₹12,900</span>
                      </div>
                      <div className="mt-3 h-2.5 rounded-full bg-slate-800">
                        <div className="h-2.5 w-[64%] rounded-full bg-cyan-400" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Housing</span>
                        <span>₹18,640</span>
                      </div>
                      <div className="mt-3 h-2.5 rounded-full bg-slate-800">
                        <div className="h-2.5 w-[82%] rounded-full bg-violet-400" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex justify-between text-sm text-slate-400">
                        <span>Savings</span>
                        <span>₹14,200</span>
                      </div>
                      <div className="mt-3 h-2.5 rounded-full bg-slate-800">
                        <div className="h-2.5 w-[58%] rounded-full bg-emerald-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            }
          />
          <Route path="/login" element={<div className="text-xl text-slate-200">Login view coming in v0.1.</div>} />
        </Routes>
      </main>
    </div>
  );
}
