"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Player } from "@remotion/player";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Clapperboard, Copy, Download, FileJson, Film, LayoutDashboard, LoaderCircle, Plus, RefreshCw, Sparkles, Trash2, WandSparkles, X } from "lucide-react";
import { ReelFlowVideo, type ReelFlowVideoProps } from "@/remotion/ReelFlowVideo";
import { demoInput } from "@/lib/fixtures";
import { totalFrames } from "@/lib/timing";
import type { Project, ProjectInput, Scene, Script } from "@/lib/schema";

type View = "dashboard" | "create" | "script" | "storyboard" | "preview";
type Notice = { type: "success" | "error"; message: string } | null;
const steps: { id: View; label: string; number: string }[] = [
  { id: "create", label: "Brief", number: "01" }, { id: "script", label: "Script", number: "02" },
  { id: "storyboard", label: "Scenes", number: "03" }, { id: "preview", label: "Export", number: "04" },
];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.error || "Request failed");
  return body as T;
}

function StatusPill({ status }: { status: Project["status"] }) {
  const busy = status === "generating" || status === "rendering";
  return <span className={`status status-${status}`}>{busy ? <LoaderCircle size={12} className="spin" /> : <span className="status-dot" />}{status}</span>;
}

export function ReelFlowApp() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [demo, setDemo] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const refresh = useCallback(async () => {
    try { setProjects(await request<Project[]>("/api/projects")); }
    catch (error) { setNotice({ type: "error", message: (error as Error).message }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const open = (selected: Project, destination: View = selected.script ? "script" : "create") => { setProject(selected); setView(destination); setNotice(null); };
  const save = async (patch: Partial<Project>, message?: string) => {
    if (!project) return null;
    const saved = await request<Project>(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    setProject(saved); setProjects((items) => items.map((item) => item.id === saved.id ? saved : item));
    if (message) setNotice({ type: "success", message });
    return saved;
  };
  const create = async (input: ProjectInput) => {
    setBusy("Saving your brief…");
    try {
      const created = await request<Project>("/api/projects", { method: "POST", body: JSON.stringify(input) });
      setProject(created); setProjects((items) => [created, ...items]); setView("script");
      setBusy(demo ? "Building a deterministic demo plan…" : "Writing script and generating media…");
      const result = await request<{ project: Project; warnings: string[] }>("/api/generate", { method: "POST", body: JSON.stringify({ projectId: created.id, demo }) });
      setProject(result.project); setProjects((items) => items.map((item) => item.id === created.id ? result.project : item));
      setNotice({ type: result.warnings.length ? "error" : "success", message: result.warnings.length ? result.warnings.join(" ") : "Script and storyboard are ready." });
    } catch (error) { setNotice({ type: "error", message: (error as Error).message }); await refresh(); }
    finally { setBusy(null); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try { await request(`/api/projects/${id}`, { method: "DELETE" }); setProjects((items) => items.filter((item) => item.id !== id)); }
    catch (error) { setNotice({ type: "error", message: (error as Error).message }); }
  };
  const duplicate = async (id: string) => {
    try { const copy = await request<Project>(`/api/projects/${id}`, { method: "POST", body: JSON.stringify({ action: "duplicate" }) }); setProjects((items) => [copy, ...items]); setNotice({ type: "success", message: "Project duplicated." }); }
    catch (error) { setNotice({ type: "error", message: (error as Error).message }); }
  };
  const render = async () => {
    if (!project) return; setBusy("Rendering 1080 × 1920 MP4…");
    try { const saved = await request<Project>("/api/render", { method: "POST", body: JSON.stringify({ projectId: project.id }) }); setProject(saved); setNotice({ type: "success", message: "Your MP4 is ready to download." }); }
    catch (error) { setNotice({ type: "error", message: (error as Error).message }); }
    finally { setBusy(null); }
  };
  const regenerate = async (action: "section" | "image", details: Record<string, string>) => {
    if (!project) return;
    setBusy(action === "image" ? "Regenerating scene image…" : "Rewriting script section…");
    try {
      const result = await request<{ project: Project; warnings: string[] }>("/api/generate", { method: "POST", body: JSON.stringify({ projectId: project.id, demo, action, ...details }) });
      setProject(result.project);
      setProjects((items) => items.map((item) => item.id === result.project.id ? result.project : item));
      setNotice({ type: result.warnings.length ? "error" : "success", message: result.warnings[0] ?? (action === "image" ? "Scene image regenerated." : "Script section regenerated.") });
    } catch (error) { setNotice({ type: "error", message: (error as Error).message }); }
    finally { setBusy(null); }
  };

  return <div className="app-shell">
    <aside className="sidebar"><button className="brand" onClick={() => setView("dashboard")}><span className="brand-mark"><Film size={19} /></span><span>ReelFlow</span></button><nav><button className={view === "dashboard" ? "nav-active" : ""} onClick={() => setView("dashboard")}><LayoutDashboard size={18} /> Projects</button><button className={view === "create" ? "nav-active" : ""} onClick={() => { setProject(null); setView("create"); }}><Plus size={18} /> Create reel</button></nav><div className="sidebar-signout"><span className="user-email" title={session?.user?.email ?? ""}>{session?.user?.email ?? session?.user?.name ?? "Signed in"}</span><button onClick={() => signOut()}>Sign out</button></div></aside>
    <main className="workspace">
      {view !== "dashboard" && <header className="topbar"><button className="icon-button mobile-back" onClick={() => setView("dashboard")} aria-label="Back to projects"><ArrowLeft size={18} /></button><div className="stepper">{steps.map((step) => <button key={step.id} className={view === step.id ? "step-active" : ""} onClick={() => project || step.id === "create" ? setView(step.id) : undefined}><span>{step.number}</span>{step.label}</button>)}</div><label className="demo-toggle"><input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} /><span /> Demo</label></header>}
      {notice && <div className={`notice notice-${notice.type}`}><span>{notice.type === "success" ? <Check size={17} /> : <Sparkles size={17} />}{notice.message}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
      {busy && <div className="busy-overlay"><div className="busy-card"><div className="orb"><LoaderCircle className="spin" size={30} /></div><strong>{busy}</strong><span>Keep this window open. Your project is saved.</span></div></div>}
      {view === "dashboard" && <Dashboard projects={projects} loading={loading} onCreate={() => { setProject(null); setView("create"); }} onOpen={open} onDuplicate={duplicate} onDelete={remove} />}
      {view === "create" && <CreateForm initial={project ?? undefined} demo={demo} onSubmit={create} onUpdate={async (input) => { await save(input, "Brief saved."); setView("script"); }} />}
      {view === "script" && project && <ScriptEditor key={project.updatedAt} project={project} onSave={save} onRegenerate={(section) => regenerate("section", { section })} onNext={() => setView("storyboard")} />}
      {view === "storyboard" && project && <StoryboardEditor key={project.updatedAt} project={project} demo={demo} onSave={save} onRegenerate={(sceneId) => regenerate("image", { sceneId })} onNext={() => setView("preview")} />}
      {view === "preview" && project && <Preview project={project} onRender={render} />}
    </main>
  </div>;
}

function Dashboard({ projects, loading, onCreate, onOpen, onDuplicate, onDelete }: { projects: Project[]; loading: boolean; onCreate: () => void; onOpen: (p: Project, view?: View) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="page dashboard-page"><div className="page-heading"><div><p className="eyebrow">CREATOR WORKSPACE</p><h1>Turn one idea into<br /><em>a finished reel.</em></h1><p>Script, storyboard, voice and export—all in one focused flow.</p></div><button className="primary-button" onClick={onCreate}><WandSparkles size={18} /> Create reel</button></div><section><div className="section-heading"><div><h2>Recent projects</h2><span>{projects.length} project{projects.length === 1 ? "" : "s"}</span></div></div>{loading ? <div className="empty"><LoaderCircle className="spin" /> Loading projects…</div> : projects.length === 0 ? <div className="empty"><Clapperboard /><h3>Your first reel starts here</h3><button className="secondary-button" onClick={onCreate}>Create project</button></div> : <div className="project-grid">{projects.map((item, index) => <article className="project-card" key={item.id}><button className={`project-cover cover-${index % 4}`} onClick={() => onOpen(item)}><span className="platform-chip">{item.platform}</span><strong>{item.topic}</strong><span className="duration">{item.duration}s</span></button><div className="project-meta"><div><StatusPill status={item.status} /><span>{new Date(item.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span></div><div className="card-actions"><button onClick={() => onOpen(item)} title="Reopen"><ArrowRight size={16} /></button><button onClick={() => onDuplicate(item.id)} title="Duplicate"><Copy size={15} /></button><button onClick={() => onDelete(item.id)} title="Delete"><Trash2 size={15} /></button></div></div></article>)}</div>}</section></div>;
}

function CreateForm({ initial, demo, onSubmit, onUpdate }: { initial?: Project; demo: boolean; onSubmit: (input: ProjectInput) => void; onUpdate: (input: ProjectInput) => void }) {
  const [form, setForm] = useState<ProjectInput>(() => initial ? { topic: initial.topic, targetAudience: initial.targetAudience, platform: initial.platform, objective: initial.objective, tone: initial.tone, duration: initial.duration, visualStyle: initial.visualStyle, voice: initial.voice, callToAction: initial.callToAction, brandInstructions: initial.brandInstructions, imageQuality: initial.imageQuality } : demoInput);
  const update = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="page form-page"><div className="form-intro"><p className="eyebrow">01 — CREATIVE BRIEF</p><h1>Start with the idea.</h1><p>Give ReelFlow enough direction to make the first cut feel like yours.</p></div><form onSubmit={(event) => { event.preventDefault(); initial ? onUpdate(form) : onSubmit(form); }} className="brief-form"><label className="field field-wide"><span>Topic or idea</span><textarea required minLength={3} maxLength={500} value={form.topic} onChange={(e) => update("topic", e.target.value)} placeholder="What should this reel be about?" /></label><label className="field"><span>Target audience</span><input required value={form.targetAudience} onChange={(e) => update("targetAudience", e.target.value)} /></label><label className="field"><span>Platform</span><select value={form.platform} onChange={(e) => update("platform", e.target.value as ProjectInput["platform"])}><option>Instagram Reels</option><option>TikTok</option><option>YouTube Shorts</option></select></label><label className="field"><span>Content objective</span><select value={form.objective} onChange={(e) => update("objective", e.target.value)}><option>Educate and build trust</option><option>Drive engagement</option><option>Promote an offer</option><option>Tell a story</option></select></label><label className="field"><span>Tone</span><input required value={form.tone} onChange={(e) => update("tone", e.target.value)} /></label><fieldset className="field field-wide"><legend>Duration</legend><div className="segmented">{[30, 45, 60].map((seconds) => <button type="button" className={form.duration === seconds ? "selected" : ""} key={seconds} onClick={() => update("duration", seconds as 30 | 45 | 60)}>{seconds} seconds</button>)}</div></fieldset><label className="field"><span>Visual style</span><input required value={form.visualStyle} onChange={(e) => update("visualStyle", e.target.value)} /></label><label className="field"><span>Voice</span><select value={form.voice} onChange={(e) => update("voice", e.target.value as ProjectInput["voice"])}>{["alloy", "coral", "nova", "sage", "shimmer", "verse"].map((voice) => <option key={voice}>{voice}</option>)}</select></label><label className="field"><span>Call to action <small>optional</small></span><input value={form.callToAction} onChange={(e) => update("callToAction", e.target.value)} /></label><label className="field"><span>Image quality</span><select value={form.imageQuality} onChange={(e) => update("imageQuality", e.target.value as "standard" | "premium")}><option value="standard">Standard · Flare</option><option value="premium">Premium · Sunburst</option></select></label><label className="field field-wide"><span>Brand instructions <small>optional</small></span><textarea maxLength={1500} value={form.brandInstructions} onChange={(e) => update("brandInstructions", e.target.value)} /></label><div className="form-actions field-wide"><span>{demo ? "Demo uses deterministic fixtures and no credits." : "Live mode calls OpenAI and may take several minutes."}</span><button className="primary-button" type="submit">{initial ? "Save and continue" : "Generate reel plan"}<ArrowRight size={18} /></button></div></form></div>;
}

function ScriptEditor({ project, onSave, onRegenerate, onNext }: { project: Project; onSave: (patch: Partial<Project>, message?: string) => Promise<Project | null>; onRegenerate: (section: string) => void; onNext: () => void }) {
  const [script, setScript] = useState<Script>(project.script ?? { hook: "", mainPoints: [""], outro: "", callToAction: "", estimatedDuration: project.duration });
  const updatePoint = (index: number, value: string) => setScript((current) => ({ ...current, mainPoints: current.mainPoints.map((point, i) => i === index ? value : point) }));
  return <div className="page editor-page"><div className="editor-heading"><div><p className="eyebrow">02 — SCRIPT</p><h1>Make every second count.</h1></div><div className="duration-meter"><span>Estimated voice</span><strong>{script.estimatedDuration}s</strong></div></div><div className="editor-layout"><div className="script-stack"><ScriptBlock label="Hook" value={script.hook} onChange={(value) => setScript({ ...script, hook: value })} onRegenerate={() => onRegenerate("hook")} /><section className="edit-card"><div className="edit-card-head"><span>Main points</span><button onClick={() => setScript({ ...script, mainPoints: [...script.mainPoints, ""] })}><Plus size={15} /> Add</button></div>{script.mainPoints.map((point, index) => <div className="point-row" key={index}><span>{String(index + 1).padStart(2, "0")}</span><textarea value={point} onChange={(e) => updatePoint(index, e.target.value)} /><button onClick={() => setScript({ ...script, mainPoints: script.mainPoints.filter((_, i) => i !== index) })} aria-label="Remove point"><X size={15} /></button></div>)}</section><ScriptBlock label="Outro" value={script.outro} onChange={(value) => setScript({ ...script, outro: value })} onRegenerate={() => onRegenerate("outro")} /><ScriptBlock label="Call to action" value={script.callToAction} onChange={(value) => setScript({ ...script, callToAction: value })} onRegenerate={() => onRegenerate("callToAction")} /></div><aside className="editor-note"><Sparkles size={19} /><strong>Read it aloud</strong><p>Short sentences and deliberate pauses make animated captions easier to follow.</p></aside></div><div className="sticky-actions"><button className="secondary-button" onClick={() => void onSave({ script }, "Script saved.")}>Save changes</button><button className="primary-button" onClick={async () => { await onSave({ script }); onNext(); }}>Build storyboard <ArrowRight size={17} /></button></div></div>;
}

function ScriptBlock({ label, value, onChange, onRegenerate }: { label: string; value: string; onChange: (value: string) => void; onRegenerate: () => void }) { return <section className="edit-card"><div className="edit-card-head"><span>{label}</span><button onClick={onRegenerate}><RefreshCw size={14} /> Regenerate</button></div><textarea value={value} onChange={(e) => onChange(e.target.value)} /></section>; }

function StoryboardEditor({ project, demo, onSave, onRegenerate, onNext }: { project: Project; demo: boolean; onSave: (patch: Partial<Project>, message?: string) => Promise<Project | null>; onRegenerate: (sceneId: string) => void; onNext: () => void }) {
  const [scenes, setScenes] = useState<Scene[]>(project.storyboard?.scenes ?? []);
  const update = (index: number, patch: Partial<Scene>) => setScenes((items) => items.map((scene, i) => i === index ? { ...scene, ...patch } : scene));
  const move = (index: number, delta: number) => setScenes((items) => { const next = [...items]; const target = index + delta; if (target < 0 || target >= next.length) return items; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const add = () => setScenes((items) => [...items, { id: `scene-${Date.now()}`, narration: "New narration", caption: "New caption", visualPrompt: "Describe the visual", duration: 3 }]);
  return (
    <div className="page storyboard-page">
      <div className="editor-heading">
        <div><p className="eyebrow">03 — STORYBOARD</p><h1>Shape the visual rhythm.</h1></div>
        <button className="secondary-button" onClick={add}><Plus size={16} /> Add scene</button>
      </div>
      <div className="scene-list">
        {scenes.map((scene, index) => (
          <article className="scene-card" key={scene.id}>
            <div className={`scene-visual cover-${index % 4}`}>
              {scene.imageUrl ? <img src={scene.imageUrl} alt="Generated scene" /> : <span>{String(index + 1).padStart(2, "0")}</span>}
              <button onClick={() => onRegenerate(scene.id)} title={demo ? "Show deterministic demo artwork" : "Regenerate with live generation"}><RefreshCw size={15} /> image</button>
            </div>
            <div className="scene-fields">
              <label><span>Narration</span><textarea value={scene.narration} onChange={(e) => update(index, { narration: e.target.value })} /></label>
              <div className="scene-two">
                <label><span>On-screen caption</span><input value={scene.caption} onChange={(e) => update(index, { caption: e.target.value })} /></label>
                <label><span>Duration</span><input type="number" min={1} max={20} step={0.5} value={scene.duration} onChange={(e) => update(index, { duration: Number(e.target.value) })} /></label>
              </div>
              <label><span>Visual prompt</span><textarea value={scene.visualPrompt} onChange={(e) => update(index, { visualPrompt: e.target.value })} /></label>
            </div>
            <div className="scene-actions">
              <button disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move scene up"><ChevronUp size={17} /></button>
              <button disabled={index === scenes.length - 1} onClick={() => move(index, 1)} aria-label="Move scene down"><ChevronDown size={17} /></button>
              <button onClick={() => setScenes((items) => items.filter((_, i) => i !== index))} aria-label="Remove scene"><Trash2 size={16} /></button>
            </div>
          </article>
        ))}
      </div>
      <div className="sticky-actions">
        <span>{scenes.length} scenes · {scenes.reduce((sum, scene) => sum + Number(scene.duration), 0).toFixed(1)} seconds</span>
        <button className="secondary-button" onClick={() => void onSave({ storyboard: { scenes } }, "Storyboard saved.")}>Save changes</button>
        <button className="primary-button" onClick={async () => { await onSave({ storyboard: { scenes } }); onNext(); }}>Preview reel <ArrowRight size={17} /></button>
      </div>
    </div>
  );
}

function Preview({ project, onRender }: { project: Project; onRender: () => void }) {
  const scenes = useMemo(() => project.storyboard?.scenes ?? [], [project.storyboard]);
  const voiceUrl = project.assets.find((asset) => asset.kind === "voice" && asset.status === "ready")?.url;
  const props: ReelFlowVideoProps = useMemo(() => ({ title: project.topic, scenes, voiceUrl }), [project.topic, scenes, voiceUrl]);
  const exportJson = () => { const blob = new Blob([JSON.stringify({ script: project.script, storyboard: project.storyboard }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${project.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reelflow"}.json`; link.click(); URL.revokeObjectURL(url); };
  return <div className="page preview-page"><div className="editor-heading"><div><p className="eyebrow">04 — PREVIEW & EXPORT</p><h1>Ready for the feed.</h1><p>Review the motion, timing and captions before the final render.</p></div><StatusPill status={project.status} /></div><div className="preview-layout"><div className="phone-stage"><div className="phone-frame">{scenes.length ? <Player component={ReelFlowVideo} inputProps={props} durationInFrames={totalFrames(scenes)} compositionWidth={1080} compositionHeight={1920} fps={30} controls style={{ width: "100%", aspectRatio: "9 / 16" }} /> : <div className="empty">No scenes yet</div>}</div></div><aside className="export-panel"><p className="eyebrow">EXPORT SETTINGS</p><h2>Vertical master</h2><div className="export-spec"><div><span>Resolution</span><strong>1080 × 1920</strong></div><div><span>Frame rate</span><strong>30 FPS</strong></div><div><span>Format</span><strong>MP4 · H.264</strong></div><div><span>Duration</span><strong>{project.duration}s</strong></div></div>{project.error && <div className="inline-warning">{project.error}</div>}{project.renderJob?.status === "rendering" && <div className="progress"><span style={{ width: `${project.renderJob.progress}%` }} /></div>}{project.renderJob?.outputUrl ? <a className="primary-button download-button" href={project.renderJob.outputUrl} download><Download size={18} /> Download MP4</a> : <button className="primary-button download-button" onClick={onRender}><Film size={18} /> Render MP4</button>}<button className="secondary-button download-button" onClick={exportJson}><FileJson size={17} /> Export script + captions JSON</button><p className="export-note">Rendering happens locally with Remotion. Demo previews use deterministic visual fixtures; live mode adds generated imagery and narration.</p></aside></div></div>;
}
