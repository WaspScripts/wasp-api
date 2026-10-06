import { rateLimit, type ElysiaApp } from "$src/index"
import { getClientIP } from "$lib/request"
export default (app: ElysiaApp) =>
	app
		.use(
			rateLimit({
				scoping: "scoped",
				duration: 60 * 1000,
				max: 100,
				errorResponse: "👋 You've reached the 100 requests/min limit.",
				generator: (req, server) => getClientIP(req, server),
				injectServer: () => app.server
			})
		)
		.get("", () => ({ url: process.env.SUPABASE_URL, anon_key: process.env.SUPABASE_ANON_KEY }))
