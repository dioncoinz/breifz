"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import SpeechToTextButton from "@/components/SpeechToTextButton";
import MeetingRecorderButton from "@/components/MeetingRecorderButton";
import { formatDateDDMMYYYY } from "@/lib/date";

type HandoverItem = {
  id: string;
  notes: string;
  created_at: string;
};

function summarizeHandovers(items: HandoverItem[]) {
  if (!items.length) return "";

  const candidates = items
    .flatMap((item) =>
      item.notes
        .replace(/\s+/g, " ")
        .split(/[.!?]\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .map((s) => s.replace(/[.;:,]+$/g, ""))
    .filter((s) => s.length > 20);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const sentence of candidates) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sentence);
    if (unique.length >= 5) break;
  }

  if (!unique.length) return "";

  return unique.map((line) => `- ${line}`).join("\n");
}

function summarizeOrFallback(items: HandoverItem[]) {
  const summary = summarizeHandovers(items);
  if (summary.trim()) return summary;

  const fallback = items
    .slice(0, 3)
    .map((item) => item.notes.trim())
    .filter(Boolean)
    .join("\n\n");

  return fallback;
}

function summarizeTranscript(text: string) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= 8) break;
  }

  if (!unique.length) return "";
  return unique.map((line) => `- ${line}`).join("\n");
}

export default function ProjectPrestartPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [handoverSummary, setHandoverSummary] = useState("");
  const [prestartDate, setPrestartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<"days" | "nights">("days");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const [incidentReview, setIncidentReview] = useState("");
  const [incidentCause, setIncidentCause] = useState("");
  const [incidentLessons, setIncidentLessons] = useState("");
  const [incidentPrevention, setIncidentPrevention] = useState("");
  const [unsafeConditions, setUnsafeConditions] = useState("");
  const [unsafeActs, setUnsafeActs] = useState("");
  const [hazardsToBeAwareOf, setHazardsToBeAwareOf] = useState("");
  const [changesToBeAwareOf, setChangesToBeAwareOf] = useState("");
  const [safetyPositives, setSafetyPositives] = useState("");
  const [todaysScopeOfWork, setTodaysScopeOfWork] = useState("");
  const [toolboxAgendaItems, setToolboxAgendaItems] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [meetingTranscript, setMeetingTranscript] = useState("");

  function appendTranscript(setter: (fn: (prev: string) => string) => void, text: string) {
    setter((prev) => (prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${text}` : text));
  }

  function addAttendee() {
    const name = attendeeInput.trim();
    if (!name) return;

    setAttendees((prev) => {
      if (prev.some((entry) => entry.toLowerCase() === name.toLowerCase())) {
        return prev;
      }
      return [...prev, name];
    });
    setAttendeeInput("");
  }

  function removeAttendee(name: string) {
    setAttendees((prev) => prev.filter((entry) => entry !== name));
  }

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  async function generateSummary() {
    if (!projectId) return;
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message || "Not logged in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      setError(profileError?.message || "Profile missing tenant.");
      return;
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("tenant_id", profile.tenant_id)
      .eq("id", projectId)
      .maybeSingle();

    if (project?.name) setProjectName(project.name);

    const { data, error: handoverError } = await supabase
      .from("handovers")
      .select("id, notes, created_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("project_id", projectId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(12);

    if (handoverError) {
      setError(handoverError.message);
      return;
    }

    let rows = data || [];
    if (rows.length === 0) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("handovers")
        .select("id, notes, created_at")
        .eq("tenant_id", profile.tenant_id)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (fallbackError) {
        setError(fallbackError.message);
        return;
      }

      rows = fallbackRows || [];
    }

    if (rows.length === 0) {
      setHandoverSummary("No supervisor handovers found for this project yet.");
      return;
    }

    setHandoverSummary(summarizeOrFallback(rows));
  }

  useEffect(() => {
    if (!projectId) return;
    if (!handoverSummary) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError("Missing project id from route.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      setError(authError?.message || "Not logged in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      setSaving(false);
      setError(profileError?.message || "Profile missing tenant.");
      return;
    }

    const prestartTitle = `${prestartDate} - ${shift === "days" ? "Days" : "Nights"}`;
    const attendeeSummary = attendees.join(", ");

    const notes = [
      `Prestart: ${prestartTitle}`,
      attendeeSummary ? `Attendees: ${attendeeSummary}` : null,
      incidentReview ? `Incident review: ${incidentReview}` : null,
      incidentCause ? `Why did it happen?: ${incidentCause}` : null,
      incidentLessons ? `What are our free lessons?: ${incidentLessons}` : null,
      incidentPrevention ? `How can we prevent it from happening again?: ${incidentPrevention}` : null,
      unsafeConditions ? `Unsafe conditions: ${unsafeConditions}` : null,
      unsafeActs ? `Unsafe acts: ${unsafeActs}` : null,
      hazardsToBeAwareOf ? `Hazards to be aware of: ${hazardsToBeAwareOf}` : null,
      changesToBeAwareOf ? `Changes to be aware of: ${changesToBeAwareOf}` : null,
      safetyPositives ? `Safety positives: ${safetyPositives}` : null,
      todaysScopeOfWork ? `Today's scope of work: ${todaysScopeOfWork}` : null,
      toolboxAgendaItems ? `Toolbox specific safety agenda items to be discussed: ${toolboxAgendaItems}` : null,
      meetingTranscript ? `Meeting transcript: ${meetingTranscript}` : null,
      extraNotes ? `Extra notes: ${extraNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error: insertError } = await supabase.from("prestarts").insert({
      tenant_id: profile.tenant_id,
      project_id: projectId,
      created_by: user.id,
      handover_summary: handoverSummary,
      notes,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess("Prestart saved.");
    setExtraNotes("");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Prestart Meeting</h1>
      <p style={{ color: "#555", marginTop: 8 }}>Project: {projectName || projectId || "..."}</p>
      <div
        style={{
          marginTop: 8,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
          maxWidth: 520,
        }}
      >
        <div style={{ fontWeight: 900 }}>
          Prestart: {formatDateDDMMYYYY(prestartDate)} - {shift === "days" ? "Days" : "Nights"}
        </div>
        <label style={{ fontWeight: 800 }}>
          Date
          <input
            type="date"
            required
            value={prestartDate}
            onChange={(e) => setPrestartDate(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          />
        </label>
        <label style={{ fontWeight: 800 }}>
          Shift
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as "days" | "nights")}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          >
            <option value="days">Days</option>
            <option value="nights">Nights</option>
          </select>
        </label>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ fontWeight: 800 }}>
          Handover summary
          <textarea
            required
            rows={6}
            value={handoverSummary}
            onChange={(e) => setHandoverSummary(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
              resize: "vertical",
            }}
          />
        </label>

        <label style={{ fontWeight: 800 }}>
          Attendees
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "stretch" }}>
            <input
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttendee();
                }
              }}
              placeholder="Enter a person"
              className="field"
              style={{ marginTop: 0 }}
            />
            <button
              type="button"
              onClick={addAttendee}
              className="action-button"
              style={{ whiteSpace: "nowrap" }}
            >
              + Add attendee
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {attendees.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => removeAttendee(name)}
                className="action-button"
                style={{ minHeight: 36, padding: "8px 12px" }}
                title={`Remove ${name}`}
              >
                {name} x
              </button>
            ))}
            {attendees.length === 0 && (
              <span className="muted" style={{ fontWeight: 500 }}>
                Add each attendee with the plus button.
              </span>
            )}
          </div>
        </label>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            INCIDENT REVIEW
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Did we have a safe day or safe shift yesterday? If not, what happened and has an incident/hazard report been completed?
            <textarea
              rows={5}
              value={incidentReview}
              onChange={(e) => setIncidentReview(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "block", fontWeight: 800 }}>
            Why did it happen?
            <textarea
              rows={3}
              value={incidentCause}
              onChange={(e) => setIncidentCause(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "block", fontWeight: 800 }}>
            What are our free lessons?
            <textarea
              rows={3}
              value={incidentLessons}
              onChange={(e) => setIncidentLessons(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "block", fontWeight: 800 }}>
            How can we prevent it from happening again?
            <textarea
              rows={3}
              value={incidentPrevention}
              onChange={(e) => setIncidentPrevention(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            ANY SAFETY ISSUES FROM THE PREVIOUS DAY / SHIFT?
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Unsafe conditions (work surroundings / equipment / environmental)?
            <textarea
              rows={4}
              value={unsafeConditions}
              onChange={(e) => setUnsafeConditions(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "block", fontWeight: 800 }}>
            Unsafe acts (risk-taking, poor behaviour / attitude, being fatigued / stressed, medication causing drowsiness)?
            <textarea
              rows={4}
              value={unsafeActs}
              onChange={(e) => setUnsafeActs(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            ANY HAZARDS OR CHANGES IN THE WORKPLACE, EQUIPMENT OR THE ENVIRONMENT?
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Work surroundings / equipment / environmental / chemical hazards to be aware of:
            <textarea
              rows={4}
              value={hazardsToBeAwareOf}
              onChange={(e) => setHazardsToBeAwareOf(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>

          <label style={{ display: "block", fontWeight: 800 }}>
            Changes to be aware of:
            <textarea
              rows={4}
              value={changesToBeAwareOf}
              onChange={(e) => setChangesToBeAwareOf(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            ANY SAFETY POSITIVES / POSITIVE ACTS TOWARDS ZERO HARM?
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Positive observations
            <textarea
              rows={4}
              value={safetyPositives}
              onChange={(e) => setSafetyPositives(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            TODAY&apos;S SCOPE OF WORK
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Scope for today
            <textarea
              rows={4}
              value={todaysScopeOfWork}
              onChange={(e) => setTodaysScopeOfWork(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <section className="panel" style={{ padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            TOOLBOX SPECIFIC SAFETY AGENDA ITEMS TO BE DISCUSSED
          </div>

          <label style={{ display: "block", fontWeight: 800 }}>
            Agenda items
            <textarea
              rows={4}
              value={toolboxAgendaItems}
              onChange={(e) => setToolboxAgendaItems(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: "1px solid #ddd",
                marginTop: 10,
                resize: "vertical",
              }}
            />
          </label>
        </section>

        <label style={{ fontWeight: 800 }}>
          Meeting transcript (speech-to-text)
          <textarea
            rows={6}
            value={meetingTranscript}
            onChange={(e) => setMeetingTranscript(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Capture your 15-minute meeting conversation here..."
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <MeetingRecorderButton
              onTranscript={(text) => appendTranscript(setMeetingTranscript, text)}
              disabled={saving}
              maxMinutes={15}
            />
            <SpeechToTextButton
              onTranscript={(text) => appendTranscript(setMeetingTranscript, text)}
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => {
                const summary = summarizeTranscript(meetingTranscript);
                if (!summary.trim()) {
                  setError("No transcript content to summarize yet.");
                  return;
                }
                setError(null);
                setHandoverSummary(summary);
              }}
              className="action-button"
              style={{
                marginLeft: "auto",
                minHeight: 42,
                padding: "8px 12px",
                lineHeight: 1.2,
                background: "linear-gradient(180deg, #eefbf2 0%, #daf3e3 100%)",
                borderColor: "#a8d5b5",
                color: "#1f5a31",
              }}
            >
              Summarize meeting
            </button>
          </div>
        </label>

        <label style={{ fontWeight: 800 }}>
          Extra notes
          <textarea
            rows={4}
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton
            onTranscript={(text) => appendTranscript(setExtraNotes, text)}
            disabled={saving}
          />
        </label>

        {error && <div style={{ color: "crimson", fontWeight: 800 }}>{error}</div>}
        {success && <div style={{ color: "green", fontWeight: 800 }}>{success}</div>}

        <button
          disabled={saving}
          style={{
            padding: 12,
            borderRadius: 12,
            border: 0,
            background: "black",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : "Save prestart"}
        </button>
      </form>
    </main>
  );
}
