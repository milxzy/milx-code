import { cmd } from "./cmd"
import { ServerAuth } from "../../server/auth"
import { Log } from "../../util/log"

const log = Log.create({ service: "token-cli" })

export const TokenCommand = cmd({
  command: "token",
  describe: "manage authentication tokens for remote access",
  builder: (yargs) =>
    yargs
      .command({
        command: "generate",
        describe: "generate a new authentication token",
        builder: (yargs) =>
          yargs
            .option("name", {
              type: "string",
              describe: "name to identify this token (e.g., 'my phone')",
              demandOption: true,
            })
            .option("expires", {
              type: "number",
              describe: "token expiry in days (default: 30)",
              default: 30,
            }),
        handler: async (args) => {
          await ServerAuth.init()
          const token = ServerAuth.generateToken(args.name as string, args.expires as number)

          console.log("\ntoken generated successfully!\n")
          console.log("token:", token.token)
          console.log("id:", token.id)
          console.log("name:", token.name)
          console.log("expires:", new Date(token.expiresAt!).toISOString())
          console.log("\nsave this token securely - it won't be shown again!")
          console.log("use it in your mobile client or add to authorization header:\n")
          console.log(`  authorization: bearer ${token.token}\n`)
        },
      })
      .command({
        command: "list",
        describe: "list all active authentication tokens",
        handler: async () => {
          await ServerAuth.init()
          const tokens = ServerAuth.listTokens()

          if (tokens.length === 0) {
            console.log("\nno active tokens found.\n")
            console.log("generate a token with: opencode token generate --name 'my device'\n")
            return
          }

          console.log(`\nactive tokens (${tokens.length}):\n`)
          for (const token of tokens) {
            const expired = token.expiresAt && Date.now() > token.expiresAt
            const expiresIn = token.expiresAt
              ? Math.floor((token.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
              : null

            console.log(`id: ${token.id}`)
            console.log(`  name: ${token.name}`)
            console.log(`  created: ${new Date(token.createdAt).toISOString()}`)
            if (token.expiresAt) {
              if (expired) {
                console.log(`  status: expired`)
              } else {
                console.log(`  expires in: ${expiresIn} days`)
              }
            }
            if (token.lastUsed) {
              console.log(`  last used: ${new Date(token.lastUsed).toISOString()}`)
            }
            console.log()
          }
        },
      })
      .command({
        command: "revoke <id>",
        describe: "revoke an authentication token",
        builder: (yargs) =>
          yargs.positional("id", {
            type: "string",
            describe: "token id to revoke",
          }),
        handler: async (args) => {
          await ServerAuth.init()
          const success = ServerAuth.revokeToken(args.id as string)

          if (success) {
            console.log(`\ntoken ${args.id} has been revoked.\n`)
          } else {
            console.log(`\ntoken ${args.id} not found.\n`)
            process.exit(1)
          }
        },
      })
      .command({
        command: "cleanup",
        describe: "remove expired and revoked tokens",
        handler: async () => {
          await ServerAuth.init()
          const removed = ServerAuth.cleanupExpired()
          console.log(`\ncleaned up ${removed} expired tokens.\n`)
        },
      })
      .demandCommand(1, "you must specify a subcommand (generate, list, revoke, or cleanup)"),
  handler: () => {
    // parent command handler - subcommand will be called instead
  },
})
