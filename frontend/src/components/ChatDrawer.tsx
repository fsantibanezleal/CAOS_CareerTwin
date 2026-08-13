import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, FileUp, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import { ErrorState } from './Primitives'

type ChatMessage = { role: 'user' | 'assistant'; content: string; citations?: Array<{ evidence_id: string; label: string }> }
type ChatResult = { conversation_id: string; content: string; specialist: string; provider: string; citations: Array<{ evidence_id: string; label: string }>; proposed_change_id?: string }

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plural, t } = useI18n()
  const [conversationId, setConversationId] = useState<string>()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<{ providers: string[]; default: string }>('/api/agent/providers'), enabled: open })
  const [provider, setProvider] = useState('')
  const selectedProvider = provider || providers.data?.default || providers.data?.providers[0] || ''
  const send = useMutation({
    mutationFn: (message: string) => api<ChatResult>('/api/agent/chat', json('POST', { conversation_id: conversationId, message, provider: selectedProvider })),
    onSuccess: (result) => {
      setConversationId(result.conversation_id)
      setMessages((current) => [...current, { role: 'assistant', content: result.content, citations: result.citations }])
    },
  })
  const upload = useMutation({
    mutationFn: (file: File) => { const form = new FormData(); form.append('file', file); form.append('label', file.name); return api('/api/profile/sources/upload', { method: 'POST', body: form }) },
    onSuccess: () => setMessages((current) => [...current, { role: 'assistant', content: t('Document ingested into the review inbox. Confirm its proposed claims before the agent treats them as evidence.') }]),
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
    <aside className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label={t('Career copilot')}>
      <header><div className="bot-mark"><Bot /></div><div><span>{t('Career copilot')}</span><small><i /> {t('Evidence-bounded')}</small></div><button className="icon-button" onClick={onClose} aria-label={t('Close chat')}><X /></button></header>
      <div className="chat-context"><ShieldCheck size={15} /> {t('Agents draft and explain. Only your approval can change canonical data.')}</div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><Sparkles /><h3>{t('What are you working toward?')}</h3><p>{t('Ask about your evidence, a saved opportunity, a match gap, or your application plan.')}</p><button onClick={() => setInput(t('Where is my profile evidence weakest?'))}>{t('Review my evidence coverage')}</button><button onClick={() => setInput(t('What should I prioritize for my saved opportunities?'))}>{t('Prioritize next actions')}</button></div>}
        {messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? 'CareerTwin' : t('You')}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <details><summary>{plural(message.citations.length, '{count} evidence citation', '{count} evidence citations')}</summary>{message.citations.map((citation) => <div key={citation.evidence_id} className="citation">{citation.label}</div>)}</details>}</article>)}
        {send.isPending && <div className="chat-thinking"><i /><i /><i /><span>{t('Routing to a bounded specialist')}</span></div>}
        {(send.error || upload.error) && <ErrorState error={send.error || upload.error} />}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <div className="composer-tools"><select aria-label={t('Model provider')} value={selectedProvider} onChange={(event) => setProvider(event.target.value)} disabled={!selectedProvider}>{(providers.data?.providers ?? []).map((name) => <option key={name}>{name}</option>)}</select><span>{t('Provider keys stay server-side')}</span></div>
        <textarea aria-label={t('Message')} placeholder={t('Ask with context…')} value={input} onChange={(event) => setInput(event.target.value)} rows={3} />
        <div><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button type="button" className="icon-button" onClick={() => fileRef.current?.click()} aria-label={t('Attach document')}><FileUp /></button><button className="button primary" disabled={send.isPending || !input.trim() || !selectedProvider}><Send size={16} /> {t('Send')}</button></div>
      </form>
    </aside>
  )
}
