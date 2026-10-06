import { ElysiaApp, rateLimit, t } from "$src/index"
import { createSession, setSession } from "$src/lib/supabase"
import { getClientIP } from "$lib/request"

const headers = t.Object({
	authorization: t.String({
		description: "Authorization token",
		examples: "Bearer abcdef012345...",
		error: "Authorization header is missing."
	}),
	refreshtoken: t.String({
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
				errorResponse: "You've reached the 3 requests per 3 minutes limit.",
				generator: (req, server) => getClientIP(req, server),
				injectServer: () => app.server
			})
		)
		.get(
			"",
			async ({ headers, status }) => {
				const { authorization, refreshtoken } = headers
				const access_token = authorization.split("Bearer ")[1]

				const { email, error } = await setSession(access_token, refreshtoken)
				if (error != null) return status(401, error)

				const { session, error: err } = await createSession(email)
				if (err != null) return status(403, err)

				return { access_token: session.access_token, refresh_token: session.refresh_token }
			},
			{
				headers,
				detail: {
					tags: ["Session"],
					summary: "Create session",
					security: [{ bearerAuth: [] }],
					description: `Creates a new WaspScripts session from an existing valid one.
The new session is independent of the one used to authenticate, so a script or client can keep its own session.
Your account must have an email address tied to it.

Rate limit: 3 requests per 3 minutes per IP.`,
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
						401: {
							description:
								"Authorization and/or RefreshToken headers are invalid or expired, or your account has no email."
						},
						403: {
							description:
								"Failed to create new session. The message includes a ref ID to report to support."
						},
						422: {
							description: "Authorization and/or RefreshToken headers are missing."
						},
						429: {
							description: "You are rate limited."
						}
					}
				}
			}
		)
