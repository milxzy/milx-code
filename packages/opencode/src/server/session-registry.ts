import { Log } from "../util/log"
import { Storage } from "../storage/storage"
import { ulid } from "ulid"
import z from "zod"
import { Session } from "../session"

export namespace SessionRegistry {
  const log = Log.create({ service: "session-registry" })

  // info about each connected client
  export const ClientInfo = z.object({
    id: z.string(),
    sessionID: z.string(),
    connectedAt: z.number(),
    lastActivity: z.number(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
  })
  export type ClientInfo = z.infer<typeof ClientInfo>

  // tracks a session in our global registry
  export const SessionEntry = z.object({
    sessionID: z.string(),
    projectID: z.string(),
    directory: z.string(),
    instanceID: z.string().optional(),
    createdAt: z.number(),
    lastActivity: z.number(),
    clients: z.array(z.string()),
    timeout: z.number().optional(),
  })
  export type SessionEntry = z.infer<typeof SessionEntry>

  // in-memory storage for quick lookups
  const sessions = new Map<string, SessionEntry>()
  const clients = new Map<string, ClientInfo>()
  let cleanupInterval: Timer | null = null

  // default timeout is 2 hours, can override with env var
  const SESSION_TIMEOUT_MS = parseInt(process.env.OPENCODE_SESSION_TIMEOUT ?? "7200000")
  const CLEANUP_INTERVAL_MS = 60000 // check every minute

  // fire up the registry and load any saved state
  export async function init() {
    await load()
    startCleanup()
    log.info("initialized", {
      sessionCount: sessions.size,
      clientCount: clients.size,
      timeoutMs: SESSION_TIMEOUT_MS,
    })
  }

  // shut everything down gracefully
  export function shutdown() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
    persist().catch((err) => log.error("failed to persist on shutdown", { error: err }))
  }

  // kick off the cleanup loop
  function startCleanup() {
    if (cleanupInterval) return
    cleanupInterval = setInterval(() => {
      cleanup()
    }, CLEANUP_INTERVAL_MS)
  }

  // remove sessions that have timed out
  export function cleanup() {
    const now = Date.now()
    let removed = 0

    for (const [sessionID, entry] of sessions.entries()) {
      const timeout = entry.timeout ?? SESSION_TIMEOUT_MS
      const inactive = now - entry.lastActivity

      // if no clients and it's been too long, bye bye
      if (entry.clients.length === 0 && inactive > timeout) {
        sessions.delete(sessionID)
        removed++
        log.info("session timed out", {
          sessionID,
          inactiveMs: inactive,
          timeoutMs: timeout,
        })
      }
    }

    if (removed > 0) {
      log.info("cleanup completed", { removed, remaining: sessions.size })
      persist().catch((err) => log.error("failed to persist after cleanup", { error: err }))
    }
  }

  // add a session to our registry
  export function register(session: Session.Info, instanceID?: string): SessionEntry {
    const existing = sessions.get(session.id)
    if (existing) {
      existing.lastActivity = Date.now()
      persist().catch((err) => log.error("failed to persist", { error: err }))
      return existing
    }

    const entry: SessionEntry = {
      sessionID: session.id,
      projectID: session.projectID,
      directory: session.directory,
      instanceID,
      createdAt: session.time.created,
      lastActivity: Date.now(),
      clients: [],
    }

    sessions.set(session.id, entry)
    log.info("session registered", { sessionID: session.id, directory: session.directory })
    persist().catch((err) => log.error("failed to persist", { error: err }))
    return entry
  }

  // connect a client to a session
  export function attachClient(
    sessionID: string,
    clientID: string,
    metadata?: { userAgent?: string; ipAddress?: string },
  ): boolean {
    const session = sessions.get(sessionID)
    if (!session) {
      log.warn("can't attach to non-existent session", { sessionID, clientID })
      return false
    }

    // add client to session if not already there
    if (!session.clients.includes(clientID)) {
      session.clients.push(clientID)
    }

    const now = Date.now()
    session.lastActivity = now

    const client: ClientInfo = {
      id: clientID,
      sessionID,
      connectedAt: clients.get(clientID)?.connectedAt ?? now,
      lastActivity: now,
      userAgent: metadata?.userAgent,
      ipAddress: metadata?.ipAddress,
    }

    clients.set(clientID, client)
    log.info("client attached", { sessionID, clientID, totalClients: session.clients.length })
    persist().catch((err) => log.error("failed to persist", { error: err }))
    return true
  }

  // disconnect a client from a session
  export function detachClient(sessionID: string, clientID: string): boolean {
    const session = sessions.get(sessionID)
    if (!session) return false

    const index = session.clients.indexOf(clientID)
    if (index > -1) {
      session.clients.splice(index, 1)
      log.info("client detached", { sessionID, clientID, remainingClients: session.clients.length })
    }

    clients.delete(clientID)
    persist().catch((err) => log.error("failed to persist", { error: err }))
    return true
  }

  // bump the activity timestamp for a session/client
  export function updateActivity(sessionID: string, clientID?: string) {
    const session = sessions.get(sessionID)
    if (session) {
      session.lastActivity = Date.now()
    }

    if (clientID) {
      const client = clients.get(clientID)
      if (client) {
        client.lastActivity = Date.now()
      }
    }
  }

  // get a single session
  export function getSession(sessionID: string): SessionEntry | undefined {
    return sessions.get(sessionID)
  }

  // get all sessions, sorted by most recent activity
  export function getAllSessions(): SessionEntry[] {
    return Array.from(sessions.values()).sort((a, b) => b.lastActivity - a.lastActivity)
  }

  // get only sessions with connected clients
  export function getActiveSessions(): SessionEntry[] {
    return getAllSessions().filter((s) => s.clients.length > 0)
  }

  // get info about a specific client
  export function getClient(clientID: string): ClientInfo | undefined {
    return clients.get(clientID)
  }

  // get all clients connected to a session
  export function getSessionClients(sessionID: string): ClientInfo[] {
    const session = sessions.get(sessionID)
    if (!session) return []

    return session.clients.map((id) => clients.get(id)).filter((c): c is ClientInfo => c !== undefined)
  }

  // make a new client id
  export function generateClientID(): string {
    return `client_${ulid()}`
  }

  // save everything to disk
  async function persist() {
    const data = {
      sessions: Array.from(sessions.entries()).map(([id, entry]) => ({ id, ...entry })),
      clients: Array.from(clients.entries()).map(([id, info]) => ({ id, ...info })),
      lastPersisted: Date.now(),
    }

    await Storage.write("session-registry", "global", data)
  }

  // load saved state from disk
  async function load() {
    try {
      const data = await Storage.read<{
        sessions: Array<{ id: string } & SessionEntry>
        clients: Array<{ id: string } & ClientInfo>
      }>("session-registry", "global")

      if (data?.sessions) {
        for (const { id, ...entry } of data.sessions) {
          sessions.set(id, entry)
        }
      }

      if (data?.clients) {
        for (const { id, ...info } of data.clients) {
          clients.set(id, info)
        }
      }

      log.info("loaded registry", {
        sessions: sessions.size,
        clients: clients.size,
      })
    } catch (err) {
      if (err instanceof Storage.NotFoundError) {
        log.info("no existing registry found, starting fresh")
      } else {
        log.error("failed to load registry", { error: err })
      }
    }
  }
}
