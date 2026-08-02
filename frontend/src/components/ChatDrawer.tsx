import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, Bot, FileUp, RotateCcw, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, json } from '../api'
import type { AgentRun } from '../types'
import { ErrorState } from './Primitives'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ evidence_id: string; label: string }>
}

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string>()
  const [activeRun, setActiveRun] = useState<AgentRun>()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const handledRun = useRef<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<{ providers: string[]; default: string; local_private_provider: boolean }>('/api/agent/providers'), enabled: open })
  const [provider, setProvider] = useState('')
  const selectedProvider = provider || providers.data?.default || ''
  const run = useQuery({
    queryKey: ['agent-run', activeRun?.id],
    queryFn: () => api<AgentRun>(`/api/agent/runs/${activeRun?.id}`),
    enabled: Boolean(activeRun?.id),
    refetchInterval: (query) => ['queued', 'retrying', 'running'].includes(query.state.data?.status ?? '') ? 1000 : false,
  })
  const currentRun = run.data ?? activeRun
  const send = useMutation({
    mutationFn: (message: string) => api<AgentRun>('/api/agent/runs', json('POST', { conversation_id: conversationId, message, provider: selectedProvider })),
    onSuccess: (result) => {
      setConversationId(result.conversation_id)
      setActiveRun(result)
      handledRun.current = undefined
    },
  })
  const cancel = useMutation({
    mutationFn: () => api<AgentRun>(`/api/agent/runs/${currentRun?.id}/cancel`, { method: 'POST' }),
    onSuccess: setActiveRun,
  })
  const retry = useMutation({
    mutationFn: () => api<AgentRun>(`/api/agent/runs/${currentRun?.id}/retry`, { method: 'POST' }),
    onSuccess: (result) => {
      setActiveRun(result)
      handledRun.current = undefined
    },
  })
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('label', file.name)
      return api('/api/profile/sources/upload', { method: 'POST', body: form })
    },
    onSuccess: () => setMessages((current) => [...current, { role: 'assistant', content: 'Document ingested into the review inbox. Confirm its proposed claims before the agent treats them as evidence.' }]),
  })

  useEffect(() => {
    if (currentRun?.status !== 'completed' || handledRun.current === currentRun.id) return
    handledRun.current = currentRun.id
    let live = true
    api<ChatMessage[]>(`/api/agent/conversations/${currentRun.conversation_id}/messages`).then((stored) => {
      const assistant = [...stored].reverse().find((message) => message.role === 'assistant')
      if (live && assistant) setMessages((current) => [...current, assistant])
    }).catch(() => { handledRun.current = undefined })
    return () => { live = false }
  }, [currentRun?.conversation_id, currentRun?.id, currentRun?.status])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if (!message) return
    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    send.mutate(message)
  }
  const busy = send.isPending || ['queued', 'retrying', 'running'].includes(currentRun?.status ?? '')
  const error = send.error || run.error || cancel.error || retry.error || upload.error
  return (
    <aside className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Career copilot">
      <header><div className="bot-mark"><Bot /></div><div><span>Career copilot</span><small><i /> Evidence-bounded</small></div><button className="icon-button" onClick={onClose} aria-label="Close chat"><X /></button></header>
      <div className="chat-context"><ShieldCheck size={15} /> Durable runs can be cancelled or retried. Only your approval can change canonical data.</div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><Sparkles /><h3>What are you working toward?</h3><p>Ask about your evidence, a saved opportunity, a match gap, or your application plan.</p><button onClick={() => setInput('Where is my profile evidence weakest?')}>Review my evidence coverage</button><button onClick={() => setInput('What should I prioritize for my saved opportunities?')}>Prioritize next actions</button></div>}
        {messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? 'CareerTwin' : 'You'}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <details><summary>{message.citations.length} evidence citations</summary>{message.citations.map((citation) => <div key={citation.evidence_id} className="citation">{citation.label}</div>)}</details>}</article>)}
        {busy && <div className="chat-thinking"><i /><i /><i /><span>{currentRun ? `${currentRun.status} · attempt ${currentRun.attempt}` : 'Persisting the run'}</span>{currentRun && <button className="button ghost" onClick={() => cancel.mutate()}><Ban /> Cancel</button>}</div>}
        {currentRun && ['failed', 'cancelled'].includes(currentRun.status) && <div className="run-recovery"><span className={`status-badge ${currentRun.status}`}>{currentRun.status}</span><p>{currentRun.error_code ? `Safe failure: ${currentRun.error_code}` : 'The run stopped before publishing an answer.'}</p><button className="button secondary" onClick={() => retry.mutate()} disabled={retry.isPending}><RotateCcw /> Retry from checkpoint</button></div>}
        {error && <ErrorState error={error} />}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <div className="composer-tools"><select aria-label="Model provider" value={selectedProvider} onChange={(event) => setProvider(event.target.value)} disabled={!providers.data?.providers.length}>{(providers.data?.providers ?? []).map((name) => <option key={name}>{name}</option>)}</select><span>{providers.data?.local_private_provider ? 'Private local inference available' : 'Provider keys stay server-side'}</span></div>
        <textarea aria-label="Message" placeholder="Ask with context…" value={input} onChange={(event) => setInput(event.target.value)} rows={3} />
        <div><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button type="button" className="icon-button" onClick={() => fileRef.current?.click()} aria-label="Attach document"><FileUp /></button><button className="button primary" disabled={busy || !input.trim()}><Send size={16} /> Queue</button></div>
      </form>
    </aside>
  )
}
