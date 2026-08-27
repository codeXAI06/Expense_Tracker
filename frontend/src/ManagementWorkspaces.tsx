import { useEffect, useState, type FormEvent } from "react";
import { formatRupees } from "./currency";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
const TOKEN = "expense_tracker_token";

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

const blankTransaction = {
  amount: "",
  merchant: "",
  description: "",
  category: "",
  paymentMethod: "Card",
  date: new Date().toISOString().slice(0, 10),
};

type Transaction = {
  id: string;
  merchant?: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
};

type TransactionForm = typeof blankTransaction;

export function TransactionManager() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionForm>(blankTransaction);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await requestJson<{ items: Transaction[] }>(
        `/api/transactions?type=expense&search=${encodeURIComponent(search)}&limit=50&page=1`,
      );
      setItems(data.items);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Transactions unavailable.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, [search]);

  function updateForm(name: keyof TransactionForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function edit(item: Transaction) {
    setEditingId(item.id);
    setForm({
      amount: String(item.amount),
      merchant: item.merchant ?? "",
      description: item.description,
      category: item.category,
      paymentMethod: item.paymentMethod,
      date: item.date.slice(0, 10),
    });
    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...blankTransaction,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        type: "expense",
        amount: Number(form.amount),
        date: `${form.date}T00:00:00.000Z`,
      };
      if (editingId) {
        await requestJson(`/api/transactions/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await requestJson("/api/transactions", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      resetForm();
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save transaction.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await requestJson(`/api/transactions/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not delete transaction.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 lg:px-10">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
        Workspace / Transactions
      </p>
      <h1 className="mt-3 font-display text-5xl">
        Your money trail<span className="text-coral">.</span>
      </h1>
      <form
        onSubmit={submit}
        className="mt-8 grid gap-3 rounded-xl border border-white/10 bg-panel p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Input
          required
          aria-label="Amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(event) => updateForm("amount", event.target.value)}
        />
        <Input
          required
          aria-label="Description"
          placeholder="Description"
          value={form.description}
          onChange={(event) => updateForm("description", event.target.value)}
        />
        <Input
          required
          aria-label="Category"
          placeholder="Category"
          value={form.category}
          onChange={(event) => updateForm("category", event.target.value)}
        />
        <Input
          aria-label="Merchant"
          placeholder="Merchant"
          value={form.merchant}
          onChange={(event) => updateForm("merchant", event.target.value)}
        />
        <Input
          required
          aria-label="Payment method"
          placeholder="Payment method"
          value={form.paymentMethod}
          onChange={(event) => updateForm("paymentMethod", event.target.value)}
        />
        <Input
          required
          aria-label="Date"
          type="date"
          value={form.date}
          onChange={(event) => updateForm("date", event.target.value)}
        />
        <button
          disabled={busy}
          className="rounded-lg bg-mint px-4 py-3 font-bold text-ink"
        >
          {busy ? "Saving..." : editingId ? "Update expense" : "Add expense"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg border border-white/10 px-4 py-3 text-muted"
          >
            Cancel
          </button>
        )}
      </form>
      <div className="mt-6 flex items-center gap-3">
        <Input
          aria-label="Search transactions"
          placeholder="Search merchant, description, or category"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      <div className="mt-6 divide-y divide-white/10 rounded-xl border border-white/10 bg-panel">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-muted">No matching expenses yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 p-5"
            >
              <div>
                <p className="font-semibold">
                  {item.merchant || item.description}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {item.category} / {new Date(item.date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <strong>
                  {formatRupees.format(item.amount)}
                </strong>
                <button
                  onClick={() => edit(item)}
                  className="text-sm text-mint"
                >
                  Edit
                </button>
                <button
                  onClick={() => void remove(item.id)}
                  className="text-sm text-coral"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type Goal = {
  id: string;
  name: string;
  type: "savings" | "debt" | "investment" | "custom";
  targetAmount: number;
  currentAmount: number;
  category: string;
  dueDate: string;
  progressPercent: number;
};
const blankGoal = {
  name: "",
  type: "savings" as Goal["type"],
  targetAmount: "",
  currentAmount: "0",
  category: "Savings",
  dueDate: "",
};
type GoalForm = typeof blankGoal;

export function GoalManager() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState<GoalForm>(blankGoal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await requestJson<{ goals: Goal[] }>("/api/goals");
      setGoals(data.goals);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Goals unavailable.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateForm(name: keyof GoalForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function edit(goal: Goal) {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      type: goal.type,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      category: goal.category,
      dueDate: goal.dueDate,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...blankGoal });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const body = {
        ...form,
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount),
      };
      if (editingId)
        await requestJson(`/api/goals/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      else
        await requestJson("/api/goals", {
          method: "POST",
          body: JSON.stringify(body),
        });
      resetForm();
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save goal.",
      );
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this goal?")) return;
    try {
      await requestJson(`/api/goals/${id}`, { method: "DELETE" });
      if (editingId === id) resetForm();
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not delete goal.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-10 lg:px-10">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-mint">
        Workspace / Goals
      </p>
      <h1 className="mt-3 font-display text-5xl">
        Give your money a destination<span className="text-coral">.</span>
      </h1>
      <form
        onSubmit={submit}
        className="mt-8 grid gap-3 rounded-xl border border-white/10 bg-panel p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Input
          required
          aria-label="Goal name"
          placeholder="Goal name"
          value={form.name}
          onChange={(event) => updateForm("name", event.target.value)}
        />
        <Input
          required
          aria-label="Target amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Target amount"
          value={form.targetAmount}
          onChange={(event) => updateForm("targetAmount", event.target.value)}
        />
        <Input
          required
          aria-label="Current amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Current amount"
          value={form.currentAmount}
          onChange={(event) => updateForm("currentAmount", event.target.value)}
        />
        <Input
          required
          aria-label="Goal category"
          placeholder="Category"
          value={form.category}
          onChange={(event) => updateForm("category", event.target.value)}
        />
        <Input
          required
          aria-label="Goal due date"
          type="date"
          value={form.dueDate}
          onChange={(event) => updateForm("dueDate", event.target.value)}
        />
        <div className="flex gap-3">
          <button className="flex-1 rounded-lg bg-mint px-4 py-3 font-bold text-ink">
            {editingId ? "Update goal" : "Create goal"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-white/10 px-4 text-muted"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-sm text-coral">
          {error}
        </p>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {goals.length === 0 ? (
          <p className="text-sm text-muted">
            Create a goal to start tracking progress.
          </p>
        ) : (
          goals.map((goal) => (
            <section
              key={goal.id}
              className="rounded-xl border border-white/10 bg-panel p-6"
            >
              <div className="flex justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl">{goal.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Due {new Date(goal.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <strong className="text-mint">{goal.progressPercent}%</strong>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-mint"
                  style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-muted">
                {formatRupees.format(goal.currentAmount)} of {formatRupees.format(goal.targetAmount)}
              </p>
              <div className="mt-5 flex gap-4 text-sm">
                <button onClick={() => edit(goal)} className="text-mint">
                  Edit
                </button>
                <button
                  onClick={() => void remove(goal.id)}
                  className="text-coral"
                >
                  Delete
                </button>
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
