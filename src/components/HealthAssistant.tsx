// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AssistantRuntimeProvider,
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantRuntime,
  useLocalRuntime,
  type ChatModelAdapter,
  type ThreadMessage,
} from '@assistant-ui/react'
import { ArrowDown, ArrowUp, Plus, Sparkles, Square, X } from 'lucide-react'
import {
  buildHealthAssistantContext,
  parseAssistantNavigation,
  stripAssistantNavigation,
  visibleAssistantText,
  type AssistantNavigation,
} from '@/lib/health-assistant'
import type {
  DashboardData,
  HealthAssistantStatus,
  PageId,
} from '@/types'

const unavailableStatus: HealthAssistantStatus = {
  available: false,
  connected: false,
  authenticated: false,
  version: null,
}

function messageText(message: ThreadMessage | undefined) {
  if (!message) return ''
  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
}

function statusLabel(status: HealthAssistantStatus) {
  if (!status.available) return 'OpenCode not configured'
  if (!status.connected) return 'Connecting...'
  return status.authenticated ? 'AI assistant ready' : 'Configuration required'
}

function createQueue() {
  let pendingResponse: string | null = null
  let wake: ((text: string) => void) | null = null

  return {
    push(text: string) {
      if (wake) {
        const resolve = wake
        wake = null
        resolve(text)
      } else {
        pendingResponse = text
      }
    },
    next(): Promise<string> {
      if (pendingResponse !== null) {
        const text = pendingResponse
        pendingResponse = null
        return Promise.resolve(text)
      }
      return new Promise<string>((resolve) => { wake = resolve })
    },
  }
}

export function HealthAssistant({
  open,
  data,
  page,
  onOpenChange,
  onNavigate,
}: {
  open: boolean
  data: DashboardData
  page: PageId
  onOpenChange: (open: boolean) => void
  onNavigate: (navigation: AssistantNavigation) => void
}) {
  const dataRef = useRef(data)
  const pageRef = useRef(page)
  const navigateRef = useRef(onNavigate)
  const [status, setStatus] = useState(unavailableStatus)

  useEffect(() => { dataRef.current = data }, [data])
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { navigateRef.current = onNavigate }, [onNavigate])

  const checkAssistantStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/assistant/config')
      if (response.ok) {
        const config = await response.json()
        setStatus({
          available: true,
          connected: true,
          authenticated: config.serverConfigured ?? false,
          version: null,
        })
      } else {
        setStatus(unavailableStatus)
      }
    } catch {
      setStatus(unavailableStatus)
    }
  }, [])

  useEffect(() => { void checkAssistantStatus() }, [checkAssistantStatus])
  useEffect(() => {
    if (open) void checkAssistantStatus()
  }, [open, checkAssistantStatus])

  const modelAdapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const prompt = messageText(messages.at(-1))
      if (!prompt) throw new Error('Write a question before sending it.')

      const healthContext = buildHealthAssistantContext(dataRef.current, [], pageRef.current)
      const queue = createQueue()
      let fullText = ''
      let lastVisibleText = ''
      let completed = false

      const onAbort = () => queue.push('[CANCELLED]')
      abortSignal.addEventListener('abort', onAbort, { once: true })

      try {
        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            context: JSON.parse(healthContext),
          }),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(error || 'Assistant request failed')
        }

        const result = await response.json()
        fullText = result.response ?? ''

        void checkAssistantStatus()

        const navigation = parseAssistantNavigation(fullText)
        const finalText = stripAssistantNavigation(fullText)
        if (navigation) navigateRef.current(navigation)
        if (!finalText) throw new Error('Assistant completed without a response.')

        yield { content: [{ type: 'text', text: finalText }] }
      } finally {
        abortSignal.removeEventListener('abort', onAbort)
        void checkAssistantStatus()
      }
    },
  }), [checkAssistantStatus])

  const runtime = useLocalRuntime(modelAdapter)
  const ready = status.available && status.authenticated

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <aside
        id="health-assistant"
        className={`health-assistant ${open ? 'is-open' : ''}`}
        aria-label="Health assistant"
        aria-hidden={!open}
        inert={!open}
      >
        <AssistantHeader
          status={status}
          ready={ready}
          onClose={() => onOpenChange(false)}
          onStatusRefresh={checkAssistantStatus}
        />
        <AssistantThread ready={ready} />
      </aside>
      {open && <button className="assistant-scrim" aria-label="Close health assistant" onClick={() => onOpenChange(false)} />}
    </AssistantRuntimeProvider>
  )
}

function AssistantHeader({
  status,
  ready,
  onClose,
  onStatusRefresh,
}: {
  status: HealthAssistantStatus
  ready: boolean
  onClose: () => void
  onStatusRefresh: () => Promise<void>
}) {
  const runtime = useAssistantRuntime()

  const newConversation = async () => {
    runtime.thread.cancelRun()
    runtime.thread.reset()
    await onStatusRefresh()
  }

  return (
    <header className="assistant-header">
      <div className="assistant-title">
        <span className="assistant-mark"><Sparkles aria-hidden="true" /></span>
        <span>
          <strong>Training assistant</strong>
          <small><i className={ready ? 'is-ready' : ''} />{statusLabel(status)}</small>
        </span>
      </div>
      <div className="assistant-header-actions">
        <button type="button" aria-label="New conversation" title="New conversation" onClick={() => void newConversation()}>
          <Plus aria-hidden="true" />
        </button>
        <button type="button" aria-label="Close assistant" title="Close" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}

function AssistantThread({ ready }: { ready: boolean }) {
  return (
    <ThreadPrimitive.Root className="assistant-thread">
      <ThreadPrimitive.Viewport className="assistant-viewport">
        <AuiIf condition={(state) => state.thread.isEmpty}>
          <div className="assistant-welcome">
            <h2>Ask about your training.</h2>
            <p>I can analyze fitness trends, power curves, and wellness data.</p>
            <div className="assistant-suggestions" aria-label="Suggested questions">
              <ThreadPrimitive.Suggestion prompt="How is my fitness trending?" send disabled={!ready}>Fitness trend</ThreadPrimitive.Suggestion>
              <ThreadPrimitive.Suggestion prompt="Analyze my power curve and FTP." send disabled={!ready}>Power analysis</ThreadPrimitive.Suggestion>
              <ThreadPrimitive.Suggestion prompt="How is my recovery looking?" send disabled={!ready}>Recovery status</ThreadPrimitive.Suggestion>
            </div>
          </div>
        </AuiIf>

        <div className="assistant-messages">
          <ThreadPrimitive.Messages>
            {({ message }) => message.role === 'user' ? <UserMessage /> : <AssistantMessage />}
          </ThreadPrimitive.Messages>
        </div>

        <ThreadPrimitive.ViewportFooter className="assistant-viewport-footer">
          <ThreadPrimitive.ScrollToBottom className="assistant-scroll-bottom" aria-label="Scroll to latest response">
            <ArrowDown aria-hidden="true" />
          </ThreadPrimitive.ScrollToBottom>
          <ComposerPrimitive.Root className="assistant-composer">
            <ComposerPrimitive.Input
              className="assistant-composer-input"
              rows={1}
              disabled={!ready}
              placeholder={ready ? 'Ask about your training…' : 'Configure OpenCode to chat'}
              aria-label="Message training assistant"
            />
            <AuiIf condition={(state) => !state.thread.isRunning}>
              <ComposerPrimitive.Send className="assistant-send" disabled={!ready} aria-label="Send message">
                <ArrowUp aria-hidden="true" />
              </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(state) => state.thread.isRunning}>
              <ComposerPrimitive.Cancel className="assistant-send is-cancel" aria-label="Stop response">
                <Square aria-hidden="true" />
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </ComposerPrimitive.Root>
          <p className="assistant-disclaimer">Training context, not medical advice.</p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="assistant-user-message">
      <div><MessagePrimitive.Parts /></div>
    </MessagePrimitive.Root>
  )
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="assistant-ai-message">
      <span className="assistant-response-mark" aria-hidden="true">+</span>
      <div><MessagePrimitive.Parts /></div>
    </MessagePrimitive.Root>
  )
}
