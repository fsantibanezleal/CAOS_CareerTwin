import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Check, CircleUserRound, Code2, FileStack, FileUp, GitBranch, GraduationCap, Network, Plus, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, json } from '../api'
import { CareerRiver, EvidenceMatrix, ProfileConstellation } from '../components/Visualizations'
import { EmptyState, ErrorState, Loading, PageHeader, Panel } from '../components/Primitives'
import type { Artifact, Claim, Education, Experience, Profile, ProfileGraphData, Skill } from '../types'

type ProfileTab = 'overview' | 'evidence' | 'graph' | 'river' | 'github' | 'artifacts'

function ProfileEditor({ profile }: { profile: Profile }) {
  const client = useQueryClient()
  const [draft, setDraft] = useState(profile)
  const save = useMutation({ mutationFn: () => api<Profile>('/api/profile', json('PUT', draft)), onSuccess: (value) => { client.setQueryData(['profile'], value); setDraft(value) } })
  const field = (key: keyof Profile, value: string | number) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <form className="profile-editor" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <div className="form-grid two"><label>Professional headline<input value={draft.headline} onChange={(event) => field('headline', event.target.value)} placeholder="The work you do and the value you create" /></label><label>Location<input value={draft.location} onChange={(event) => field('location', event.target.value)} placeholder="City, country or remote" /></label></div>
      <label>Professional narrative<textarea rows={6} value={draft.summary} onChange={(event) => field('summary', event.target.value)} placeholder="A concise, evidence-grounded professional story" /></label>
      <div className="form-grid three"><label>Seniority<input value={draft.seniority} onChange={(event) => field('seniority', event.target.value)} placeholder="Senior, lead, principal…" /></label><label>Years of experience<input type="number" min="0" max="80" step="0.5" value={draft.years_experience} onChange={(event) => field('years_experience', Number(event.target.value))} /></label><label>Availability<input value={draft.availability} onChange={(event) => field('availability', event.target.value)} placeholder="Immediate, 30 days…" /></label></div>
      {save.error && <ErrorState error={save.error} />}
      <div className="form-actions"><span>Revision {draft.revision} · conflicts are never overwritten</span><button className="button primary" disabled={save.isPending}><Check /> Save profile</button></div>
    </form>
  )
}

function SkillsPanel({ skills, claims }: { skills: Skill[]; claims: Claim[] }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('technical')
  const [level, setLevel] = useState(0.5)
  const confirmed = claims.filter((claim) => claim.state === 'confirmed')
  const [evidence, setEvidence] = useState<string[]>([])
  const add = useMutation({ mutationFn: () => api('/api/profile/skills', json('POST', { name, category, level, years: 0, confidence: evidence.length ? 0.8 : 0.5, evidence_ids: evidence })), onSuccess: () => { setName(''); setEvidence([]); setOpen(false); client.invalidateQueries({ queryKey: ['skills'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }) } })
  const remove = useMutation({ mutationFn: (id: string) => api(`/api/profile/skills/${id}`, { method: 'DELETE' }), onSuccess: () => { client.invalidateQueries({ queryKey: ['skills'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }) } })
  return (
    <Panel title="Capability map" subtitle="Skills are stronger when they point to confirmed evidence" actions={<button className="button secondary" onClick={() => setOpen(!open)}><Plus /> Add skill</button>}>
      {open && <form className="inline-editor" onSubmit={(event) => { event.preventDefault(); add.mutate() }}><div className="form-grid three"><label>Skill<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>technical</option><option>domain</option><option>leadership</option><option>language</option><option>tool</option></select></label><label>Level <span>{Math.round(level * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label></div><label>Link confirmed evidence<select multiple value={evidence} onChange={(event) => setEvidence(Array.from(event.target.selectedOptions, (option) => option.value))}>{confirmed.map((claim) => <option key={claim.id} value={claim.id}>{claim.statement.slice(0, 100)}</option>)}</select></label>{add.error && <ErrorState error={add.error} />}<div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button><button className="button primary">Add to profile</button></div></form>}
      {skills.length ? <div className="skill-cloud">{skills.map((skill) => <article key={skill.id}><div className="skill-ring" style={{ '--progress': `${skill.level * 360}deg` } as React.CSSProperties}><span>{Math.round(skill.level * 100)}</span></div><div><b>{skill.name}</b><small>{skill.category} · {skill.years} years</small><span>{skill.evidence_count ? `${skill.evidence_count} evidence links` : 'Unlinked — add evidence'}</span></div><button onClick={() => remove.mutate(skill.id)} aria-label={`Remove ${skill.name}`}><X /></button></article>)}</div> : <EmptyState title="No curated skills yet" description="Add a skill manually or review claims extracted from your documents and GitHub portfolio." />}
    </Panel>
  )
}

function EvidenceInbox({ claims }: { claims: Claim[] }) {
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => api(`/api/profile/claims/${id}/decision`, json('POST', { decision, note: 'Reviewed in evidence inbox' })), onSuccess: () => { client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  const upload = useMutation({ mutationFn: (file: File) => { const form = new FormData(); form.append('file', file); form.append('label', file.name); return api('/api/profile/sources/upload', { method: 'POST', body: form }) }, onSuccess: () => { client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['sources'] }) } })
  const proposed = claims.filter((claim) => claim.state === 'proposed')
  return (
    <Panel title="Evidence inbox" subtitle="Documents propose atomic claims; nothing becomes canonical until you decide" actions={<><input ref={fileRef} hidden type="file" accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button className="button primary" onClick={() => fileRef.current?.click()}><FileUp /> Add CV or document</button></>}>
      {(upload.error || decide.error) && <ErrorState error={upload.error || decide.error} />}
      {proposed.length ? <div className="review-stack">{proposed.map((claim) => <article key={claim.id}><div className="claim-icon"><Sparkles /></div><div><span className="status-badge proposed">Proposed · {Math.round(claim.confidence * 100)}% extraction confidence</span><h3>{claim.statement}</h3><small>{claim.claim_type} · source locator preserved</small></div><div className="review-actions"><button className="button ghost danger" onClick={() => decide.mutate({ id: claim.id, decision: 'rejected' })}><X /> Reject</button><button className="button secondary" onClick={() => decide.mutate({ id: claim.id, decision: 'confirmed' })}><Check /> Confirm</button></div></article>)}</div> : <EmptyState title="No proposals waiting" description="Upload a résumé, CV, certificate, portfolio note, or screenshot. The extractor will stage reviewable claims here." />}
      <details className="evidence-history"><summary>Decision history ({claims.length - proposed.length})</summary>{claims.filter((claim) => claim.state !== 'proposed').map((claim) => <div key={claim.id}><span className={`status-badge ${claim.state}`}>{claim.state}</span><p>{claim.statement}</p></div>)}</details>
    </Panel>
  )
}

function TimelineEditors({ experiences, education }: { experiences: Experience[]; education: Education[] }) {
  const client = useQueryClient()
  const [mode, setMode] = useState<'experience' | 'education'>('experience')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [start, setStart] = useState('')
  const add = useMutation({ mutationFn: () => mode === 'experience' ? api('/api/profile/experiences', json('POST', { organization, role, start_date: start, current: true, summary: '', achievements: [], skills: [] })) : api('/api/profile/education', json('POST', { institution: organization, credential: role, field: '', start_date: start, details: '' })), onSuccess: () => { setOrganization(''); setRole(''); setStart(''); client.invalidateQueries({ queryKey: [mode === 'experience' ? 'experiences' : 'education'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }) } })
  return (
    <Panel title="Experience and education" subtitle="Curate the chronology behind the career river">
      <form className="timeline-add" onSubmit={(event) => { event.preventDefault(); add.mutate() }}><select value={mode} onChange={(event) => setMode(event.target.value as 'experience' | 'education')}><option value="experience">Experience</option><option value="education">Education</option></select><input placeholder={mode === 'experience' ? 'Organization' : 'Institution'} value={organization} onChange={(event) => setOrganization(event.target.value)} required /><input placeholder={mode === 'experience' ? 'Role' : 'Credential'} value={role} onChange={(event) => setRole(event.target.value)} required /><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /><button className="button secondary"><Plus /> Add</button></form>
      {add.error && <ErrorState error={add.error} />}
      <div className="mini-timeline">{[...experiences.map((item) => ({ id: item.id, date: item.start_date, title: item.role, detail: item.organization, kind: 'experience' })), ...education.map((item) => ({ id: item.id, date: item.start_date, title: item.credential, detail: item.institution, kind: 'education' }))].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article key={`${item.kind}-${item.id}`}><span>{item.kind === 'experience' ? <Code2 /> : <GraduationCap />}</span><div><small>{item.date || 'Date not set'}</small><b>{item.title}</b><p>{item.detail}</p></div></article>)}</div>
    </Panel>
  )
}

function GithubImporter() {
  const client = useQueryClient()
  const [token, setToken] = useState('')
  const [repos, setRepos] = useState('')
  const snapshot = useMutation({ mutationFn: () => api<{ login: string; repositories: Array<Record<string, unknown>>; proposed_claims: Claim[] }>('/api/connectors/github/snapshot', json('POST', { token, repositories: repos.split(/[\s,]+/).filter(Boolean) })), onSuccess: () => { setToken(''); client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['sources'] }) } })
  return (
    <Panel title="GitHub portfolio review" subtitle="Read-only, bounded evidence capture with no token persistence">
      <div className="connector-hero"><span><GitBranch /></span><div><h3>Turn repository work into reviewable evidence</h3><p>CareerTwin inspects up to 50 selected repositories, language distributions, release signals, repository ownership, forks, and archived status. It never stores your token.</p></div></div>
      <form className="connector-form" onSubmit={(event) => { event.preventDefault(); snapshot.mutate() }}><label>Fine-grained read-only personal access token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required minLength={20} /><small>Sent once in the encrypted POST body, used only in memory, never logged or persisted.</small></label><label>Optional repository allowlist<input value={repos} onChange={(event) => setRepos(event.target.value)} placeholder="owner/repo, owner/another-repo" /><small>Leave blank to inspect your most recently updated repositories.</small></label>{snapshot.error && <ErrorState error={snapshot.error} />}<button className="button primary" disabled={snapshot.isPending}><ShieldCheck /> {snapshot.isPending ? 'Inspecting safely…' : 'Create review snapshot'}</button></form>
      {snapshot.data && <div className="connector-result"><Check /><div><b>@{snapshot.data.login} snapshot captured</b><p>{snapshot.data.repositories.length} repositories · {snapshot.data.proposed_claims.length} claims sent to the evidence inbox</p></div></div>}
    </Panel>
  )
}

function ArtifactStudio({ claims }: { claims: Claim[] }) {
  const client = useQueryClient()
  const artifacts = useQuery({ queryKey: ['artifacts'], queryFn: () => api<Artifact[]>('/api/artifacts') })
  const [kind, setKind] = useState<Artifact['kind']>('resume')
  const [title, setTitle] = useState('Evidence-grounded résumé')
  const create = useMutation({ mutationFn: () => api('/api/artifacts', json('POST', { kind, title, evidence_ids: claims.filter((claim) => claim.state === 'confirmed').map((claim) => claim.id) })), onSuccess: () => client.invalidateQueries({ queryKey: ['artifacts'] }) })
  return (
    <Panel title="Artifact studio" subtitle="Versioned drafts assembled only from confirmed evidence">
      <form className="artifact-compose" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><select value={kind} onChange={(event) => setKind(event.target.value as Artifact['kind'])}><option value="resume">Résumé</option><option value="cover_letter">Cover letter</option><option value="interview_brief">Interview brief</option><option value="follow_up">Follow-up</option></select><input value={title} onChange={(event) => setTitle(event.target.value)} required /><button className="button primary"><FileStack /> Compose draft</button></form>
      {create.error && <ErrorState error={create.error} />}
      {artifacts.data?.length ? <div className="artifact-grid">{artifacts.data.map((artifact) => <article key={artifact.id}><span className="status-badge">{artifact.kind.replace('_', ' ')}</span><h3>{artifact.title}</h3><small>Version {artifact.version} · {artifact.evidence_ids.length} evidence citations</small><pre>{artifact.content.slice(0, 700)}</pre></article>)}</div> : <EmptyState title="No career artifacts yet" description="Compose a résumé, cover letter, interview brief, or follow-up grounded in your confirmed evidence." />}
    </Panel>
  )
}

export function ProfilePage() {
  const [tab, setTab] = useState<ProfileTab>('overview')
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile') })
  const skills = useQuery({ queryKey: ['skills'], queryFn: () => api<Skill[]>('/api/profile/skills') })
  const claims = useQuery({ queryKey: ['claims'], queryFn: () => api<Claim[]>('/api/profile/claims') })
  const graph = useQuery({ queryKey: ['profile-graph'], queryFn: () => api<ProfileGraphData>('/api/profile/graph') })
  const experiences = useQuery({ queryKey: ['experiences'], queryFn: () => api<Experience[]>('/api/profile/experiences') })
  const education = useQuery({ queryKey: ['education'], queryFn: () => api<Education[]>('/api/profile/education') })
  if (profile.isPending || skills.isPending || claims.isPending || graph.isPending || experiences.isPending || education.isPending) return <Loading label="Mapping your professional twin" />
  const error = profile.error || skills.error || claims.error || graph.error || experiences.error || education.error
  if (error) return <ErrorState error={error} />
  const pending = claims.data.filter((claim) => claim.state === 'proposed').length
  const tabs: Array<[ProfileTab, string, React.ReactNode]> = [['overview', 'Overview', <CircleUserRound />], ['evidence', `Evidence${pending ? ` (${pending})` : ''}`, <BookOpenCheck />], ['graph', 'Constellation', <Network />], ['river', 'Career river', <Sparkles />], ['github', 'GitHub', <GitBranch />], ['artifacts', 'Artifacts', <FileStack />]]
  return (
    <>
      <PageHeader eyebrow="Your professional twin" title={profile.data.headline || 'Build a profile that can show its work.'} description="Curate your story, trace claims to their sources, and inspect capability without confusing missing evidence for weakness." />
      <nav className="section-tabs" aria-label="Profile views">{tabs.map(([key, label, icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{icon}{label}</button>)}</nav>
      {tab === 'overview' && <div className="profile-layout"><Panel title="Identity and direction" subtitle="User-curated canonical fields"><ProfileEditor profile={profile.data} /></Panel><SkillsPanel skills={skills.data} claims={claims.data} /><TimelineEditors experiences={experiences.data} education={education.data} /></div>}
      {tab === 'evidence' && <EvidenceInbox claims={claims.data} />}
      {tab === 'graph' && <Panel title="Professional constellation" subtitle="Every edge is inspectable; confirmed evidence anchors capability"><ProfileConstellation data={graph.data.graph} /></Panel>}
      {tab === 'river' && <div className="profile-layout"><Panel title="Career river" subtitle="Experience and education unfolding across time"><CareerRiver rows={graph.data.river} /></Panel><Panel title="Evidence matrix" subtitle="Capability level and source coverage side by side"><EvidenceMatrix rows={graph.data.matrix} /></Panel></div>}
      {tab === 'github' && <GithubImporter />}
      {tab === 'artifacts' && <ArtifactStudio claims={claims.data} />}
    </>
  )
}
