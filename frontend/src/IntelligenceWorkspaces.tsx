import { useEffect, useState, type FormEvent } from "react";
import { formatRupees } from "./currency";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const TOKEN = "expense_tracker_token";
const monthDefault = new Date().toISOString().slice(0, 7);

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem(TOKEN) ?? ""}`,
      ...options.headers,
    },
  });
  const data = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(data.message ?? "Request failed.");
  return data;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ""}`} />;
}

function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-5xl">
        {title}
        <span className="text-coral">.</span>
      </h1>
    </>
  );
}

function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-10">{children}</div>
  );
}

export function ScenarioWorkspace() {
  const [month, setMonth] = useState(monthDefault);
  const [category, setCategory] = useState("Food & Dining");
  const [reduction, setReduction] = useState("25");
  const [priority, setPriority] = useState("Emergency savings");
  const [result, setResult] = useState<{
    estimatedSavings: number;
    newCashFlow: number;
    recommendation: string;
    assumptions: string[];
  } | null>(null);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setResult(
        await requestJson("/api/scenarios/what-if", {
          method: "POST",
          body: JSON.stringify({
            month,
            category,
            reductionPercent: Number(reduction),
            newPriority: priority,
          }),
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Scenario unavailable.",
      );
    }
  }

  return (
    <Workspace>
      <Header eyebrow="Workspace / Scenarios" title="Test a different month" />
      <form
        onSubmit={submit}
        className="mt-8 grid gap-3 rounded-xl border border-white/10 bg-panel p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          required
          aria-label="Scenario month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <Input
          required
          aria-label="Scenario category"
          placeholder="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
        <Input
          required
          aria-label="Reduction percent"
          type="number"
          min="1"
          max="100"
          value={reduction}
          onChange={(event) => setReduction(event.target.value)}
        />
        <Input
          required
          aria-label="New priority"
          placeholder="Redirect savings to"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        />
        <button className="rounded-lg bg-mint px-4 py-3 font-bold text-ink">
          Run scenario
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {result && (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted">Estimated monthly savings</p>
              <p className="mt-2 font-display text-4xl text-mint">
                {formatRupees.format(result.estimatedSavings)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">New cash flow</p>
              <p className="mt-2 font-display text-4xl text-gold">
                {formatRupees.format(result.newCashFlow)}
              </p>
            </div>
          </div>
          <p className="mt-6 leading-7">{result.recommendation}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {result.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
      )}
    </Workspace>
  );
}

type Investigation = {
  merchant: string;
  amount: number;
  category: string;
  date: string;
  reason: string;
};
export function InvestigationWorkspace() {
  const [month, setMonth] = useState(monthDefault);
  const [data, setData] = useState<{
    summary: {
      totalFindings: number;
      highRisk: string;
      totalFlaggedAmount: number;
    };
    findings: Investigation[];
  } | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      setError("");
      setData(await requestJson(`/api/investigations/spending?month=${month}`));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Investigation unavailable.",
      );
    }
  }
  useEffect(() => {
    void load();
  }, [month]);
  return (
    <Workspace>
      <Header
        eyebrow="Workspace / Investigation"
        title="Investigate my spending"
      />
      <div className="mt-8 flex max-w-sm gap-3">
        <Input
          aria-label="Investigation month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {data && (
        <>
          <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Findings</p>
              <p className="mt-2 font-display text-3xl">
                {data.summary.totalFindings}
              </p>
            </div>
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Risk</p>
              <p className="mt-2 font-display text-3xl text-coral">
                {data.summary.highRisk}
              </p>
            </div>
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Flagged amount</p>
              <p className="mt-2 font-display text-3xl">
                {formatRupees.format(data.summary.totalFlaggedAmount)}
              </p>
            </div>
          </section>
          <div className="mt-6 space-y-3">
            {data.findings.length === 0 ? (
              <p className="text-sm text-muted">
                No unusual transactions were flagged for this month.
              </p>
            ) : (
              data.findings.map((finding) => (
                <article
                  key={`${finding.date}-${finding.merchant}`}
                  className="rounded-xl border border-white/10 bg-panel p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl">
                        {finding.merchant}
                      </h2>
                      <p className="mt-1 text-sm text-muted">
                        {finding.category} /{" "}
                        {new Date(finding.date).toLocaleDateString()}
                      </p>
                    </div>
                    <strong className="text-coral">
                      {formatRupees.format(finding.amount)}
                    </strong>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    {finding.reason}
                  </p>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </Workspace>
  );
}

type Report = {
  month: string;
  summary: { totalIncome: number; totalExpenses: number; net: number };
  insights: string[];
  byCategory: Record<string, number>;
};
export function ReportWorkspace() {
  const [month, setMonth] = useState(monthDefault);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    requestJson<Report>(`/api/reports/monthly?month=${month}`)
      .then(setReport)
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Report unavailable.",
        ),
      );
  }, [month]);
  return (
    <Workspace>
      <Header eyebrow="Workspace / Reports" title="Read the month clearly" />
      <div className="mt-8 max-w-sm">
        <Input
          aria-label="Report month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {report && (
        <>
          <section className="mt-6 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Income</p>
              <p className="mt-2 font-display text-3xl text-mint">
                {formatRupees.format(report.summary.totalIncome)}
              </p>
            </div>
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Expenses</p>
              <p className="mt-2 font-display text-3xl text-coral">
                {formatRupees.format(report.summary.totalExpenses)}
              </p>
            </div>
            <div className="bg-panel p-5">
              <p className="text-sm text-muted">Net</p>
              <p className="mt-2 font-display text-3xl text-gold">
                {formatRupees.format(report.summary.net)}
              </p>
            </div>
          </section>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-panel p-6">
              <h2 className="font-display text-2xl">What changed</h2>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-muted">
                {report.insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-white/10 bg-panel p-6">
              <h2 className="font-display text-2xl">Category spend</h2>
              {Object.entries(report.byCategory).map(([name, amount]) => (
                <div
                  key={name}
                  className="flex justify-between border-b border-white/5 py-3 text-sm"
                >
                  <span>{name}</span>
                  <strong>{formatRupees.format(amount)}</strong>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </Workspace>
  );
}

export function CategorizationWorkspace() {
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<{
    category: string;
    subcategory: string;
    confidence: number;
    reason: string;
    source: string;
  } | null>(null);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setResult(
        await requestJson("/api/ai/categorize", {
          method: "POST",
          body: JSON.stringify({ merchant, description }),
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Categorization unavailable.",
      );
    }
  }
  async function correct() {
    if (!result || !category.trim()) return;
    try {
      await requestJson("/api/ai/correct", {
        method: "POST",
        body: JSON.stringify({
          merchant,
          originalCategory: result.category,
          correctedCategory: category,
        }),
      });
      setResult({
        ...result,
        category,
        source: "correction",
        reason: "Saved as your correction for future categorization.",
      });
    } catch (correctError) {
      setError(
        correctError instanceof Error
          ? correctError.message
          : "Could not save correction.",
      );
    }
  }
  return (
    <Workspace>
      <Header
        eyebrow="Workspace / AI Categorization"
        title="Teach the category engine"
      />
      <form
        onSubmit={submit}
        className="mt-8 grid gap-3 rounded-xl border border-white/10 bg-panel p-5 sm:grid-cols-2"
      >
        <Input
          required
          aria-label="Merchant"
          placeholder="Merchant"
          value={merchant}
          onChange={(event) => setMerchant(event.target.value)}
        />
        <Input
          aria-label="Purchase description"
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button className="rounded-lg bg-mint px-4 py-3 font-bold text-ink sm:col-span-2">
          Categorize transaction
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {result && (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Suggested category</p>
              <h2 className="mt-2 font-display text-3xl">{result.category}</h2>
              <p className="mt-1 text-sm text-muted">
                {result.subcategory} / {Math.round(result.confidence * 100)}%
                confidence / {result.source}
              </p>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              {result.reason}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Input
              aria-label="Corrected category"
              placeholder="Correct category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
            <button
              onClick={() => void correct()}
              className="rounded-lg border border-mint px-4 py-3 text-mint"
            >
              Save correction
            </button>
          </div>
        </section>
      )}
    </Workspace>
  );
}
