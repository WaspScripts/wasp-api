import { Elysia } from "elysia"
import { swagger } from "@elysiajs/swagger"
import { serverTiming } from "@elysiajs/server-timing"
import { autoroutes } from "elysia-autoroutes"
import { ip } from "elysia-ip"
import { supabase } from "./lib/supabase"
export { t } from "elysia"
export { rateLimit } from "elysia-rate-limit"

console.log(`🔥 wasp-api is starting...`)

const app = new Elysia().state("user", "").state("email", "")

app.onRequest(async ({ store, request, status }) => {
	const url = new URL(request.url)
	const path = url.pathname
	if (path === "/docs" || path === "/docs/" || path === "/docs/json" || path === "/docs/json/") {
		return
	}

	const authorization = request.headers.get("Authorization")
	if (!authorization) {
		return status(401, "Authorization header is missing.")
	}

	const refresh_token = request.headers.get("RefreshToken")
	if (!refresh_token) {
		return status(401, "RefreshToken header is missing.")
	}

	const access_token = authorization.split("Bearer ")[1]

	const {
		data: { user, session },
		error: err
	} = await supabase.auth.setSession({ access_token, refresh_token })
	if (err) {
		return status(
			401,
			`AuthError Code: ${err.code} Name: ${err.name} Status: ${err.status} Message: ${err.message}`
		)
	}

	if (!user || !session) {
		return status(401, "Invalid Session.")
	}

	if (!user.email) {
		return status(401, "Your account needs an email tied to your account to submit stats")
	}

	store.user = user.id
	store.email = user.email
})

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

app.use(ip({ headersOnly: true }))

app.use(autoroutes())

app.use(
	swagger({
		documentation: {
			info: {
				title: "Wasp API Documentation",
				version: "2.0.0",
				description: "Documentation on the wapscripts.com API project",
				contact: {
					email: "support@waspscripts.com",
					name: "Torwent",
					url: "https://waspscripts.dev"
				},
				license: { name: "GPLv3", url: "https://github.com/WaspScripts/wasp-api/LICENSE" }
			}
		},
		scalarConfig: { spec: { url: "/docs/json" } },
		path: "/docs",
		exclude: ["/docs", "/docs/json"]
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
