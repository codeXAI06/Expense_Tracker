import { useState, type FormEvent } from "react";
import { formatRupees } from "./currency";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const TOKEN = "expense_tracker_token";
const mapping = {
  date: "date",
  description: "description",
  amount: "amount",
  category: "category",
  paymentMethod: "paymentMethod",
  merchant: "merchant",
};

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
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
function Workspace({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
        {eyebrow}
      </p>
      <h1 className="mt-3 font-display text-5xl">
        {title}
        <span className="text-coral">.</span>
      </h1>
      {children}
    </div>
  );
}

export function AssistantWorkspace() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<{
    answer: string;
    recommendations: string[];
    categoryFocus: string;
  } | null>(null);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      setError("");
      setAnswer(
        await requestJson("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Assistant unavailable.",
      );
    }
  }
  return (
    <Workspace eyebrow="Workspace / Assistant" title="Ask about your money">
      <form onSubmit={submit} className="mt-8 flex gap-3">
        <Input
          required
          aria-label="Financial question"
          placeholder="Why did I spend more this month?"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button className="rounded-lg bg-mint px-5 py-3 font-bold text-ink">
          Ask
        </button>
      </form>
      <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
        <h2 className="font-display text-2xl">How the assistant works</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Your question is matched to a supported financial query. The server
          retrieves only your own relevant transactions or goals, calculates the
          answer deterministically, and returns the evidence with any
          recommendations. It does not invent transactions or use an external AI
          provider in the current configuration; unsupported questions return an
          insufficient-data response.
        </p>
      </section>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      {answer && (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
          <p className="text-lg leading-8">{answer.answer}</p>
          <p className="mt-4 text-sm text-muted">
            Focus: {answer.categoryFocus}
          </p>
          <ul className="mt-5 space-y-2 text-sm text-muted">
            {answer.recommendations.map((recommendation) => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        </section>
      )}
    </Workspace>
  );
}

type ImportResult = {
  rows: Array<{
    valid: boolean;
    reason?: string;
    description: string;
    amount: number;
    category: string;
  }>;
  summary: {
    imported: number;
    duplicates: number;
    invalid: number;
    skipped: number;
  };
};
export function ImportWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(path: string) {
    if (!file) throw new Error("Choose a CSV file first.");
    const form = new FormData();
    form.append("file", file);
    form.append("mapping", JSON.stringify(mapping));
    return requestJson<ImportResult>(path, { method: "POST", body: form });
  }
  async function previewFile() {
    try {
      setBusy(true);
      setMessage("");
      setPreview(await send("/api/imports/preview"));
    } catch (previewError) {
      setMessage(
        previewError instanceof Error
          ? previewError.message
          : "Preview unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importFile() {
    try {
      setBusy(true);
      setMessage("");
      const result = await send("/api/imports/import");
      setPreview(result);
      setMessage(`Imported ${result.summary.imported} transactions.`);
    } catch (importError) {
      setMessage(
        importError instanceof Error
          ? importError.message
          : "Import unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Workspace
      eyebrow="Workspace / Import"
      title="Bring in a transaction history"
    >
      <div className="mt-8 rounded-xl border border-white/10 bg-panel p-6">
        <Input
          aria-label="CSV file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setMessage("");
          }}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            disabled={!file || busy}
            onClick={() => void previewFile()}
            className="rounded-lg bg-mint px-4 py-3 font-bold text-ink"
          >
            Preview CSV
          </button>
          <button
            disabled={!preview || busy || preview.summary.invalid > 0}
            onClick={() => void importFile()}
            className="rounded-lg border border-mint px-4 py-3 text-mint"
          >
            Confirm import
          </button>
        </div>
        {message && (
          <p role="status" className="mt-4 text-sm text-muted">
            {message}
          </p>
        )}
      </div>
      {preview && (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {Object.entries(preview.summary).map(([name, count]) => (
              <div key={name}>
                <p className="text-sm text-muted">{name}</p>
                <p className="mt-1 font-display text-2xl">{count}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 max-h-80 overflow-auto text-sm">
            {preview.rows.map((row, index) => (
              <div
                key={`${row.description}-${index}`}
                className="flex justify-between gap-4 border-t border-white/5 py-3"
              >
                <span>
                  {row.description} / {row.category}
                </span>
                <span className={row.valid ? "text-mint" : "text-coral"}>
                  {row.valid
                    ? formatRupees.format(row.amount)
                    : (row.reason ?? "Invalid")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </Workspace>
  );
}

export function ReceiptWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    receiptHash?: string;
    fileReference?: string;
    rawOcrText?: string;
    validationFlags?: string[];
  }>({});
  const [extracted, setExtracted] = useState<{
    merchant: string;
    amount: number;
    date: string;
    category: string;
    subcategory: string;
    confidence: number;
    source: string;
    currency?: string;
    subtotal?: number | null;
    tax?: number | null;
    discount?: number | null;
    paymentMethod?: string | null;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number | null;
      totalPrice: number | null;
      category: string;
      confidence: number;
    }>;
    fieldConfidence?: Record<string, number>;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Ready to scan");
  const [duplicatePending, setDuplicatePending] = useState(false);
  async function analyze() {
    if (!file) return;
    try {
      setMessage("");
      setStatus("Uploading receipt...");
      const form = new FormData();
      form.append("file", file);
      setStatus("Improving image and reading receipt...");
      const result = await requestJson<{
        extracted: typeof extracted;
        receiptHash: string;
        fileReference: string;
        rawOcrText: string;
        validation: { flags: string[] };
        duplicate: { likelyDuplicate: boolean; reason?: string };
      }>("/api/receipts/analyze", { method: "POST", body: form });
      setExtracted(result.extracted);
      setAnalysisMeta({
        receiptHash: result.receiptHash,
        fileReference: result.fileReference,
        rawOcrText: result.rawOcrText,
        validationFlags: result.validation.flags,
      });
      setDuplicatePending(result.duplicate.likelyDuplicate);
      if (result.duplicate.likelyDuplicate) setMessage(result.duplicate.reason ?? "This receipt may already exist in your expenses.");
      setStatus("Ready for review");
    } catch (analyzeError) {
      setMessage(
        analyzeError instanceof Error
          ? analyzeError.message
          : "Receipt analysis unavailable.",
      );
      setStatus("Needs manual review");
    }
  }
  async function confirm(saveDuplicate = false) {
    if (!extracted) return;
    try {
      const result = await requestJson<{ confirmation: { id: string } }>(
        "/api/receipts/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...extracted,
            ...analysisMeta,
            extractionConfidence: extracted.confidence,
            saveDuplicate,
          }),
        },
      );
      setMessage(`Receipt confirmed: ${result.confirmation.id}`);
      setDuplicatePending(false);
      setStatus("Saved to expenses");
    } catch (confirmError) {
      if (
        confirmError instanceof Error &&
        confirmError.message.includes("may already exist")
      )
        setDuplicatePending(true);
      setMessage(
        confirmError instanceof Error
          ? confirmError.message
          : "Receipt confirmation failed.",
      );
    }
  }
  return (
    <Workspace
      eyebrow="Workspace / Receipts"
      title="Turn receipts into records"
    >
      <div className="mt-8 rounded-xl border border-white/10 bg-panel p-6">
        <Input
          aria-label="Receipt image or PDF"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setFileUrl(
              selected && selected.type.startsWith("image/")
                ? URL.createObjectURL(selected)
                : null,
            );
            setExtracted(null);
            setAnalysisMeta({});
            setMessage("");
            setDuplicatePending(false);
            setStatus(selected ? "Ready to scan" : "Ready to scan");
          }}
        />
        <button
          disabled={!file}
          onClick={() => void analyze()}
          className="mt-5 rounded-lg bg-mint px-4 py-3 font-bold text-ink"
        >
          Analyze receipt
        </button>
        {message && (
          <p role="status" className="mt-4 text-sm text-muted">
            {message}
          </p>
        )}
        <p role="status" className="mt-3 text-sm text-muted">
          {status}
        </p>
      </div>
      {extracted && (
        <section className="mt-6 rounded-xl border border-white/10 bg-panel p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {fileUrl ? (
              <img
                src={fileUrl}
                alt="Uploaded receipt"
                className="max-h-96 w-full rounded-lg object-contain"
              />
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-lg border border-white/10 text-muted">
                PDF uploaded
              </div>
            )}
            <div>
              <p className="text-sm text-muted">
                Review before confirming /{" "}
                {Math.round(extracted.confidence * 100)}% confidence
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  aria-label="Extracted merchant"
                  value={extracted.merchant}
                  onChange={(event) =>
                    setExtracted({ ...extracted, merchant: event.target.value })
                  }
                />
                <Input
                  aria-label="Extracted amount"
                  type="number"
                  value={extracted.amount}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      amount: Number(event.target.value),
                    })
                  }
                />
                <Input
                  aria-label="Extracted date"
                  type="date"
                  value={extracted.date}
                  onChange={(event) =>
                    setExtracted({ ...extracted, date: event.target.value })
                  }
                />
                <Input
                  aria-label="Extracted category"
                  value={extracted.category}
                  onChange={(event) =>
                    setExtracted({ ...extracted, category: event.target.value })
                  }
                />
                <Input
                  aria-label="Extracted tax"
                  type="number"
                  placeholder="Tax"
                  value={extracted.tax ?? ""}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      tax: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
                <Input
                  aria-label="Extracted subtotal"
                  type="number"
                  placeholder="Subtotal"
                  value={extracted.subtotal ?? ""}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      subtotal: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
                <Input
                  aria-label="Extracted discount"
                  type="number"
                  placeholder="Discount"
                  value={extracted.discount ?? ""}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      discount: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
                <Input
                  aria-label="Extracted currency"
                  maxLength={3}
                  placeholder="Currency"
                  value={extracted.currency ?? "INR"}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
                <Input
                  aria-label="Extracted payment method"
                  placeholder="Payment method"
                  value={extracted.paymentMethod ?? ""}
                  onChange={(event) =>
                    setExtracted({
                      ...extracted,
                      paymentMethod: event.target.value,
                    })
                  }
                />
              </div>
              {extracted.items && extracted.items.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm text-muted">Line items</p>
                  {extracted.items.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <Input
                        aria-label={`Item ${index + 1} name`}
                        value={item.name}
                        onChange={(event) => {
                          const items = [...extracted.items!];
                          items[index] = { ...item, name: event.target.value };
                          setExtracted({ ...extracted, items });
                        }}
                      />
                      <Input
                        aria-label={`Item ${index + 1} total`}
                        type="number"
                        value={item.totalPrice ?? ""}
                        onChange={(event) => {
                          const items = [...extracted.items!];
                          const totalPrice = event.target.value
                            ? Number(event.target.value)
                            : null;
                          items[index] = {
                            ...item,
                            totalPrice,
                            unitPrice: totalPrice,
                          };
                          setExtracted({ ...extracted, items });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {extracted.fieldConfidence &&
                Object.entries(extracted.fieldConfidence).some(
                  ([, confidence]) => confidence < 0.6,
                ) && (
                  <p className="mt-4 text-sm text-gold">
                    Please verify the highlighted low-confidence fields before
                    saving.
                  </p>
                )}
                {analysisMeta.validationFlags && analysisMeta.validationFlags.length > 0 && <ul className="mt-3 space-y-1 text-sm text-gold">{analysisMeta.validationFlags.map((flag) => <li key={flag}>Please verify: {flag}</li>)}</ul>}
            </div>
          </div>
          {duplicatePending && (
            <div className="mt-5 rounded-lg border border-gold/50 p-4 text-sm text-gold">
              This receipt may already exist in your expenses. Save it anyway?
            </div>
          )}
          <button
            onClick={() => void confirm(duplicatePending)}
            className="mt-5 rounded-lg border border-mint px-4 py-3 text-mint"
          >
            {duplicatePending ? "Save anyway" : "Confirm & save expense"}
          </button>
          <button type="button" onClick={() => { setFile(null); setFileUrl(null); setExtracted(null); setAnalysisMeta({}); setDuplicatePending(false); setMessage(""); setStatus("Ready to scan"); }} className="ml-4 mt-5 text-sm text-muted">Cancel / rescan</button>
        </section>
      )}
    </Workspace>
  );
}
