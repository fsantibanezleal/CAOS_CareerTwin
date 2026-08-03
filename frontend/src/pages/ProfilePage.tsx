import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Check, CircleUserRound, Code2, Download, FileStack, FileUp, GitBranch, GraduationCap, Network, Plus, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { api, json } from '../api'
import { CareerRiver, EvidenceMatrix, ProfileConstellation } from '../components/Visualizations'
import { EmptyState, ErrorState, Loading, PageHeader, Panel } from '../components/Primitives'
import { useI18n } from '../i18n'
import type { Accomplishment, Artifact, Claim, Education, Experience, Opportunity, Profile, ProfileGraphData, ResumeVariant, Skill, Source } from '../types'

type ProfileTab = 'overview' | 'evidence' | 'graph' | 'river' | 'github' | 'artifacts'

function ProfileEditor({ profile }: { profile: Profile }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [draft, setDraft] = useState(profile)
  const save = useMutation({ mutationFn: () => api<Profile>('/api/profile', json('PUT', draft)), onSuccess: (value) => { client.setQueryData(['profile'], value); setDraft(value) } })
  const field = (key: keyof Profile, value: string | number) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <form className="profile-editor" onSubmit={(event) => { event.preventDefault(); save.mutate() }}>
      <div className="form-grid two"><label>{t('Professional headline')}<input value={draft.headline} onChange={(event) => field('headline', event.target.value)} placeholder={t('The work you do and the value you create')} /></label><label>{t('Location')}<input value={draft.location} onChange={(event) => field('location', event.target.value)} placeholder={t('City, country or remote')} /></label></div>
      <label>{t('Professional narrative')}<textarea rows={6} value={draft.summary} onChange={(event) => field('summary', event.target.value)} placeholder={t('A concise, evidence-grounded professional story')} /></label>
      <div className="form-grid three"><label>{t('Seniority')}<input value={draft.seniority} onChange={(event) => field('seniority', event.target.value)} placeholder={t('Senior, lead, principal…')} /></label><label>{t('Years of experience')}<input type="number" min="0" max="80" step="0.5" value={draft.years_experience} onChange={(event) => field('years_experience', Number(event.target.value))} /></label><label>{t('Availability')}<input value={draft.availability} onChange={(event) => field('availability', event.target.value)} placeholder={t('Immediate, 30 days…')} /></label></div>
      {save.error && <ErrorState error={save.error} />}
      <div className="form-actions"><span>{t('Revision {revision} · conflicts are never overwritten', { revision: draft.revision })}</span><button className="button primary" disabled={save.isPending}><Check /> {t('Save profile')}</button></div>
    </form>
  )
}

function SkillsPanel({ skills, claims }: { skills: Skill[]; claims: Claim[] }) {
  const { plural, t } = useI18n()
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
    <Panel title={t('Capability map')} subtitle={t('Skills are stronger when they point to confirmed evidence')} actions={<button className="button secondary" onClick={() => setOpen(!open)}><Plus /> {t('Add skill')}</button>}>
      {open && <form className="inline-editor" onSubmit={(event) => { event.preventDefault(); add.mutate() }}><div className="form-grid three"><label>{t('Skill')}<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>{t('Category')}<select value={category} onChange={(event) => setCategory(event.target.value)}>{['technical', 'domain', 'leadership', 'language', 'tool'].map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label><label>{t('Level')} <span>{Math.round(level * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={level} onChange={(event) => setLevel(Number(event.target.value))} /></label></div><label>{t('Link confirmed evidence')}<select multiple value={evidence} onChange={(event) => setEvidence(Array.from(event.target.selectedOptions, (option) => option.value))}>{confirmed.map((claim) => <option key={claim.id} value={claim.id}>{claim.statement.slice(0, 100)}</option>)}</select></label>{add.error && <ErrorState error={add.error} />}<div className="form-actions"><button type="button" className="button ghost" onClick={() => setOpen(false)}>{t('Cancel')}</button><button className="button primary">{t('Add to profile')}</button></div></form>}
      {skills.length ? <div className="skill-cloud">{skills.map((skill) => <article key={skill.id}><div className="skill-ring" style={{ '--progress': `${skill.level * 360}deg` } as React.CSSProperties}><span>{Math.round(skill.level * 100)}</span></div><div><b>{skill.name}</b><small>{t(skill.category)} · {plural(skill.years, '{count} year', '{count} years')}</small><span>{skill.evidence_count ? plural(skill.evidence_count, '{count} evidence link', '{count} evidence links') : t('Unlinked — add evidence')}</span></div><button onClick={() => remove.mutate(skill.id)} aria-label={t('Remove {name}', { name: skill.name })}><X /></button></article>)}</div> : <EmptyState title={t('No curated skills yet')} description={t('Add a skill manually or review claims extracted from your documents and GitHub portfolio.')} />}
    </Panel>
  )
}

function EvidenceInbox({ claims }: { claims: Claim[] }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => api<Source[]>('/api/profile/sources'), refetchInterval: (query) => (query.state.data as Source[] | undefined)?.some((item) => ['pending', 'processing'].includes(item.status)) ? 1000 : false })
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: string }) => api(`/api/profile/claims/${id}/decision`, json('POST', { decision, note: 'Reviewed in evidence inbox' })), onSuccess: () => { client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }); client.invalidateQueries({ queryKey: ['today'] }) } })
  const upload = useMutation({ mutationFn: (file: File) => { const form = new FormData(); form.append('file', file); form.append('label', file.name); return api('/api/profile/sources/upload', { method: 'POST', body: form }) }, onSuccess: () => { client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['sources'] }) } })
  const retry = useMutation({ mutationFn: (id: string) => api(`/api/profile/sources/${id}/retry`, { method: 'POST' }), onSuccess: () => client.invalidateQueries({ queryKey: ['sources'] }) })
  const proposed = claims.filter((claim) => claim.state === 'proposed')
  return (
    <Panel title={t('Evidence inbox')} subtitle={t('Documents propose atomic claims; nothing becomes canonical until you decide')} actions={<><input ref={fileRef} hidden type="file" accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button className="button primary" onClick={() => fileRef.current?.click()}><FileUp /> {t('Add CV or document')}</button></>}>
      {(upload.error || decide.error || retry.error || sources.error) && <ErrorState error={upload.error || decide.error || retry.error || sources.error} />}
      {!!sources.data?.length && <div className="source-jobs">{sources.data.map((source) => <article key={source.id}><div><b>{source.label}</b><small>{t(source.kind)} · {t(source.status)}{source.error && ` · ${source.error}`}</small></div>{['pending', 'processing'].includes(source.status) && <span className="status-badge proposed">{t('Extracting…')}</span>}{source.status === 'ready' && <span className="status-badge confirmed"><Check /> {t('Ready')}</span>}{source.status === 'failed' && <button className="button secondary" onClick={() => retry.mutate(source.id)}>{t('Retry extraction')}</button>}</article>)}</div>}
      {proposed.length ? <div className="review-stack">{proposed.map((claim) => <article key={claim.id}><div className="claim-icon"><Sparkles /></div><div><span className="status-badge proposed">{t('Proposed · {count}% extraction confidence', { count: Math.round(claim.confidence * 100) })}</span><h3>{claim.statement}</h3><small>{t('{type} · source locator preserved', { type: t(claim.claim_type) })}</small></div><div className="review-actions"><button className="button ghost danger" onClick={() => decide.mutate({ id: claim.id, decision: 'rejected' })}><X /> {t('Reject')}</button><button className="button secondary" onClick={() => decide.mutate({ id: claim.id, decision: 'confirmed' })}><Check /> {t('Confirm')}</button></div></article>)}</div> : <EmptyState title={t('No proposals waiting')} description={t('Upload a résumé, CV, certificate, portfolio note, or screenshot. The extractor will stage reviewable claims here.')} />}
      <details className="evidence-history"><summary>{t('Decision history ({count})', { count: claims.length - proposed.length })}</summary>{claims.filter((claim) => claim.state !== 'proposed').map((claim) => <div key={claim.id}><span className={`status-badge ${claim.state}`}>{t(claim.state)}</span><p>{claim.statement}</p></div>)}</details>
    </Panel>
  )
}

function TimelineEditors({ experiences, education }: { experiences: Experience[]; education: Education[] }) {
  const { t } = useI18n()
  const client = useQueryClient()
  const [mode, setMode] = useState<'experience' | 'education'>('experience')
  const [organization, setOrganization] = useState('')
  const [role, setRole] = useState('')
  const [start, setStart] = useState('')
  const add = useMutation({ mutationFn: () => mode === 'experience' ? api('/api/profile/experiences', json('POST', { organization, role, start_date: start, current: true, summary: '', achievements: [], skills: [] })) : api('/api/profile/education', json('POST', { institution: organization, credential: role, field: '', start_date: start, details: '' })), onSuccess: () => { setOrganization(''); setRole(''); setStart(''); client.invalidateQueries({ queryKey: [mode === 'experience' ? 'experiences' : 'education'] }); client.invalidateQueries({ queryKey: ['profile-graph'] }) } })
  return (
    <Panel title={t('Experience and education')} subtitle={t('Curate the chronology behind the career river')}>
      <form className="timeline-add" onSubmit={(event) => { event.preventDefault(); add.mutate() }}><select value={mode} onChange={(event) => setMode(event.target.value as 'experience' | 'education')}><option value="experience">{t('Experience')}</option><option value="education">{t('Education')}</option></select><input placeholder={t(mode === 'experience' ? 'Organization' : 'Institution')} value={organization} onChange={(event) => setOrganization(event.target.value)} required /><input placeholder={t(mode === 'experience' ? 'Role' : 'Credential')} value={role} onChange={(event) => setRole(event.target.value)} required /><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /><button className="button secondary"><Plus /> {t('Add')}</button></form>
      {add.error && <ErrorState error={add.error} />}
      <div className="mini-timeline">{[...experiences.map((item) => ({ id: item.id, date: item.start_date, title: item.role, detail: item.organization, kind: 'experience' })), ...education.map((item) => ({ id: item.id, date: item.start_date, title: item.credential, detail: item.institution, kind: 'education' }))].sort((a, b) => b.date.localeCompare(a.date)).map((item) => <article key={`${item.kind}-${item.id}`}><span>{item.kind === 'experience' ? <Code2 /> : <GraduationCap />}</span><div><small>{item.date || t('Date not set')}</small><b>{item.title}</b><p>{item.detail}</p></div></article>)}</div>
    </Panel>
  )
}

function GithubImporter() {
  const { t } = useI18n()
  const client = useQueryClient()
  const [token, setToken] = useState('')
  const [repos, setRepos] = useState('')
  const snapshot = useMutation({ mutationFn: () => api<{ login: string; repositories: Array<Record<string, unknown>>; proposed_claims: Claim[] }>('/api/connectors/github/snapshot', json('POST', { token, repositories: repos.split(/[\s,]+/).filter(Boolean) })), onSuccess: () => { setToken(''); client.invalidateQueries({ queryKey: ['claims'] }); client.invalidateQueries({ queryKey: ['sources'] }) } })
  return (
    <Panel title={t('GitHub portfolio review')} subtitle={t('Read-only, bounded evidence capture with no token persistence')}>
      <div className="connector-hero"><span><GitBranch /></span><div><h3>{t('Turn repository work into reviewable evidence')}</h3><p>{t('CareerTwin inspects up to 50 selected repositories, language distributions, release signals, repository ownership, forks, and archived status. It never stores your token.')}</p></div></div>
      <form className="connector-form" onSubmit={(event) => { event.preventDefault(); snapshot.mutate() }}><label>{t('Fine-grained read-only personal access token')}<input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" required minLength={20} /><small>{t('Sent once in the encrypted POST body, used only in memory, never logged or persisted.')}</small></label><label>{t('Optional repository allowlist')}<input value={repos} onChange={(event) => setRepos(event.target.value)} placeholder="owner/repo, owner/another-repo" /><small>{t('Leave blank to inspect your most recently updated repositories.')}</small></label>{snapshot.error && <ErrorState error={snapshot.error} />}<button className="button primary" disabled={snapshot.isPending}><ShieldCheck /> {t(snapshot.isPending ? 'Inspecting safely…' : 'Create review snapshot')}</button></form>
      {snapshot.data && <div className="connector-result"><Check /><div><b>{t('@{login} snapshot captured', { login: snapshot.data.login })}</b><p>{t('{repositories} repositories · {claims} claims sent to the evidence inbox', { repositories: snapshot.data.repositories.length, claims: snapshot.data.proposed_claims.length })}</p></div></div>}
    </Panel>
  )
}

function AccomplishmentBank({ claims }: { claims: Claim[] }) {
  const { plural, t } = useI18n()
  const client = useQueryClient()
  const accomplishments = useQuery({ queryKey: ['accomplishments'], queryFn: () => api<Accomplishment[]>('/api/artifacts/accomplishments') })
  const [title, setTitle] = useState('')
  const [situation, setSituation] = useState('')
  const [task, setTask] = useState('')
  const [action, setAction] = useState('')
  const [result, setResult] = useState('')
  const [skills, setSkills] = useState('')
  const [evidenceIds, setEvidenceIds] = useState<string[]>([])
  const confirmed = claims.filter((claim) => claim.state === 'confirmed')
  const create = useMutation({
    mutationFn: () => api<Accomplishment>('/api/artifacts/accomplishments', json('POST', {
      title,
      situation,
      task,
      action,
      result,
      skills: skills.split(',').map((value) => value.trim()).filter(Boolean),
      evidence_ids: evidenceIds,
      metrics: [],
      status: evidenceIds.length ? 'confirmed' : 'draft',
    })),
    onSuccess: () => {
      setTitle(''); setSituation(''); setTask(''); setAction(''); setResult(''); setSkills(''); setEvidenceIds([])
      client.invalidateQueries({ queryKey: ['accomplishments'] })
    },
  })
  const remove = useMutation({ mutationFn: (id: string) => api(`/api/artifacts/accomplishments/${id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['accomplishments'] }) })
  return (
    <Panel title={t('Accomplishment bank')} subtitle={t('Reusable STAR stories remain linked to confirmed evidence')}>
      <form className="inline-editor" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <div className="form-grid two"><label>{t('Story title')}<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>{t('Skills, comma separated')}<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label></div>
        <div className="form-grid two"><label>{t('Situation')}<textarea rows={3} value={situation} onChange={(event) => setSituation(event.target.value)} /></label><label>{t('Task')}<textarea rows={3} value={task} onChange={(event) => setTask(event.target.value)} /></label><label>{t('Action')}<textarea rows={3} value={action} onChange={(event) => setAction(event.target.value)} /></label><label>{t('Result')}<textarea rows={3} value={result} onChange={(event) => setResult(event.target.value)} /></label></div>
        <label>{t('Supporting evidence')}<select multiple value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{confirmed.map((claim) => <option key={claim.id} value={claim.id}>{claim.statement.slice(0, 120)}</option>)}</select><small>{t('Stories without evidence remain drafts. Confirmed stories can be used in tailored resumes.')}</small></label>
        {create.error && <ErrorState error={create.error} />}
        <div className="form-actions"><button className="button secondary" disabled={create.isPending}><Plus /> {t('Save STAR story')}</button></div>
      </form>
      {accomplishments.isPending ? <Loading label={t('Loading accomplishment bank')} /> : accomplishments.error ? <ErrorState error={accomplishments.error} /> : accomplishments.data.length ? <div className="artifact-grid">{accomplishments.data.map((item) => <article key={item.id}><span className={`status-badge ${item.status === 'confirmed' ? 'confirmed' : ''}`}>{t(item.status)}</span><h3>{item.title}</h3><small>{item.skills.join(' · ') || t('No skill labels')} · {plural(item.evidence_ids.length, '{count} evidence link', '{count} evidence links')}</small><p><b>{t('Situation')}:</b> {item.situation || t('Not recorded')}</p><p><b>{t('Action')}:</b> {item.action || t('Not recorded')}</p><p><b>{t('Result')}:</b> {item.result || t('Not recorded')}</p><button className="button ghost danger" onClick={() => remove.mutate(item.id)}><X /> {t('Delete')}</button></article>)}</div> : <EmptyState title={t('No accomplishment stories yet')} description={t('Capture a concrete situation, task, action, and result, then anchor it to evidence.')} />}
    </Panel>
  )
}

function ResumeVariantStudio({ claims }: { claims: Claim[] }) {
  const { plural, t } = useI18n()
  const client = useQueryClient()
  const variants = useQuery({ queryKey: ['resume-variants'], queryFn: () => api<ResumeVariant[]>('/api/artifacts/resume-variants') })
  const accomplishments = useQuery({ queryKey: ['accomplishments'], queryFn: () => api<Accomplishment[]>('/api/artifacts/accomplishments') })
  const opportunities = useQuery({ queryKey: ['opportunities'], queryFn: () => api<Opportunity[]>('/api/opportunities') })
  const [name, setName] = useState('Core resume')
  const [summary, setSummary] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [accomplishmentIds, setAccomplishmentIds] = useState<string[]>([])
  const evidenceIds = claims.filter((claim) => claim.state === 'confirmed').map((claim) => claim.id)
  const create = useMutation({
    mutationFn: () => api<ResumeVariant>('/api/artifacts/resume-variants', json('POST', { name, summary, opportunity_id: opportunityId || null, section_order: ['summary', 'experience', 'accomplishments', 'skills', 'education'], evidence_ids: evidenceIds, accomplishment_ids: accomplishmentIds })),
    onSuccess: () => client.invalidateQueries({ queryKey: ['resume-variants'] }),
  })
  const confirmedStories = accomplishments.data?.filter((item) => item.status === 'confirmed') ?? []
  return (
    <Panel title={t('Tailored resume versions')} subtitle={t('Immutable versions composed from confirmed claims and accomplishment stories')}>
      <form className="inline-editor" onSubmit={(event) => { event.preventDefault(); create.mutate() }}>
        <div className="form-grid two"><label>{t('Resume family')}<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>{t('Target opportunity')}<select value={opportunityId} onChange={(event) => setOpportunityId(event.target.value)}><option value="">{t('General resume')}</option>{opportunities.data?.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.employer}</option>)}</select></label></div>
        <label>{t('Tailored summary')}<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder={t('A concise target-specific summary; unsupported claims will not be added automatically.')} /></label>
        <label>{t('Confirmed accomplishment stories')}<select multiple value={accomplishmentIds} onChange={(event) => setAccomplishmentIds(Array.from(event.target.selectedOptions, (option) => option.value))}>{confirmedStories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        {create.error && <ErrorState error={create.error} />}
        <div className="form-actions"><span>{t('{count} confirmed evidence items available', { count: evidenceIds.length })}</span><button className="button primary" disabled={create.isPending}><FileStack /> {t('Create immutable version')}</button></div>
      </form>
      {variants.isPending ? <Loading label={t('Loading resume versions')} /> : variants.error ? <ErrorState error={variants.error} /> : variants.data.length ? <div className="artifact-grid">{variants.data.map((variant) => <article key={variant.id}><span className="status-badge confirmed">{t('Version {version}', { version: variant.version })}</span><h3>{variant.name}</h3><small>{plural(variant.evidence_ids.length, '{count} evidence citation', '{count} evidence citations')} · {t('{count} STAR stories', { count: variant.accomplishment_ids.length })}</small><pre>{variant.content.slice(0, 900)}</pre></article>)}</div> : <EmptyState title={t('No tailored resume versions')} description={t('Create a general or opportunity-specific resume from reviewed professional evidence.')} />}
    </Panel>
  )
}

function ArtifactStudio({ claims }: { claims: Claim[] }) {
  const { plural, t } = useI18n()
  const client = useQueryClient()
  const artifacts = useQuery({ queryKey: ['artifacts'], queryFn: () => api<Artifact[]>('/api/artifacts') })
  const [kind, setKind] = useState<Artifact['kind']>('resume')
  const [title, setTitle] = useState('Evidence-grounded résumé')
  const create = useMutation({ mutationFn: () => api('/api/artifacts', json('POST', { kind, title, evidence_ids: claims.filter((claim) => claim.state === 'confirmed').map((claim) => claim.id) })), onSuccess: () => client.invalidateQueries({ queryKey: ['artifacts'] }) })
  return (
    <div className="profile-layout"><AccomplishmentBank claims={claims} /><ResumeVariantStudio claims={claims} /><Panel title={t('Communication artifact studio')} subtitle={t('Versioned drafts assembled only from confirmed evidence')}>
      <form className="artifact-compose" onSubmit={(event) => { event.preventDefault(); create.mutate() }}><select value={kind} onChange={(event) => setKind(event.target.value as Artifact['kind'])}><option value="resume">{t('Résumé')}</option><option value="cover_letter">{t('Cover letter')}</option><option value="interview_brief">{t('Interview brief')}</option><option value="follow_up">{t('Follow-up')}</option></select><input value={title} onChange={(event) => setTitle(event.target.value)} required /><button className="button primary"><FileStack /> {t('Compose draft')}</button></form>
      {create.error && <ErrorState error={create.error} />}
      {artifacts.data?.length ? <div className="artifact-grid">{artifacts.data.map((artifact) => <article key={artifact.id}><span className="status-badge">{t(artifact.kind.replace('_', ' '))}</span><h3>{artifact.title}</h3><small>{plural(artifact.evidence_ids.length, 'Version {version} · {count} evidence citation', 'Version {version} · {count} evidence citations', { version: artifact.version })}</small><pre>{artifact.content.slice(0, 700)}</pre></article>)}</div> : <EmptyState title={t('No career artifacts yet')} description={t('Compose a résumé, cover letter, interview brief, or follow-up grounded in your confirmed evidence.')} />}
    </Panel></div>
  )
}

function ProfilePortability() {
  const { t } = useI18n()
  const client = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [format, setFormat] = useState<'interchange' | 'json-resume'>('interchange')
  const [notice, setNotice] = useState('')
  const download = useMutation({
    mutationFn: async (selected: 'interchange' | 'json-resume') => {
      const document = await api<Record<string, unknown>>(`/api/profile/${selected}`)
      const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }))
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = selected === 'interchange' ? 'careertwin-profile.json' : 'resume.json'
      anchor.click()
      URL.revokeObjectURL(url)
    },
  })
  const importDocument = useMutation({
    mutationFn: async (file: File) => {
      const document = JSON.parse(await file.text()) as Record<string, unknown>
      return api<{ counts: Record<string, number> }>(`/api/profile/${format}/import`, json('POST', document))
    },
    onSuccess: (result) => {
      setNotice(t('Imported {count} profile records.', { count: Object.values(result.counts).reduce((sum, count) => sum + count, 0) }))
      for (const key of ['profile', 'skills', 'claims', 'experiences', 'education', 'profile-graph', 'today']) client.invalidateQueries({ queryKey: [key] })
      if (fileRef.current) fileRef.current.value = ''
    },
  })
  return (
    <Panel title={t('Portable professional data')} subtitle={t('Own a lossless CareerTwin archive or exchange a standards-based JSON Resume')}>
      <div className="portable-profile">
        <div><b>{t('Export')}</b><p>{t('Exports omit uploaded file bodies and extracted private text. Evidence references remain portable.')}</p><div className="form-actions"><button className="button secondary" onClick={() => download.mutate('interchange')}><Download /> {t('CareerTwin archive')}</button><button className="button secondary" onClick={() => download.mutate('json-resume')}><Download /> JSON Resume</button></div></div>
        <div><b>{t('Import')}</b><p>{t('Import replaces only your own professional-profile domain and remaps all internal evidence identifiers.')}</p><div className="form-actions"><select aria-label={t('Profile import format')} value={format} onChange={(event) => setFormat(event.target.value as typeof format)}><option value="interchange">{t('CareerTwin archive')}</option><option value="json-resume">JSON Resume</option></select><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => event.target.files?.[0] && importDocument.mutate(event.target.files[0])} /><button className="button primary" onClick={() => fileRef.current?.click()} disabled={importDocument.isPending}><Upload /> {t('Import for review')}</button></div></div>
      </div>
      {(download.error || importDocument.error) && <ErrorState error={download.error || importDocument.error} />}
      {notice && <div className="connector-result"><Check /><div><b>{t('Portable profile restored')}</b><p>{notice}</p></div></div>}
    </Panel>
  )
}

export function ProfilePage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<ProfileTab>('overview')
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/api/profile') })
  const skills = useQuery({ queryKey: ['skills'], queryFn: () => api<Skill[]>('/api/profile/skills') })
  const claims = useQuery({ queryKey: ['claims'], queryFn: () => api<Claim[]>('/api/profile/claims') })
  const graph = useQuery({ queryKey: ['profile-graph'], queryFn: () => api<ProfileGraphData>('/api/profile/graph') })
  const experiences = useQuery({ queryKey: ['experiences'], queryFn: () => api<Experience[]>('/api/profile/experiences') })
  const education = useQuery({ queryKey: ['education'], queryFn: () => api<Education[]>('/api/profile/education') })
  if (profile.isPending || skills.isPending || claims.isPending || graph.isPending || experiences.isPending || education.isPending) return <Loading label={t('Mapping your professional twin')} />
  const error = profile.error || skills.error || claims.error || graph.error || experiences.error || education.error
  if (error) return <ErrorState error={error} />
  const pending = claims.data.filter((claim) => claim.state === 'proposed').length
  const tabs: Array<[ProfileTab, string, React.ReactNode]> = [['overview', t('Overview'), <CircleUserRound />], ['evidence', `${t('Evidence')}${pending ? ` (${pending})` : ''}`, <BookOpenCheck />], ['graph', t('Constellation'), <Network />], ['river', t('Career river'), <Sparkles />], ['github', 'GitHub', <GitBranch />], ['artifacts', t('Artifacts'), <FileStack />]]
  return (
    <>
      <PageHeader eyebrow={t('Your professional twin')} title={profile.data.headline || t('Build a profile that can show its work.')} description={t('Curate your story, trace claims to their sources, and inspect capability without confusing missing evidence for weakness.')} />
      <nav className="section-tabs" aria-label={t('Profile views')}>{tabs.map(([key, label, icon]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{icon}{label}</button>)}</nav>
      {tab === 'overview' && <div className="profile-layout"><Panel title={t('Identity and direction')} subtitle={t('User-curated canonical fields')}><ProfileEditor profile={profile.data} /></Panel><SkillsPanel skills={skills.data} claims={claims.data} /><TimelineEditors experiences={experiences.data} education={education.data} /><ProfilePortability /></div>}
      {tab === 'evidence' && <EvidenceInbox claims={claims.data} />}
      {tab === 'graph' && <Panel title={t('Professional constellation')} subtitle={t('Every edge is inspectable; confirmed evidence anchors capability')}><ProfileConstellation data={graph.data.graph} /></Panel>}
      {tab === 'river' && <div className="profile-layout"><Panel title={t('Career river')} subtitle={t('Experience and education unfolding across time')}><CareerRiver rows={graph.data.river} /></Panel><Panel title={t('Evidence matrix')} subtitle={t('Capability level and source coverage side by side')}><EvidenceMatrix rows={graph.data.matrix} /></Panel></div>}
      {tab === 'github' && <GithubImporter />}
      {tab === 'artifacts' && <ArtifactStudio claims={claims.data} />}
    </>
  )
}
