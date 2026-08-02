export type User = {
  id: string
  email: string
  display_name: string
  is_active: boolean
  is_superuser: boolean
  locale: 'en' | 'es'
  theme: 'light' | 'dark'
  must_change_password: boolean
}

export type Profile = {
  id: string
  workspace_id: string
  headline: string
  summary: string
  location: string
  seniority: string
  years_experience: number
  availability: string
  preferences: Record<string, unknown>
  links: Array<Record<string, unknown>>
  revision: number
  updated_at: string
}

export type Skill = {
  id: string
  name: string
  normalized_name: string
  taxonomy_uri?: string
  level: number
  years: number
  confidence: number
  category: string
  evidence_count: number
}

export type Claim = {
  id: string
  source_id?: string
  claim_type: string
  statement: string
  normalized_value: Record<string, unknown>
  source_locator: Record<string, unknown>
  confidence: number
  state: 'proposed' | 'confirmed' | 'rejected' | 'superseded'
  decision_note?: string
  created_at: string
}

export type Requirement = {
  id: string
  category: string
  label: string
  normalized_name: string
  taxonomy_uri?: string
  importance: 'required' | 'preferred' | 'eligibility'
  weight: number
  minimum_level?: number
  source_locator: Record<string, unknown>
}

export type Opportunity = {
  id: string
  title: string
  employer: string
  description: string
  source_url?: string
  source_kind: string
  industry: string
  area: string
  seniority: string
  location: string
  remote_mode: string
  compensation: Record<string, unknown>
  published_at?: string
  deadline_at?: string
  status: string
  version: number
  structured_data: Record<string, unknown>
  requirements: Requirement[]
  created_at: string
  updated_at: string
}

export type OpportunitySnapshot = {
  id: string
  version: number
  snapshot: Opportunity
  source_sha256?: string
  created_at: string
}

export type TargetSet = {
  id: string
  name: string
  description: string
  opportunity_ids: string[]
  strategy: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type MatchRun = {
  id: string
  opportunity_id: string
  policy_version: string
  input_digest: string
  score?: number
  lower_bound: number
  upper_bound: number
  coverage: number
  eligibility: string
  components: {
    by_category?: Record<string, { score: number; coverage: number; requirements: number }>
    known_score?: number
    insufficient_evidence?: boolean
    meaning?: string
  }
  assessments: Array<{
    requirement_id: string
    label: string
    category: string
    importance: string
    status: string
    score?: number
    evidence_ids: string[]
    explanation: string
  }>
  created_at: string
}

export type Application = {
  id: string
  opportunity_id: string
  stage: string
  channel: string
  notes: string
  applied_at?: string
  closed_at?: string
  created_at: string
  updated_at: string
}

export type CareerTask = {
  id: string
  application_id?: string
  kind: string
  title: string
  notes: string
  starts_at?: string
  due_at?: string
  completed_at?: string
  reminder_minutes?: number
  contact: Record<string, unknown>
  contact_id?: string
}

export type Contact = {
  id: string
  application_id?: string
  name: string
  email: string
  organization: string
  role: string
  notes: string
  created_at: string
  updated_at: string
}

export type Dashboard = {
  profile_completeness: number
  confirmed_evidence: number
  review_pending: number
  active_opportunities: number
  applications_by_stage: Record<string, number>
  upcoming_tasks: CareerTask[]
  global_alignment?: number
  global_alignment_coverage: number
}

export type ProfileGraphData = {
  graph: {
    nodes: Array<Record<string, unknown> & { id: string; label: string; type: string }>
    edges: Array<Record<string, unknown> & { id: string; source: string; target: string }>
  }
  river: Array<Record<string, unknown> & { id: string; kind: string; title: string }>
  matrix: Array<{
    skill_id: string
    skill: string
    level: number
    confidence: number
    evidence: Array<{ id: string; statement: string; source_id?: string }>
  }>
}

export type Experience = {
  id: string
  organization: string
  role: string
  start_date: string
  end_date?: string
  current: boolean
  summary: string
  achievements: Array<Record<string, unknown>>
  skills: string[]
}

export type Education = {
  id: string
  institution: string
  credential: string
  field: string
  start_date: string
  end_date?: string
  details: string
}

export type Recommendation = {
  id: string
  opportunity_id?: string
  kind: string
  title: string
  rationale: string
  requirement_ids: string[]
  impact: number
  effort: number
  priority: number
  status: string
  prerequisites: string[]
  steps: Array<Record<string, unknown>>
  progress: number
}

export type AgentRun = {
  id: string
  conversation_id: string
  status: 'queued' | 'retrying' | 'running' | 'completed' | 'failed' | 'cancelled'
  specialist?: string
  provider: string
  input_digest: string
  state: Record<string, unknown>
  error_code?: string
  parent_run_id?: string
  attempt: number
  cancel_requested_at?: string
  started_at?: string
  finished_at?: string
  created_at: string
  updated_at: string
}

export type Artifact = {
  id: string
  opportunity_id?: string
  kind: 'resume' | 'cover_letter' | 'interview_brief' | 'follow_up'
  title: string
  version: number
  content: string
  evidence_ids: string[]
  status: string
  generator: string
  created_at: string
  updated_at: string
}

export type AdminUser = User

export type Landscape = {
  denominator: number
  industries: Record<string, number>
  seniority: Record<string, number>
  skills: Record<string, number>
  opportunities: Array<{
    id: string
    title: string
    employer: string
    industry: string
    seniority: string
    requirements: number
    deadline_at?: string
    status: string
  }>
  warning: string
}

export type PipelineAnalytics = {
  denominator: number
  by_stage: Record<string, number>
  applied_count: number
  median_days_to_close?: number
  sample_warning: boolean
  meaning: string
  generated_at: string
}
