import { ElysiaApp, rateLimit } from "$src/index"
import { getClientIP } from "$lib/request"

export default (app: ElysiaApp) =>
	app
		.use(
			rateLimit({
				scoping: "scoped",
				duration: 3 * 60 * 1000,
				max: 300,
				errorResponse: "You've reached the 300 requests per 3 minutes limit.",
				generator: (req, server) => getClientIP(req, server),
				injectServer: () => app.server
			})
		)

		.get(
			":id",
			async () => {
				return { versions: "1" }
			},
			{
				detail: {
					tags: ["Data"],
					summary: "Script data",
					description:
						"Returns data for the script with the given ID. Work in progress: currently returns a placeholder. Rate limit: 300 requests per 3 minutes per IP.",
					responses: {
						200: {
							description: "Script data",
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: { versions: { type: "string" } },
										example: { versions: "1" }
									}
								}
							}
						},
						429: {
							description: "You are rate limited."
						}
					}
				}
			}
		)
