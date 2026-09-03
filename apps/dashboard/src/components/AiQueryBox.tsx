"use client";

import { useState } from "react";
import { card, theme } from "@/lib/theme";
import { MAX_QUESTION_LENGTH } from "@/lib/ai-query";

type Status = "idle" | "loading" | "answered" | "error";

/**
 * The first real client-side fetch in this dashboard (everything else is
 * server-rendered + query-param navigation) - POST /api/ai-query is a real
 * HTTP route specifically because this needs to run from the browser, see
 * docs/design.md's Phase 3 section. Client-side pre-validation (empty/too
 * long) happens before the fetch so a doomed request never spends one of the
 * route's 5-per-60s global rate-limit slots.
 */
export function AiQueryBox({ siteId, monthPrefix }: { siteId: string; monthPrefix?: string }) {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const trimmed = question.trim();
  const tooLong = question.length > MAX_QUESTION_LENGTH;
  const canSubmit = trimmed.length > 0 && !tooLong && status !== "loading";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setError(null);
    setRetryAfter(null);

    try {
      const res = await fetch("/api/ai-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, question: trimmed, monthPrefix }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const seconds = Number(res.headers.get("Retry-After")) || null;
          setRetryAfter(seconds);
          setError(seconds ? `Rate limited - try again in ${seconds}s.` : "Rate limited - try again shortly.");
        } else {
          setError(body.error ?? "AI query failed, try again shortly.");
        }
        setStatus("error");
        return;
      }

      setAnswer(body.answer);
      setStatus("answered");
    } catch {
      setError("AI query failed, try again shortly.");
      setStatus("error");
    }
  }

  return (
    <div style={{ ...card, marginBottom: "1.5rem" }}>
      <div style={{ fontWeight: theme.font.weight.semibold, fontSize: "0.85rem", marginBottom: "0.7rem" }}>Ask about your data</div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which referrer sends the most engaged visitors?"
          disabled={status === "loading"}
          style={{
            flex: 1,
            minWidth: 240,
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.small,
            padding: "6px 8px",
            fontSize: "0.85rem",
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "6px 12px",
            borderRadius: theme.radius.small,
            border: "none",
            background: canSubmit ? theme.color.brand : theme.color.fieldBorder,
            color: theme.color.onBrand,
            fontSize: "0.85rem",
            cursor: canSubmit ? "pointer" : "default",
          }}
        >
          {status === "loading" ? "Asking…" : "Ask"}
        </button>
      </form>
      <div
        style={{ fontSize: "0.72rem", color: theme.color.textMuted, marginTop: "0.3rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>
          {question.length} / {MAX_QUESTION_LENGTH} chars
          {tooLong && " - too long"}
        </span>
        <span
          style={{
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.small,
            padding: "0 0.35rem",
            fontSize: "0.68rem",
          }}
        >
          ⌘K
        </span>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
        {["Referrer conversion comparison", "Geolocation drop-offs"].map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => setQuestion(suggestion)}
            style={{
              fontSize: "0.72rem",
              color: theme.color.brandTintTextStrong,
              background: theme.color.brandTintBg,
              border: "none",
              borderRadius: theme.radius.pill,
              padding: "0.25rem 0.6rem",
              cursor: "pointer",
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {status === "answered" && answer && (
        <div style={{ fontSize: "0.86rem", marginTop: "0.6rem" }}>{answer}</div>
      )}
      {status === "error" && error && (
        <div style={{ fontSize: "0.85rem", color: theme.color.amber, marginTop: "0.6rem" }}>
          {error}
          {retryAfter !== null && " (button re-enables once you try again)"}
        </div>
      )}
    </div>
  );
}
