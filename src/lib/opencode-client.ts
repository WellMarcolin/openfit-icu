import { createOpencodeClient } from '@opencode-ai/sdk'

export interface HealthContext {
  athlete: {
    name: string
    weight: number | null
    ftp: number | null
    eftp: number | null
    resting_hr: number | null
    sport: string
  }
  fitness: {
    ctl: number | null
    atl: number | null
    tsb: number | null
    ramp_rate: number | null
  }
  recent_activities: any[]
  wellness_7d: any[]
  power_curves: any
  selected_date: string
  current_page: string
}

export interface ChatResponse {
  sessionId: string
  response: string
}

export class OpenCodeClient {
  private client: ReturnType<typeof createOpencodeClient>
  private sessionId: string | null = null

  constructor(
    private serverUrl: string,
    private username?: string,
    private password?: string
  ) {
    this.client = createOpencodeClient({
      baseUrl: serverUrl,
      headers: username && password ? {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      } : {}
    })
  }

  async createSession(title: string = 'Health Consultation'): Promise<string> {
    const result = await this.client.session.create({
      body: { title }
    })
    
    if (!result.data) {
      throw new Error('Failed to create session')
    }

    this.sessionId = result.data.id
    return this.sessionId
  }

  async sendMessage(message: string, context: HealthContext): Promise<ChatResponse> {
    if (!this.sessionId) {
      await this.createSession()
    }

    const contextMessage = `<OPENFIT_ICU_CONTEXT>
${JSON.stringify(context, null, 2)}
</OPENFIT_ICU_CONTEXT>

${message}`

    const result = await this.client.session.prompt({
      path: { id: this.sessionId! },
      body: {
        parts: [{ type: 'text', text: contextMessage }]
      }
    })

    if (!result.data) {
      throw new Error('Failed to get response')
    }

    const responseText = result.data.parts
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join('\n')

    return {
      sessionId: this.sessionId!,
      response: responseText
    }
  }

  async abortSession(): Promise<void> {
    if (!this.sessionId) return

    await this.client.session.abort({
      path: { id: this.sessionId }
    })
  }

  async resetSession(): Promise<void> {
    if (!this.sessionId) return

    await this.client.session.delete({
      path: { id: this.sessionId }
    })
    
    this.sessionId = null
  }

  getSessionId(): string | null {
    return this.sessionId
  }
}
