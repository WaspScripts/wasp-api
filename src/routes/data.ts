import { ElysiaApp, rateLimit, t } from "$src/index"

export default (app: ElysiaApp) =>
	app
		.use(
			rateLimit({
				scoping: "scoped",
				duration: 3 * 60 * 1000,
				max: 300,
				errorResponse: "You've reached the 300 requests/min limit.",
				generator: async (req, server, { ip }) => Bun.hash(JSON.stringify(ip)).toString(),
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
					description: "...",
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
