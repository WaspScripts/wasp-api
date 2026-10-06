import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { serverTiming } from "@elysiajs/server-timing"
import { getClientIP } from "$lib/request"
import openapi from "@elysiajs/openapi"
import { autoload } from "elysia-autoload"
export { t } from "elysia"
export { rateLimit } from "elysia-rate-limit"

console.log(`🔥 wasp-api is starting...`)

const app = new Elysia()

app.onAfterResponse((response) => {
	const { request, path, set, server } = response
	if (path === "/docs" || path === "/docs/" || path === "/docs/json" || path === "/docs/json/")
		return

	const ip = getClientIP(request, server)
	const userAgent = request.headers.get("user-agent")
	const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "")

	console.log(`[${timestamp}]: [${set.status}] ${userAgent} ${ip} - ${request.method} ${path}`)
})

app.use(cors())

app.use(
	openapi({
		documentation: {
			info: {
				title: "WaspScripts API Documentation",
				version: "2.0.0",
				description: `Documentation for the [waspscripts.dev](https://waspscripts.dev) API.

## Authentication
Authenticated endpoints need two headers from a WaspScripts (Supabase) session:
- \`Authorization: Bearer <access_token>\`
- \`RefreshToken: <refresh_token>\`

Your account must have an email address tied to it.

## Rate limits
Rate limits apply per IP and differ per endpoint (see each endpoint).
Responses include \`RateLimit-Limit\`, \`RateLimit-Remaining\` and \`RateLimit-Reset\` headers.
When you're rate limited, you get a \`429\` with a \`Retry-After\` header (seconds).

## Errors
Errors return a plain text message. Server errors include a \`(ref: xxxxxxxx)\` ID.
Include that ID when you report the issue to support.
Requests with missing or invalid headers, params or body return \`422\`.`,
				contact: {
					email: "support@waspscripts.dev",
					name: "Torwent",
					url: "https://waspscripts.dev"
				},
				license: {
					name: "GPLv3",
					url: "https://github.com/WaspScripts/wasp-api/blob/main/LICENSE"
				}
			},
			tags: [
				{ name: "General", description: "Public API information" },
				{ name: "Session", description: "WaspScripts session management" },
				{ name: "Stats", description: "Script and user stats submission" },
				{ name: "Data", description: "Script data" }
			],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						description: "Supabase access token of your WaspScripts session."
					}
				}
			}
		},
		path: "/docs"
		//exclude: ["/docs", "/docs/json"]
	})
)

app.use(
	await autoload({
		dir: "./routes",
		ignore: ["**/*.test.ts", "**/*.spec.ts"]
	})
)

app.use(serverTiming())

app.listen({
	hostname: process.env.DOMAIN ?? "0.0.0.0",
	port: process.env.PORT ?? 3000,
	maxRequestBodySize: 1024 * 1024
})

export type ElysiaApp = typeof app

console.log(`🦊 wasp-api is running at ${app.server!.url}`)
console.log(`📚 Documentation live at ${app.server!.url}docs`)
