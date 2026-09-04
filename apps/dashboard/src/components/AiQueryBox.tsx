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
    <div style={{ ...card, marginBottom: "1.5rem", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: "0.75rem",
          borderBottom: `1px solid ${theme.color.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <i className="fa-regular fa-comment-dots" style={{ color: theme.color.textMuted, fontSize: "0.8rem" }} />
          <div style={{ fontWeight: theme.font.weight.bold, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Ask about your data
          </div>
        </div>
        <span
          style={{
            fontSize: "0.625rem",
            fontFamily: theme.font.mono,
            color: theme.color.textMuted,
            background: theme.color.bg,
            border: `1px solid ${theme.color.border}`,
            padding: "0.125rem 0.375rem",
            borderRadius: theme.radius.small,
          }}
        >
          ⌘K
        </span>
      </div>
      <p style={{ fontSize: "0.75rem", color: theme.color.textMuted, marginTop: "0.625rem", lineHeight: 1.6 }}>
        Query traffic, drop-off spots, or custom events in human natural language.
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: "0.75rem" }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which referrer sends the highest iframe interaction rate?"
          disabled={status === "loading"}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: `1px solid ${theme.color.fieldBorder}`,
            borderRadius: theme.radius.control,
            padding: "0.625rem",
            fontSize: "0.75rem",
            fontFamily: "inherit",
            color: theme.color.text,
            background: theme.color.bg,
            resize: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
          <span style={{ fontSize: "0.625rem", fontFamily: theme.font.mono, color: theme.color.textFaint }}>
            {question.length} / {MAX_QUESTION_LENGTH} chars
            {tooLong && " - too long"}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.75rem",
              borderRadius: theme.radius.small,
              border: "none",
              background: canSubmit ? theme.color.brand : theme.color.fieldBorder,
              color: theme.color.onBrand,
              fontSize: "0.75rem",
              fontWeight: theme.font.weight.semibold,
              cursor: canSubmit ? "pointer" : "default",
            }}
          >
            <span>{status === "loading" ? "Asking…" : "Ask"}</span>
            <i className="fa-solid fa-arrow-up" style={{ fontSize: "0.5625rem" }} />
          </button>
        </div>
      </form>
      <div style={{ paddingTop: "0.75rem", borderTop: `1px solid ${theme.color.border}`, marginTop: "0.75rem" }}>
        <div style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: theme.font.weight.bold, color: theme.color.textFaint, letterSpacing: "0.06em" }}>
          Suggested queries
        </div>
        <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {[
            { icon: "⚡", text: "Referrer conversion comparison" },
            { icon: "🗺", text: "Geolocation drop-offs" },
          ].map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => setQuestion(suggestion.text)}
              className="lantern-chip"
              style={{
                fontSize: "0.6875rem",
                color: theme.color.textMuted,
                background: theme.color.bg,
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.small,
                padding: "0.25rem 0.5rem",
                cursor: "pointer",
                textAlign: "left",
                maxWidth: "100%",
              }}
            >
              {suggestion.icon} {suggestion.text}
            </button>
          ))}
        </div>
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
