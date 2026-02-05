import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ServerAuth } from "../auth"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"

const log = Log.create({ service: "auth-routes" })

export const AuthRoutes = lazy(() =>
  new Hono()
    .post(
      "/token",
      describeRoute({
        summary: "generate auth token",
        description: "create a new authentication token for remote access",
        operationId: "auth.generateToken",
        responses: {
          200: {
            description: "token created successfully",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    token: z.string(),
                    id: z.string(),
                    name: z.string(),
                    expiresAt: z.number(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          name: z.string().min(1).meta({ description: "name to identify this token" }),
          expiresInDays: z.number().optional().meta({ description: "token expiry in days (default: 30)" }),
        }),
      ),
      async (c) => {
        const { name, expiresInDays } = c.req.valid("json")
        const tokenInfo = ServerAuth.generateToken(name, expiresInDays)

        return c.json({
          token: tokenInfo.token,
          id: tokenInfo.id,
          name: tokenInfo.name,
          expiresAt: tokenInfo.expiresAt!,
        })
      },
    )
    .get(
      "/token",
      describeRoute({
        summary: "list auth tokens",
        description: "get all active authentication tokens",
        operationId: "auth.listTokens",
        responses: {
          200: {
            description: "list of tokens",
            content: {
              "application/json": {
                schema: resolver(ServerAuth.TokenInfo.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const tokens = ServerAuth.listTokens()
        return c.json(tokens)
      },
    )
    .delete(
      "/token/:id",
      describeRoute({
        summary: "revoke auth token",
        description: "revoke an authentication token",
        operationId: "auth.revokeToken",
        responses: {
          200: {
            description: "token revoked",
            content: {
              "application/json": {
                schema: resolver(z.object({ success: z.boolean() })),
              },
            },
          },
        },
      }),
      validator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        const success = ServerAuth.revokeToken(id)
        return c.json({ success })
      },
    )
    .post(
      "/validate",
      describeRoute({
        summary: "validate token",
        description: "check if a token is valid",
        operationId: "auth.validateToken",
        responses: {
          200: {
            description: "validation result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    valid: z.boolean(),
                    error: z.string().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          token: z.string(),
        }),
      ),
      async (c) => {
        const { token } = c.req.valid("json")
        const result = ServerAuth.validateToken(token)
        return c.json({
          valid: result.valid,
          error: result.error,
        })
      },
    ),
)
