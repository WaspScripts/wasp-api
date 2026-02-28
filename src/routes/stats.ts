import { ElysiaApp, rateLimit, t } from "$src/index"
import { setSession, upsertStats } from "$lib/supabase"
import { StatsSchema } from "$src/lib/types/collection"

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
				max: 3,
				errorResponse: "You've reached the 3 requests/min limit.",
				generator: async (req, server, { ip }) => Bun.hash(JSON.stringify(ip)).toString(),
				injectServer: () => app.server
			})
		)

		.post(
			":id",
			async ({ headers, params: { id }, body, status }) => {
				const { authorization, refreshtoken } = headers
				const access_token = authorization.split("Bearer ")[1]

				const { user, error } = await setSession(access_token, refreshtoken)
				if (error != null) return status(401, error)

				const { code, error: err } = await upsertStats(id, user, body)
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
							description: "You are rate limited."
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
