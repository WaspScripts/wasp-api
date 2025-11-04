import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { serverTiming } from "@elysiajs/server-timing"
import { ip } from "elysia-ip"
import openapi from "@elysiajs/openapi"
import { autoload } from "elysia-autoload"
export { t } from "elysia"
export { rateLimit } from "elysia-rate-limit"

console.log(`🔥 wasp-api is starting...`)

const app = new Elysia()

app.onAfterResponse((response) => {
	const { request, path, set } = response
	if (path === "/docs" || path === "/docs/" || path === "/docs/json" || path === "/docs/json/")
		return

	const ip = request.headers.get("cf-connecting-ip")
	const userAgent = request.headers.get("user-agent")
	const timestamp = new Date().toISOString().replace("T", " ").replace("Z", "")

	console.log(
		`[${timestamp}]: [${set.status}] ${userAgent} ${ip ?? "NO_IP" + " "}- ${request.method} ${path}`
	)
})

app.use(cors())

app.use(ip({ headersOnly: true }))

app.use(
	openapi({
		documentation: {
			info: {
				title: "WaspScripts API Documentation",
				version: "2.0.0",
				description: "Documentation on the wapscripts.dev API project",
				contact: {
					email: "support@waspscripts.dev",
					name: "Torwent",
					url: "https://waspscripts.dev"
				},
				license: { name: "GPLv3", url: "https://github.com/WaspScripts/wasp-api/LICENSE" }
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
	maxRequestBodySize: Number.MAX_SAFE_INTEGER
})

export type ElysiaApp = typeof app

console.log(`🦊 wasp-api is running at ${app.server!.url}`)
console.log(`📚 Documentation live at ${app.server!.url}docs`)
