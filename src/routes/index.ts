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
		.get("", () => ({ url: process.env.SUPABASE_URL, anon_key: process.env.SUPABASE_ANON_KEY }), {
			detail: {
				tags: ["General"],
				summary: "Database connection info",
				description:
					"Returns the public Supabase URL and anon key that clients use to connect to the WaspScripts database. Rate limit: 100 requests per minute per IP.",
				responses: {
					200: {
						description: "Public database connection info",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										url: { type: "string", description: "Supabase project URL" },
										anon_key: { type: "string", description: "Supabase public anon key" }
									},
									required: ["url", "anon_key"]
								}
							}
						}
					},
					429: {
						description: "You are rate limited."
					}
				}
			}
		})
