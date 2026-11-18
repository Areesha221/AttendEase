"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Send, Sparkles, User } from "lucide-react";
import type { AssistantAnswer } from "@/lib/assistant";

type Message = { role: "user"; text: string } | { role: "assistant"; answer: AssistantAnswer };

type Props = { initialSuggestions: string[] };

export default function AssistantChat({ initialSuggestions }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;

    setMessages((current) => [...current, { role: "user", text: question }]);
    setInput("");
    setError(null);
    setBusy(true);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await response.json()) as AssistantAnswer | { error?: string };
      if (!response.ok || !("intent" in data)) {
        throw new Error("error" in data && data.error ? data.error : "The assistant could not answer that.");
      }
      setMessages((current) => [...current, { role: "assistant", answer: data }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(input);
  };

  const lastAnswer = [...messages].reverse().find((message) => message.role === "assistant");
  const chips =
    messages.length === 0
      ? initialSuggestions
      : lastAnswer && lastAnswer.role === "assistant"
        ? lastAnswer.answer.suggestions ?? []
        : [];

  return (
    <div className="mt-5">
      <div className="card">
        <div
          aria-live="polite"
          className="max-h-[60vh] min-h-[180px] space-y-4 overflow-y-auto pr-1"
        >
          {messages.length === 0 && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Ask me anything about today or this month.</p>
                <p className="mt-1 text-xs text-slate-500">
                  I only read data and never change attendance, leave or payroll. Try one of the questions below.
                </p>
              </div>
            </div>
          )}

          {messages.map((message, index) =>
            message.role === "user" ? (
              <div key={`user-${index}`} className="flex justify-end gap-2">
                <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-3.5 py-2 text-sm text-white">
                  {message.text}
                </p>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <User className="h-4 w-4" />
                </span>
              </div>
            ) : (
              <div key={`answer-${index}`} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-slate-200 bg-white p-3.5">
                  <p className="text-sm font-bold text-slate-900">{message.answer.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{message.answer.summary}</p>

                  {message.answer.bullets && message.answer.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {message.answer.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-1.5">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {message.answer.table && message.answer.table.rows.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                          <tr>
                            {message.answer.table.columns.map((column) => (
                              <th key={column} className="whitespace-nowrap px-2.5 py-2 font-semibold">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {message.answer.table.rows.map((row, rowIndex) => (
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

                  {message.answer.links && message.answer.links.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.answer.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                          {link.label} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your attendance data…
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 ring-1 ring-rose-200">{error}</p>
          )}

          <div ref={endRef} />
        </div>

        {chips.length > 0 && !busy && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => void ask(chip)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
          <label htmlFor="assistant-question" className="sr-only">
            Ask an attendance question
          </label>
          <input
            id="assistant-question"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={300}
            placeholder="e.g. Who is late today?"
            className="input flex-1"
            disabled={busy}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="btn btn-primary shrink-0"
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <p className="mt-3 text-center text-[11px] text-slate-400">
        Rule-based assistant · answers only from your own database · no record is changed
      </p>
    </div>
  );
}
