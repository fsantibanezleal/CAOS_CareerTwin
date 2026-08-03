import { useMutation, useQuery } from '@tanstack/react-query'
import { Ban, Bot, FileUp, MessageSquarePlus, Mic, MicOff, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { api, json } from '../api'
import { useI18n } from '../i18n'
import type { AgentRun } from '../types'
import { ErrorState } from './Primitives'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ evidence_id: string; label: string }>
}

type ProviderManifest = {
  providers: string[]
  default: string | null
  mode: 'external-only'
  configured: boolean
  voice: { available: boolean; provider: 'xai'; model: string }
}

type VoiceCredential = {
  value: string
  expires_at: number
  websocket_url: string
  model: string
  voice: string
}

type ConversationSummary = {
  id: string
  title: string
  updated_at: string
}

function pcm16Base64(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length)
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index] ?? 0))
    pcm[index] = value < 0 ? value * 0x8000 : value * 0x7fff
  }
  const bytes = new Uint8Array(pcm.buffer)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

function base64Pcm16(value: string): Float32Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const pcm = new Int16Array(bytes.buffer)
  return Float32Array.from(pcm, (sample) => sample / 32768)
}

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plural, t } = useI18n()
  const [conversationId, setConversationId] = useState<string>()
  const [activeRun, setActiveRun] = useState<AgentRun>()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const handledRun = useRef<string | undefined>(undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const voiceSocket = useRef<WebSocket | null>(null)
  const voiceStream = useRef<MediaStream | null>(null)
  const voiceContext = useRef<AudioContext | null>(null)
  const voiceProcessor = useRef<ScriptProcessorNode | null>(null)
  const voicePlayhead = useRef(0)
  const voiceAttempt = useRef(0)
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const providers = useQuery({ queryKey: ['providers'], queryFn: () => api<ProviderManifest>('/api/agent/providers'), enabled: open })
  const conversations = useQuery({ queryKey: ['agent-conversations'], queryFn: () => api<ConversationSummary[]>('/api/agent/conversations'), enabled: open })
  const [provider, setProvider] = useState('')
  const selectedProvider = provider || providers.data?.default || ''
  const run = useQuery({
    queryKey: ['agent-run', activeRun?.id],
    queryFn: () => api<AgentRun>(`/api/agent/runs/${activeRun?.id}`),
    enabled: Boolean(activeRun?.id),
    refetchInterval: (query) => ['queued', 'claimed', 'retrying', 'running'].includes(query.state.data?.status ?? '') ? 1000 : false,
  })
  const currentRun = run.data ?? activeRun
  const send = useMutation({
    mutationFn: (message: string) => api<AgentRun>('/api/agent/runs', json('POST', { conversation_id: conversationId, message, provider: selectedProvider })),
    onSuccess: (result) => {
      setConversationId(result.conversation_id)
      setActiveRun(result)
      handledRun.current = undefined
      void conversations.refetch()
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
    onSuccess: () => setMessages((current) => [...current, { role: 'assistant', content: t('Document ingested into the review inbox. Confirm its proposed claims before the agent treats them as evidence.') }]),
  })
  const startFreshConversation = () => {
    setConversationId(undefined)
    setActiveRun(undefined)
    setMessages([])
    handledRun.current = undefined
  }
  const loadConversation = useMutation({
    mutationFn: (id: string) => api<ChatMessage[]>(`/api/agent/conversations/${id}/messages`),
    onSuccess: (stored, id) => {
      setConversationId(id)
      setActiveRun(undefined)
      setMessages(stored)
      handledRun.current = undefined
    },
  })
  const removeConversation = useMutation({
    mutationFn: (id: string) => api(`/api/agent/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      startFreshConversation()
      void conversations.refetch()
    },
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
  const busy = send.isPending || ['queued', 'claimed', 'retrying', 'running'].includes(currentRun?.status ?? '')
  const error = send.error || run.error || cancel.error || retry.error || upload.error || conversations.error || loadConversation.error || removeConversation.error

  const stopVoice = () => {
    voiceAttempt.current += 1
    voiceProcessor.current?.disconnect()
    voiceProcessor.current = null
    voiceStream.current?.getTracks().forEach((track) => track.stop())
    voiceStream.current = null
    voiceSocket.current?.close()
    voiceSocket.current = null
    void voiceContext.current?.close()
    voiceContext.current = null
    voicePlayhead.current = 0
    setVoiceStatus('idle')
  }

  useEffect(() => () => {
    voiceAttempt.current += 1
    voiceProcessor.current?.disconnect()
    voiceStream.current?.getTracks().forEach((track) => track.stop())
    voiceSocket.current?.close()
    void voiceContext.current?.close()
  }, [])

  const startVoice = async () => {
    const attempt = voiceAttempt.current + 1
    voiceAttempt.current = attempt
    setVoiceStatus('connecting')
    setVoiceTranscript('')
    try {
      const credential = await api<VoiceCredential>('/api/agent/voice/session', { method: 'POST' })
      if (attempt !== voiceAttempt.current) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      if (attempt !== voiceAttempt.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const context = new AudioContext({ sampleRate: 24000 })
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const socket = new WebSocket(credential.websocket_url, [`xai-client-secret.${credential.value}`])
      voiceStream.current = stream
      voiceContext.current = context
      voiceProcessor.current = processor
      voiceSocket.current = socket
      processor.onaudioprocess = (event) => {
        if (socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcm16Base64(event.inputBuffer.getChannelData(0)) }))
      }
      source.connect(processor)
      processor.connect(context.destination)
      socket.onopen = () => {
        if (attempt !== voiceAttempt.current) { socket.close(); return }
        socket.send(JSON.stringify({
          type: 'session.update',
          session: {
            voice: credential.voice,
            instructions: 'You are the CareerTwin voice copilot. Explain only from user-provided facts, distinguish unknown from weak, never predict hiring, and never claim a canonical change was made. Reply in the language used by the person.',
            turn_detection: { type: 'server_vad' },
            audio: {
              input: { format: { type: 'audio/pcm', rate: 24000 }, transcription: { model: 'grok-transcribe' } },
              output: { format: { type: 'audio/pcm', rate: 24000 } },
            },
          },
        }))
        setVoiceStatus('listening')
      }
      socket.onmessage = (message) => {
        if (attempt !== voiceAttempt.current) return
        const event = JSON.parse(String(message.data)) as Record<string, unknown>
        const type = String(event.type ?? '')
        if (type === 'conversation.item.input_audio_transcription.updated' || type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = String(event.transcript ?? '')
          if (transcript) setVoiceTranscript(transcript)
        }
        if (type === 'response.output_audio_transcript.delta') {
          setVoiceStatus('speaking')
          const delta = String(event.delta ?? '')
          setVoiceTranscript((current) => `${current}${delta}`)
        }
        if (type === 'response.output_audio.delta') {
          setVoiceStatus('speaking')
          const samples = base64Pcm16(String(event.delta ?? ''))
          const buffer = context.createBuffer(1, samples.length, 24000)
          const stableSamples = new Float32Array(samples.length)
          stableSamples.set(samples)
          buffer.copyToChannel(stableSamples, 0)
          const player = context.createBufferSource()
          player.buffer = buffer
          player.connect(context.destination)
          voicePlayhead.current = Math.max(voicePlayhead.current, context.currentTime)
          player.start(voicePlayhead.current)
          voicePlayhead.current += buffer.duration
        }
        if (type === 'response.done') setVoiceStatus('listening')
        if (type === 'error') {
          stopVoice()
          setVoiceStatus('error')
        }
      }
      socket.onerror = () => {
        if (attempt !== voiceAttempt.current) return
        stopVoice()
        setVoiceStatus('error')
      }
      socket.onclose = () => {
        if (attempt === voiceAttempt.current) setVoiceStatus((current) => current === 'error' ? 'error' : 'idle')
      }
    } catch {
      if (attempt === voiceAttempt.current) {
        stopVoice()
        setVoiceStatus('error')
      }
    }
  }
  return (
    <aside className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label={t('Career copilot')}>
      <header><div className="bot-mark"><Bot /></div><div><span>{t('Career copilot')}</span><small><i /> {t('Evidence-bounded')}</small></div><button className="icon-button" onClick={() => { stopVoice(); onClose() }} aria-label={t('Close chat')}><X /></button></header>
      <div className="chat-context"><ShieldCheck size={15} /> {t('Durable runs can be cancelled or retried. Only your approval can change canonical data.')}</div>
      <div className="chat-history">
        <label>{t('Conversation history')}<select aria-label={t('Conversation history')} value={conversationId ?? ''} disabled={busy || loadConversation.isPending} onChange={(event) => event.target.value ? loadConversation.mutate(event.target.value) : startFreshConversation()}><option value="">{t('New conversation')}</option>{(conversations.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <button type="button" className="icon-button" disabled={busy || !conversationId} onClick={startFreshConversation} aria-label={t('New conversation')}><MessageSquarePlus /></button>
        <button type="button" className="icon-button danger" disabled={busy || !conversationId || removeConversation.isPending} onClick={() => conversationId && window.confirm(t('Delete this conversation and its visible messages?')) && removeConversation.mutate(conversationId)} aria-label={t('Delete conversation')}><Trash2 /></button>
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><Sparkles /><h3>{t('What are you working toward?')}</h3><p>{t('Ask about your evidence, a saved opportunity, a match gap, or your application plan.')}</p><button onClick={() => setInput(t('Where is my profile evidence weakest?'))}>{t('Review my evidence coverage')}</button><button onClick={() => setInput(t('What should I prioritize for my saved opportunities?'))}>{t('Prioritize next actions')}</button></div>}
        {messages.map((message, index) => <article key={index} className={`chat-message ${message.role}`}><span>{message.role === 'assistant' ? 'CareerTwin' : t('You')}</span><p>{message.content}</p>{message.citations && message.citations.length > 0 && <details><summary>{plural(message.citations.length, '{count} evidence citation', '{count} evidence citations')}</summary>{message.citations.map((citation) => <div key={citation.evidence_id} className="citation">{citation.label}</div>)}</details>}</article>)}
        {busy && <div className="chat-thinking"><i /><i /><i /><span>{currentRun ? t('{status} · attempt {attempt}', { status: t(currentRun.status), attempt: currentRun.attempt }) : t('Persisting the run')}</span>{currentRun && <button className="button ghost" onClick={() => cancel.mutate()}><Ban /> {t('Cancel')}</button>}</div>}
        {currentRun && ['failed', 'cancelled'].includes(currentRun.status) && <div className="run-recovery"><span className={`status-badge ${currentRun.status}`}>{t(currentRun.status)}</span><p>{currentRun.error_code ? t('Safe failure: {code}', { code: currentRun.error_code }) : t('The run stopped before publishing an answer.')}</p><button className="button secondary" onClick={() => retry.mutate()} disabled={retry.isPending}><RotateCcw /> {t('Retry from checkpoint')}</button></div>}
        {error && <ErrorState error={error} />}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <div className="composer-tools"><select aria-label={t('Model provider')} value={selectedProvider} onChange={(event) => setProvider(event.target.value)} disabled={!providers.data?.providers.length}>{(providers.data?.providers ?? []).map((name) => <option key={name}>{name}</option>)}</select><span>{t(providers.data?.configured ? 'External provider keys stay server-side' : 'Configure an external API to enable the copilot')}</span></div>
        {voiceStatus !== 'idle' && <div className={`voice-status ${voiceStatus}`} aria-live="polite"><i /> <span>{t(voiceStatus === 'connecting' ? 'Connecting to Grok Voice' : voiceStatus === 'listening' ? 'Listening' : voiceStatus === 'speaking' ? 'Grok is speaking' : 'Voice session unavailable')}</span>{voiceTranscript && <p>{voiceTranscript}</p>}</div>}
        <textarea aria-label={t('Message')} placeholder={t('Ask with context…')} value={input} onChange={(event) => setInput(event.target.value)} rows={3} />
        <div><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.html,.png,.jpg,.jpeg" onChange={(event) => event.target.files?.[0] && upload.mutate(event.target.files[0])} /><button type="button" className="icon-button" onClick={() => fileRef.current?.click()} aria-label={t('Attach document')}><FileUp /></button>{voiceStatus === 'idle' || voiceStatus === 'error' ? <button type="button" className="button secondary" disabled={!providers.data?.voice.available} onClick={() => void startVoice()}><Mic size={16} /> {t('Talk with Grok')}</button> : <button type="button" className="button secondary" onClick={stopVoice}><MicOff size={16} /> {t('End voice')}</button>}<button className="button primary" disabled={busy || !input.trim() || !selectedProvider}><Send size={16} /> {t('Queue')}</button></div>
      </form>
    </aside>
  )
}
