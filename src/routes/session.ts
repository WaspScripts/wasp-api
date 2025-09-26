import { ElysiaApp, rateLimit } from "$src/index"
import { createSession } from "$src/lib/supabase"

export default (app: ElysiaApp) =>
	app.get("", async ({ store, status }) => {
		const { session, error } = await createSession(store.email)

		if (error != null) {
			return status(400, error)
		}

		return { access_token: session.access_token, refresh_token: session.refresh_token }
	})
