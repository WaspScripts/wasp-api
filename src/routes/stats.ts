import { ElysiaApp, rateLimit, t } from "$src/index"
import { upsertStats } from "$lib/supabase"
import { StatsSchema } from "$src/lib/types/collection"

const uuid = t.Object({
	id: t.String({
		format: "uuid",
		description: "Stats account UUID",
		examples: "7d081fdd-59de-4a4e-9c29-b2f92d9bc697",
		error: "ID must be a valid UUID V4."
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
			async ({ store, params: { id }, body, status }) => {
				const { error } = await upsertStats(id, store.user, body)

				if (error) {
					return status(400, error)
				}

				return "User and script stats were successfully updated!"
			},
			{
				params: uuid,
				body: StatsSchema
			}
		)
