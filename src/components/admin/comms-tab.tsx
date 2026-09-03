"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import type { MessageLog } from "@prisma/client";
import type { AdminDataResponse } from "@/types/app";
import { useLang } from "@/components/i18n/language-provider";

type Kind = "SCHEDULE" | "REMINDER" | "ANNOUNCEMENT";
type Channel = "sms" | "email" | "both";
type AudienceType = "all" | "date" | "shift" | "volunteer";

const TEMPLATES: Record<Kind, string> = {
  SCHEDULE:
    "Hi {name}, your volunteer schedule is ready! Your day and position are below. Please arrive 30 minutes before your shift. Thank you!",
  REMINDER:
    "Hi {name}, friendly reminder — you're scheduled to volunteer tomorrow. Reply YES to confirm or NO if you can't make it.",
  ANNOUNCEMENT: "",
};

export function CommsTab({
  data,
  prefillShiftId,
  canSend,
}: {
  data: AdminDataResponse;
  prefillShiftId?: string;
  canSend: boolean;
}) {
  const { t } = useLang();
  const [kind, setKind] = useState<Kind>(prefillShiftId ? "SCHEDULE" : "ANNOUNCEMENT");
  const [channel, setChannel] = useState<Channel>("both");
  const [audienceType, setAudienceType] = useState<AudienceType>(prefillShiftId ? "shift" : "all");
  const [shiftId, setShiftId] = useState(prefillShiftId ?? "");
  const [date, setDate] = useState("");
  const [volunteerCode, setVolunteerCode] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(TEMPLATES[prefillShiftId ? "SCHEDULE" : "ANNOUNCEMENT"]);
  const [includeSchedule, setIncludeSchedule] = useState(!!prefillShiftId);
  const [preview, setPreview] = useState<{ recipients: number; smsEligible: number; emailEligible: number; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<MessageLog[]>([]);

  const audience =
    audienceType === "all"
      ? { type: "all" as const }
      : audienceType === "date"
        ? { type: "date" as const, date }
        : audienceType === "shift"
          ? { type: "shift" as const, shiftId }
          : { type: "volunteer" as const, volunteerCode };

  const audienceReady =
    audienceType === "all" ||
    (audienceType === "date" && !!date) ||
    (audienceType === "shift" && !!shiftId) ||
    (audienceType === "volunteer" && volunteerCode.trim().length > 0);

  const loadLogs = useCallback(async () => {
    const res = await fetch("/api/admin/comms", { cache: "no-store" });
    if (res.ok) {
      const payload = await res.json();
      setLogs(payload.logs ?? []);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!audienceReady) {
      setPreview(null);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch("/api/admin/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, channel, audience, subject, body: body || ".", includeSchedule, dryRun: true }),
      });
      setPreview(res.ok ? await res.json() : null);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceType, shiftId, date, volunteerCode, kind, channel, audienceReady]);

  function pickKind(next: Kind) {
    setKind(next);
    if (!body.trim() || Object.values(TEMPLATES).includes(body)) setBody(TEMPLATES[next]);
    if (next === "SCHEDULE") setIncludeSchedule(true);
  }

  async function deploy() {
    if (!audienceReady || !body.trim()) {
      setMessage(t("Pick recipients and write a message first."));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, channel, audience, subject, body, includeSchedule }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Send failed");
      setMessage(
        `${t("Deployed to")} ${payload.recipients} ${t("recipients")} — ${payload.smsSent} ${t("texts")}, ${payload.emailSent} ${t("emails")}${payload.errors?.length ? ` · ${payload.errors.length} ${t("errors (see log)")}` : ""}`,
      );
      await loadLogs();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("Send failed"));
    } finally {
      setBusy(false);
    }
  }

  const allDates = [...new Set(data.shifts.map((s) => format(new Date(s.date), "yyyy-MM-dd")))].sort();
  const previewName = data.volunteers[0]?.firstName || "Maria";
  const renderedBody = body.replaceAll("{name}", previewName);

  return (
    <section className="space-y-4">
      {!canSend && (
        <p className="panel border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("Schedulers can draft and preview here, but only supervisors and admins can press Deploy.")}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="panel space-y-3 p-4">
          <h2 className="text-lg font-black text-strawberry-900">{t("Compose")}</h2>

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Message type")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["SCHEDULE", "Schedule Notification"],
                  ["REMINDER", "Reminder"],
                  ["ANNOUNCEMENT", "General Announcement"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => pickKind(value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${kind === value ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-card"}`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Send to")}</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All volunteers"],
                  ["date", "Everyone on a date"],
                  ["shift", "Everyone on a shift"],
                  ["volunteer", "One volunteer (by ID)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setAudienceType(value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${audienceType === value ? "bg-leaf-500 text-white" : "border border-strawberry-100 bg-card"}`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <div className="mt-2">
              {audienceType === "date" && (
                <select value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm">
                  <option value="">{t("Pick a date…")}</option>
                  {allDates.map((d) => (
                    <option key={d} value={d}>{format(new Date(`${d}T00:00:00`), "EEE MMM d")}</option>
                  ))}
                </select>
              )}
              {audienceType === "shift" && (
                <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm">
                  <option value="">{t("Pick a shift…")}</option>
                  {data.shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {format(new Date(s.date), "EEE MMM d")} — {s.label}
                    </option>
                  ))}
                </select>
              )}
              {audienceType === "volunteer" && (
                <input
                  value={volunteerCode}
                  onChange={(e) => setVolunteerCode(e.target.value)}
                  placeholder="SC2027000001"
                  className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm"
                />
              )}
            </div>
            {preview && (
              <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-xs">
                <strong>{preview.recipients}</strong> {t("recipients")} ({preview.label}) · {preview.smsEligible} {t("can text")} · {preview.emailEligible} {t("can email")}
              </p>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Channel")}</p>
            <div className="flex gap-2">
              {(
                [
                  ["both", "Text + Email"],
                  ["sms", "Text only"],
                  ["email", "Email only"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setChannel(value)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${channel === value ? "bg-strawberry-500 text-white" : "border border-strawberry-100 bg-card"}`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>

          {channel !== "sms" && (
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60">{t("Email subject")}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm" placeholder={t("St. Clement Shortcake — Volunteer Update")} />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-foreground/60">
              {t("Message")} <span className="normal-case text-foreground/50">({t("write {name} to use each person's first name")})</span>
            </span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="w-full rounded-md border border-strawberry-200 px-2 py-2 text-sm" />
          </label>

          {kind === "SCHEDULE" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeSchedule} onChange={(e) => setIncludeSchedule(e.target.checked)} />
              {t("Attach the day/shift schedule to emails, with each person's own line highlighted")}
            </label>
          )}

          <button
            disabled={busy || !canSend || !audienceReady || !body.trim()}
            onClick={() => void deploy()}
            className="ops-btn ops-btn-primary w-full px-4 py-3 text-base disabled:opacity-50"
          >
            {busy ? t("Deploying…") : `🚀 ${t("Deploy")}${preview ? ` (${preview.recipients})` : ""}`}
          </button>
          {message && <p className="rounded-md bg-muted px-2 py-1.5 text-sm">{message}</p>}
        </div>

        <div className="space-y-4">
          <div className="panel p-4">
            <h2 className="text-lg font-black text-strawberry-900">{t("Preview")}</h2>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/60">📱 {t("Text message")}</p>
                <div className="rounded-2xl bg-[#e9f6e9] p-3 text-sm leading-relaxed">
                  <p className="text-xs font-bold text-leaf-700">St. Clement Strawberry Festival</p>
                  <p className="mt-1 whitespace-pre-wrap">{renderedBody || t("(empty message)")}</p>
                  <p className="mt-1 text-xs text-foreground/50">{t("Reply STOP to opt out.")}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-foreground/60">✉️ {t("Email")}</p>
                <div className="rounded-xl border border-strawberry-100 text-sm">
                  <div className="rounded-t-xl bg-strawberry-500 px-3 py-2 text-xs font-bold text-white">🍓 St. Clement Strawberry Festival</div>
                  <div className="p-3">
                    <p className="text-xs text-foreground/60">{t("Subject:")} {subject || t("St. Clement Strawberry Festival — Volunteer Update")}</p>
                    <p className="mt-2 whitespace-pre-wrap">{renderedBody || t("(empty message)")}</p>
                    {kind === "SCHEDULE" && includeSchedule && (
                      <div className="mt-2 border-t border-strawberry-100 pt-2 text-xs">
                        <p className="font-bold">{t("Wednesday, Mar 4 — Day Shift")}</p>
                        <p className="text-foreground/70">Cashier: Ana Lopez (SC2027000007)</p>
                        <p className="rounded bg-strawberry-50 px-1 py-0.5 font-bold text-strawberry-700">★ Berry Girl: {previewName} (SC2027000001)</p>
                        <p className="text-foreground/70">Ticket Taker: Sam Ortiz (SC2027000012)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="text-lg font-black text-strawberry-900">{t("Send Log")}</h2>
            <div className="mt-2 max-h-72 space-y-1.5 overflow-auto text-xs">
              {logs.length === 0 ? (
                <p className="text-foreground/60">{t("Nothing sent yet.")}</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="rounded-md border border-strawberry-100 bg-card px-2 py-1.5">
                    <p className="font-bold">
                      {log.kind} · {log.channel} → {log.audience} ({log.recipientCount})
                      {log.errorCount > 0 && <span className="ml-1 text-red-600">{log.errorCount} {t("errors")}</span>}
                    </p>
                    <p className="text-foreground/60">
                      {format(new Date(log.createdAt), "MMM d HH:mm")} · {t("by")} {log.sentBy}
                    </p>
                    {log.errors && <p className="mt-0.5 whitespace-pre-wrap text-red-700">{log.errors}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
