"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import type { AssistantAnswer } from "@/lib/assistant";

type Entry = { question: string; answer?: AssistantAnswer; error?: string };
type Props = { initialSuggestions: string[] };

type ServerResult = { answer?: AssistantAnswer; error?: string; retryable?: boolean };

function isAnswer(value: unknown): value is AssistantAnswer {
  return Boolean(value) && typeof value === "object" && "intent" in (value as Record<string, unknown>);
}

function errorMessage(value: unknown): string | null {
  if (value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string") {
    return (value as { error: string }).error;
  }
  return null;
}

/** One request that never throws a JSON parse error at the UI. */
async function askServer(question: string): Promise<ServerResult> {
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // A 504/500 page is HTML, not JSON — keep the message human.
      payload = null;
    }

    if (response.ok && isAnswer(payload)) return { answer: payload };

    const serverError = errorMessage(payload);
    if (serverError) return { error: serverError };

    if (response.status === 401) {
      return { error: "Your session expired. Refresh the page and sign in again." };
    }
    if (response.status === 403) {
      return { error: "This account does not have access to the attendance desk." };
    }
    return {
      error: "The server did not return an answer. Please try again in a moment.",
      retryable: response.status >= 500,
    };
  } catch {
    return { error: "Could not reach the server. Check your connection and try again.", retryable: true };
  }
}

async function askWithRetry(question: string): Promise<ServerResult> {
  const first = await askServer(question);
  if (first.answer || !first.retryable) return first;
  return askServer(question);
}

export default function AssistantChat({ initialSuggestions }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, busy]);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;

    setEntries((current) => [...current, { question }]);
    setInput("");
    setBusy(true);

    const result = await askWithRetry(question);

    setEntries((current) =>
      current.map((entry, index) =>
        index === current.length - 1 ? { ...entry, answer: result.answer, error: result.error } : entry,
      ),
    );
    setBusy(false);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(input);
  };

  const lastWithSuggestions = [...entries].reverse().find((entry) => entry.answer?.suggestions);
  const chips =
    entries.length === 0 ? initialSuggestions : lastWithSuggestions?.answer?.suggestions ?? [];

  return (
    <div className="mt-5">
      <div className="rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <label htmlFor="assistant-question" className="sr-only">
              Ask an attendance question
            </label>
            <input
              id="assistant-question"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={300}
              placeholder="Type a question, e.g. who checked out today?"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              disabled={busy}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={busy || input.trim().length === 0}
              className="btn btn-primary btn-sm shrink-0"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Get answer"}
            </button>
          </form>
        </div>

        <div className="px-4 py-4">
          {entries.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-semibold text-slate-800">Answers come from your attendance records.</p>
              <p className="mx-auto mt-1 max-w-lg text-xs text-slate-500">
                Nothing is edited or approved here. Ask about today, yesterday, this month, one employee or the
                office policy.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((entry, index) => (
                <article key={`${entry.question}-${index}`} className="py-4 first:pt-0 last:pb-0">
                  <p className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                    <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">
                      Q
                    </span>
                    {entry.question}
                  </p>

                  {entry.answer ? (
                    <div className="mt-3 border-l-2 border-slate-300 pl-3">
                      <p className="text-sm font-bold text-slate-900">{entry.answer.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{entry.answer.summary}</p>

                      {entry.answer.bullets && entry.answer.bullets.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {entry.answer.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2">
                              <span className="mt-1.5 h-1 w-1 shrink-0 bg-slate-400" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {entry.answer.table && entry.answer.table.rows.length > 0 && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                              <tr>
                                {entry.answer.table.columns.map((column) => (
                                  <th key={column} className="whitespace-nowrap px-2.5 py-2 font-semibold">
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {entry.answer.table.rows.map((row, rowIndex) => (
                                <tr key={`${index}-${rowIndex}`} className="text-slate-700">
                                  {row.map((cell, cellIndex) => (
                                    <td key={`${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-2.5 py-2">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {entry.answer.links && entry.answer.links.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-3">
                          {entry.answer.links.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900 underline decoration-slate-300 underline-offset-2 hover:decoration-blue-900"
                            >
                              {link.label} <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : entry.error ? (
                    <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                      {entry.error}
                    </p>
                  ) : (
                    <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking records…
                    </p>
                  )}
                </article>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {chips.length > 0 && !busy && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Common questions</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void ask(chip)}
                  className="text-left text-[11px] font-semibold text-blue-900 underline decoration-slate-300 underline-offset-2 hover:decoration-blue-900"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-500">
        Answers are generated from live attendance records by fixed rules. No record is changed and no data
        leaves this app.
      </p>
    </div>
  );
}
