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

				const { error: err } = await upsertStats(id, user, body)
				if (err) return status(400, err)

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
						400: {
							description: "Failed to create session"
						}
					}
				}
			}
		)
