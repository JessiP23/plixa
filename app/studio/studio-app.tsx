"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PlanSheet } from "@/app/components/plan-sheet";
import type { ReviewProject } from "@/lib/store";

type Filter = "fail" | "inconclusive" | "pass" | "all";

export function StudioApp() {
  const [projects, setProjects] = useState<ReviewProject[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("New residence");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("fail");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      void load(query).then((next) => {
        if (!active) return;
        setProjects(next);
        setSelectedId((current) => (next.some((project) => project.id === current) ? current : next[0]?.id ?? null));
      });
    }, 180);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const verdicts = useMemo(() => {
    if (!selected) return [];
    return selected.report.verdicts.filter((verdict) => {
      if (focus && !verdict.elements.includes(focus)) return false;
      if (filter === "all") return true;
      return verdict.status === filter;
    });
  }, [selected, filter, focus]);

  async function create(source: "calibrated-sample" | "captured-plan" | "uploaded-ir", ir?: unknown) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, source, ir }),
      });
      const body = (await response.json()) as { project?: ReviewProject; error?: string };
      if (!response.ok || !body.project) throw new Error(body.error ?? "Review failed.");
      setProjects((current) => [body.project!, ...current.filter((project) => project.id !== body.project!.id)]);
      setSelectedId(body.project.id);
      setFocus(null);
      setFilter("fail");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="wordmark">Plixa</Link>
        <p className="meta">Northline studio · tenant {projects[0]?.orgId ?? "org_northline"}</p>
      </header>
      <aside className="sidebar">
        <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rooms, rules, projects" />
        <label className="meta" htmlFor="project-name">New review</label>
        <input id="project-name" className="field" value={name} onChange={(event) => setName(event.target.value)} />
        <div className="row">
          <button className="button" disabled={busy} onClick={() => void create("calibrated-sample")}>Review sample</button>
          <button className="button-secondary" disabled={busy} onClick={() => void create("captured-plan")}>Review captured plan</button>
        </div>
        <label className="button-secondary">
          Upload IR JSON
          <input
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                const parsed = JSON.parse(text) as unknown;
                return create("uploaded-ir", parsed);
              }).catch(() => setError("That file is not valid JSON."));
            }}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="project-list">
          {projects.map((project) => (
            <button key={project.id} className={project.id === selectedId ? "project active" : "project"} onClick={() => { setSelectedId(project.id); setFocus(null); }}>
              <strong>{project.name}</strong>
              <span className="muted">{project.report.summary.fail} failing · {project.report.summary.inconclusive} inconclusive</span>
            </button>
          ))}
          {projects.length === 0 ? <p className="note">No projects match that search.</p> : null}
        </div>
      </aside>
      <section className="workspace">
        {selected ? (
          <>
            <div className="banner">
              <strong>{selected.perception.mode === "captured-plan" ? "Captured perception output. " : selected.perception.mode === "uploaded-ir" ? "Uploaded IR. " : "Calibrated sample. "}</strong>
              {selected.perception.note} Pack {selected.report.pack.base} {selected.report.pack.version} is pending human certification. This is a review aid, not a permit.
            </div>
            <div className="row" style={{ marginBottom: 14, justifyContent: "space-between" }}>
              <h2 className="sheet-title" style={{ margin: 0 }}>{selected.name}</h2>
              <div className="counts">
                <span className="count pass">{selected.report.summary.pass} pass</span>
                <span className="count fail">{selected.report.summary.fail} fail</span>
                <span className="count inc">{selected.report.summary.inconclusive} inconclusive</span>
              </div>
            </div>
            <div className="split">
              <div className="sheet">
                <PlanSheet ir={selected.ir} report={selected.report} selected={focus} onSelect={(id) => { setFocus(id); setFilter("all"); }} />
                <p className="note">Kernel finished in {selected.report.durationMs} ms. Red rooms have a code violation. Click a room to read only its verdicts.</p>
              </div>
              <div className="panel">
                <div className="chips">
                  {(["fail", "inconclusive", "pass", "all"] as Filter[]).map((item) => (
                    <button key={item} className={filter === item ? "chip on" : "chip"} onClick={() => setFilter(item)}>{item}</button>
                  ))}
                  {focus ? <button className="chip" onClick={() => setFocus(null)}>Clear room</button> : null}
                </div>
                <div>
                  {verdicts.slice(0, 40).map((verdict) => (
                    <button
                      key={`${verdict.ruleId}-${verdict.elements.join("-")}`}
                      className={focus && verdict.elements.includes(focus) ? "verdict active" : "verdict"}
                      onClick={() => setFocus(verdict.elements[0] ?? null)}
                    >
                      <b>{verdict.title}</b>
                      <div className="note">
                        {verdict.citation.code} {verdict.citation.section} · {verdict.status}
                        {verdict.measured !== null ? ` · measured ${String(verdict.measured)}` : ""} · required {String(verdict.required)}
                      </div>
                    </button>
                  ))}
                  {verdicts.length === 0 ? <p className="note">Nothing in this filter.</p> : null}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="note">Run a review to see the plan and the code citations.</p>
        )}
      </section>
    </div>
  );
}

async function load(query: string) {
  const response = await fetch(`/api/projects?q=${encodeURIComponent(query)}`);
  const body = (await response.json()) as { projects: ReviewProject[] };
  return body.projects;
}
