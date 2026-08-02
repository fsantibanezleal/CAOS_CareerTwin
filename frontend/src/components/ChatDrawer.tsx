import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, FileUp, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { api, json } from '../api'
import { ErrorState } from './Primitives'

type ChatMessage = { role: 'user' | 'assistant'; content: string; citations?: Array<{ evidence_id: string; label: string }> }
type ChatResult = { conversation_id: string; content: string; specialist: string; provider: string; citations: Array<{ evidence_id: string; label: string }>; proposed_change_id?: string }

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [conversationId, setConversationId] = useState<string>()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<{ providers: string[]; default: string }>('/api/agent/providers'), enabled: open })
  const [provider, setProvider] = useState('mock')
  const send = useMutation({
    mutationFn: (message: string) => api<ChatResult>('/api/agent/chat', json('POST', { conversation_id: conversationId, message, provider })),
    onSuccess: (result) => {
      setConversationId(result.conversation_id)
      setMessages((current) => [...current, { role: 'assistant', content: result.content, citations: result.citations }])
    },
  })
  const upload = useMutation({
    mutationFn: (file: File) => { const form = new FormData(); form.append('file', file); form.append('label', file.name); return api('/api/profile/sources/upload', { method: 'POST', body: form }) },
    onSuccess: () => setMessages((current) => [...current, { role: 'assistant', content: 'Document ingested into the review inbox. Confirm its proposed claims before the agent treats them as evidence.' }]),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if (!message) return
    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    send.mutate(message)
  }
  return (
    <aside className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label="Career copilot">
      <header><div className="bot-mark"><Bot /></div><div><span>Career copilot</span><small><i /> Evidence-bounded</small></div><button className="icon-button" onClick={onClose} aria-label="Close chat"><X /></button></header>
      <div className="chat-context"><ShieldCheck size={15} /> Agents draft and explain. Only your approval can change canonical data.</div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><Sparkles /><h3>What are you working toward?</h3><p>Ask about your evidence, a saved opportunity, a match gap, or your application plan.</p><button onClick={() => setInput('Where is my profile evidence weakest?')}>Review my evidence coverage</button><button onClick={() => setInput('What should I prioritize for my saved opportunities?')}>Prioritize next actions</button></div>}
        {messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? 'CareerTwin' : 'You'}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <details><summary>{message.citations.length} evidence citations</summary>{message.citations.map((citation) => <div key={citation.evidence_id} className="citation">{citation.label}</div>)}</details>}</article>)}
        {send.isPending && <div className="chat-thinking"><i /><i /><i /><span>Routing to a bounded specialist</span></div>}
        {(send.error || upload.error) && <ErrorState error={send.error || upload.error} />}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <div className="composer-tools"><select aria-label="Model provider" value={provider} onChange={(event) => setProvider(event.target.value)}>{(providers.data?.providers ?? ['mock']).map((name) => <option key={name}>{name}</option>)}</select><span>Provider keys stay server-side</span></div>
        <textarea aria-label="Message" placeholder="Ask with context…" value={input} onChange={(event) => setInput(event.target.value)} rows={3} />
        <div><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button type="button" className="icon-button" onClick={() => fileRef.current?.click()} aria-label="Attach document"><FileUp /></button><button className="button primary" disabled={send.isPending || !input.trim()}><Send size={16} /> Send</button></div>
      </form>
    </aside>
  )
}
