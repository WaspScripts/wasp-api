import { ElysiaApp, rateLimit, t } from "$src/index"
import { setSession, upsertStats } from "$lib/supabase"
import { StatsSchema } from "$src/lib/types/collection"
import { createLimiter, getClientIP } from "$lib/request"

const userLimiter = createLimiter(3, 3 * 60 * 1000)

const uuid = t.Object({
	id: t.String({
		format: "uuid",
		description: "Stats account UUID",
		examples: "7d081fdd-59de-4a4e-9c29-b2f92d9bc697",
		error: "ID must be a valid UUID V4."
	})
})
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
				max: 30,
				errorResponse: "You've reached the 30 requests per 3 minutes limit for your IP.",
				generator: (req, server) => getClientIP(req, server),
				injectServer: () => app.server
			})
		)

		.post(
			":id",
			async ({ headers, params: { id }, body, status }) => {
				const { authorization, refreshtoken } = headers
				const access_token = authorization.split("Bearer ")[1]

				const { client, user, error } = await setSession(access_token, refreshtoken)
				if (error != null) return status(401, error)

				if (!userLimiter(`${user}:${id}`)) {
					return status(
						429,
						"You've reached the 3 submissions per 3 minutes limit for this script."
					)
				}

				const { code, error: err } = await upsertStats(client, id, user, body)
				if (err) return status(code, err)

				return "User and script stats were successfully updated!"
			},
			{
				headers,
				params: uuid,
				body: StatsSchema,
				detail: {
					description:
						"Send your stats. This will update both the user personal stats and the script stats.",
					responses: {
						200: {
							description: "User and script stats were successfully updated!",
							content: {
								"application/json": {
									schema: {
										type: "string",
										example: "User and script stats were successfully updated!"
									}
								}
							}
						},
						401: {
							description: "Authorization and/or RefreshToken headers are invalid."
						},
						403: {
							description: "You are not allowed to submit stats to this script."
						},
						404: {
							description: "The script you want to submit stats to doesn't exist."
						},
						406: {
							description:
								"The data stats you reported are not within the script acceptable limits."
						},
						429: {
							description:
								"You are rate limited: 3 submissions per 3 minutes per script, 30 requests per 3 minutes per IP."
						},
						500: {
							description:
								"The server failed to check your access or the script limits. The message includes a ref ID to report to support."
						},
						502: {
							description: "The server failed to update your online status."
						},
						512: {
							description: "The server failed to update the script stats."
						},
						513: {
							description: "The server failed to update your stats."
						},

						514: {
							description: "The server failed to update both your stats and the script stats."
						}
					}
				}
			}
		)
