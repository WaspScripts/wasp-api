import { ElysiaApp, rateLimit, t } from "$src/index"
import { createSession, setSession } from "$src/lib/supabase"

const headers = t.Object({
	Authorization: t.String({
		description: "Authorization token",
		examples: "Bearer abcdef012345...",
		error: "Authorization header is missing."
	}),
	RefreshToken: t.String({
		description: "Refresh session token",
		examples: "a24shj127gfi",
		error: "RefreshToken header is missing."
	})
})

export default (app: ElysiaApp) =>
	app
		.use(
			rateLimit({
				scoping: "scoped",
				duration: 3 * 60 * 1000,
				max: 3,
				errorResponse: "You've reached the 3 requests/min limit.",
				generator: async (req, server, { ip }) => Bun.hash(JSON.stringify(ip)).toString(),
				injectServer: () => app.server
			})
		)
		.get(
			"",
			async ({ headers, status }) => {
				const { Authorization, RefreshToken } = headers
				const access_token = Authorization.split("Bearer ")[1]

				const { email, error } = await setSession(access_token, RefreshToken)
				if (error != null) return status(401, error)

				const { session, error: err } = await createSession(email)
				if (err != null) return status(400, error)

				return { access_token: session.access_token, refresh_token: session.refresh_token }
			},
			{
				headers,
				detail: {
					description: `Creates a new WaspScripts session.`,
					responses: {
						200: {
							description: "Session created successfully",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											access_token: { type: "string" },
											refresh_token: { type: "string" }
										},
										required: ["access_token", "refresh_token"]
									}
								}
							}
						},
						400: {
							description: "Failed to create session"
						}
					}
				}
			}
		)
