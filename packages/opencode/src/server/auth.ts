import { Log } from "../util/log"
import { Storage } from "../storage/storage"
import { ulid } from "ulid"
import z from "zod"
import { NamedError } from "@opencode-ai/util/error"
import type { Context } from "hono"

export namespace ServerAuth {
  const log = Log.create({ service: "auth" })

  // everything we track about a token
  export const TokenInfo = z.object({
    id: z.string(),
    token: z.string(),
    name: z.string(),
    createdAt: z.number(),
    expiresAt: z.number().optional(),
    lastUsed: z.number().optional(),
    revokedAt: z.number().optional(),
  })
  export type TokenInfo = z.infer<typeof TokenInfo>

  // errors that can happen during auth
  export const AuthError = NamedError.create(
    "AuthError",
    z.object({
      message: z.string(),
      code: z.enum(["INVALID_TOKEN", "EXPIRED_TOKEN", "REVOKED_TOKEN", "MISSING_TOKEN"]),
    }),
  )

  const tokens = new Map<string, TokenInfo>()
  const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

  // load up any saved tokens
  export async function init() {
    await load()
    log.info("initialized", { tokenCount: tokens.size })
  }

  // create a new auth token
  export function generateToken(name: string, expiresInDays?: number): TokenInfo {
    const id = ulid()
    const token = `oc_${ulid()}_${ulid()}`
    const now = Date.now()
    const expiresAt = expiresInDays ? now + expiresInDays * 24 * 60 * 60 * 1000 : now + TOKEN_EXPIRY_MS

    const info: TokenInfo = {
      id,
      token,
      name,
      createdAt: now,
      expiresAt,
    }

    tokens.set(token, info)
    log.info("token generated", { id, name, expiresAt: new Date(expiresAt).toISOString() })
    persist().catch((err) => log.error("failed to persist", { error: err }))

    return info
  }

  // check if a token is valid
  export function validateToken(token: string): { valid: boolean; info?: TokenInfo; error?: string } {
    const info = tokens.get(token)

    if (!info) {
      return { valid: false, error: "invalid token" }
    }

    if (info.revokedAt) {
      return { valid: false, error: "token has been revoked" }
    }

    if (info.expiresAt && Date.now() > info.expiresAt) {
      return { valid: false, error: "token has expired" }
    }

    // update last used timestamp
    info.lastUsed = Date.now()
    persist().catch((err) => log.error("failed to persist", { error: err }))

    return { valid: true, info }
  }

  // revoke a token so it can't be used anymore
  export function revokeToken(tokenOrId: string): boolean {
    let info = tokens.get(tokenOrId)

    // might be an id instead of the token itself
    if (!info) {
      for (const t of tokens.values()) {
        if (t.id === tokenOrId) {
          info = t
          break
        }
      }
    }

    if (!info) {
      log.warn("token not found for revocation", { tokenOrId })
      return false
    }

    info.revokedAt = Date.now()
    log.info("token revoked", { id: info.id, name: info.name })
    persist().catch((err) => log.error("failed to persist", { error: err }))

    return true
  }

  // get all active tokens
  export function listTokens(): TokenInfo[] {
    return Array.from(tokens.values())
      .filter((t) => !t.revokedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  // find a specific token
  export function getToken(tokenOrId: string): TokenInfo | undefined {
    let info = tokens.get(tokenOrId)
    if (!info) {
      for (const t of tokens.values()) {
        if (t.id === tokenOrId) {
          info = t
          break
        }
      }
    }
    return info
  }

  // remove old expired tokens we don't need anymore
  export function cleanupExpired(): number {
    const now = Date.now()
    let removed = 0

    for (const [token, info] of tokens.entries()) {
      if (info.expiresAt && now > info.expiresAt && info.revokedAt) {
        tokens.delete(token)
        removed++
      }
    }

    if (removed > 0) {
      log.info("expired tokens cleaned up", { removed })
      persist().catch((err) => log.error("failed to persist", { error: err }))
    }

    return removed
  }

  // middleware to check auth on requests
  export function middleware() {
    return async (c: Context, next: () => Promise<void>) => {
      // skip auth if not enabled
      const authEnabled = process.env.OPENCODE_AUTH_ENABLED === "true"
      if (!authEnabled) {
        return next()
      }

      // some paths don't need auth
      const skipPaths = ["/health", "/openapi"]
      if (skipPaths.some((path) => c.req.path.startsWith(path))) {
        return next()
      }

      // look for the token in header or query
      const authHeader = c.req.header("Authorization")
      const queryToken = c.req.query("token")

      let token: string | undefined

      if (authHeader) {
        // handle "Bearer <token>" or just "<token>"
        const match = authHeader.match(/^Bearer\s+(.+)$/i)
        token = match ? match[1] : authHeader
      } else if (queryToken) {
        token = queryToken
      }

      if (!token) {
        throw new AuthError({
          message: "authentication required",
          code: "MISSING_TOKEN",
        })
      }

      const validation = validateToken(token)
      if (!validation.valid) {
        let code: "INVALID_TOKEN" | "EXPIRED_TOKEN" | "REVOKED_TOKEN" = "INVALID_TOKEN"
        if (validation.error?.includes("expired")) code = "EXPIRED_TOKEN"
        if (validation.error?.includes("revoked")) code = "REVOKED_TOKEN"

        throw new AuthError({
          message: validation.error ?? "invalid token",
          code,
        })
      }

      // stash token info for later use
      c.set("authToken", validation.info)

      return next()
    }
  }

  // save tokens to disk
  async function persist() {
    const data = {
      tokens: Array.from(tokens.values()),
      lastPersisted: Date.now(),
    }

    await Storage.write("auth-tokens", "global", data)
  }

  // load tokens from disk
  async function load() {
    try {
      const data = await Storage.read<{
        tokens: TokenInfo[]
      }>("auth-tokens", "global")

      if (data?.tokens) {
        for (const info of data.tokens) {
          tokens.set(info.token, info)
        }
      }

      log.info("loaded tokens", { count: tokens.size })
    } catch (err) {
      if (err instanceof Storage.NotFoundError) {
        log.info("no existing tokens found, starting fresh")
      } else {
        log.error("failed to load tokens", { error: err })
      }
    }
  }
}
