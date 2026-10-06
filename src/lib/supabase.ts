import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types/supabase"
import { CachedLimits, StatsPayload } from "./types/collection"
import { logError } from "./request"
import { validateStats } from "./validation"

export const CACHE_TIMEOUT = 2 * 60 * 1000

const authOptions = {
	auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}

export const supabase = createClient<Database>(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_ANON_KEY,
	authOptions
)

const supabaseAdmin = createClient<Database>(
	process.env.SUPABASE_URL,
	process.env.SUPABASE_SERVICE_KEY,
	authOptions
)

function createUserClient() {
	return createClient<Database>(
		process.env.SUPABASE_URL,
		process.env.SUPABASE_ANON_KEY,
		authOptions
	)
}

type Client = ReturnType<typeof createUserClient>

const limits: Map<string, CachedLimits> = new Map()

export async function setSession(access_token: string, refresh_token: string) {
	const client = createUserClient()
	const {
		data: { user, session },
		error: err
	} = await client.auth.setSession({ access_token, refresh_token })

	if (err) {
		return {
			client: null,
			user: null,
			email: null,
			error: logError("Your session is invalid or has expired. Please log in again.", err)
		}
	}

	if (!user || !session) return { client: null, user: null, email: null, error: "Invalid Session." }

	if (!user.email) {
		return {
			client: null,
			user: null,
			email: null,
			error: "Your account needs an email tied to your account to submit stats"
		}
	}

	return { client, user: user.id, email: user.email, error: null }
}

export async function createSession(email: string) {
	const { data, error } = await supabaseAdmin.auth.admin.generateLink({
		type: "magiclink",
		email: email
	})
	if (error) {
		return { session: null, error: logError("Failed to create a new session.", error) }
	}

	const {
		data: { session },
		error: err
	} = await createUserClient().auth.verifyOtp({
		token_hash: data.properties.hashed_token,
		type: "magiclink"
	})

	if (err) {
		return { session: null, error: logError("Failed to create a new session.", err) }
	}
	if (!session) {
		return {
			session: null,
			error: logError("Failed to create a new session.", "No session returned")
		}
	}

	return { session, error: null }
}

async function getAccess(client: Client, id: string) {
	const { data, error: err } = await client.schema("profiles").rpc("can_access", { script_id: id })

	if (err) {
		return { code: 500, error: logError("Failed to check your access to this script.", err) }
	}

	if (!data) {
		return {
			code: 403,
			error: "You do not have access to this script. Please consider supporting their creators."
		}
	}
	return { code: 200, error: null }
}

async function getLimits(id: string) {
	const now = Date.now()
	const cached = limits.get(id)
	if (cached && now - cached.timestamp < CACHE_TIMEOUT) {
		return { code: 200, limits: cached.limit, error: null }
	}

	const { data, error } = await supabase
		.schema("stats")
		.from("limits")
		.select("xp_min, xp_max, gp_min, gp_max")
		.eq("id", id)
		.single()

	if (error) {
		// PGRST116: no rows found
		if (error.code === "PGRST116") {
			return {
				code: 404,
				limits: null,
				error: "This script doesn't exist or doesn't accept stats yet."
			}
		}
		return { code: 500, limits: null, error: logError("Failed to load the script limits.", error) }
	}

	limits.set(id, { limit: data, timestamp: now })
	return { code: 200, limits: data, error: null }
}

async function updateScriptStats(id: string, payload: StatsPayload) {
	const { error } = await supabaseAdmin.schema("stats").rpc("increment_script_stats", {
		script_id: id,
		add_experience: payload.experience,
		add_gold: payload.gold,
		add_runtime: payload.runtime
	})

	if (error) return { error: logError("Failed to update the script stats.", error) }
	return { error: null }
}

async function upsertUserStats(user_id: string, payload: StatsPayload) {
	const { error } = await supabaseAdmin.schema("stats").rpc("increment_user_stats", {
		user_id,
		add_experience: payload.experience,
		add_gold: payload.gold,
		add_runtime: payload.runtime
	})

	if (error) return { error: logError("Failed to update your stats.", error) }
	return { error: null }
}

async function update_online_status(id: string, user_id: string) {
	const { error } = await supabaseAdmin.schema("stats").from("online").upsert({
		script_id: id,
		user_id: user_id,
		last_seen: new Date().toISOString()
	})

	if (error) return { error: logError("Failed to update your online status.", error) }

	return { error: null }
}

export async function upsertStats(
	client: Client,
	id: string,
	user_id: string,
	payload: StatsPayload
) {
	const [access, { code: codeLimits, limits, error: errLimits }] = await Promise.all([
		getAccess(client, id),
		getLimits(id)
	])

	if (access.error != null) return { code: access.code, error: access.error }

	const { error: errOnline } = await update_online_status(id, user_id)
	if (errOnline != null) return { code: 502, error: errOnline }

	if (errLimits != null) return { code: codeLimits, error: errLimits }

	console.log("Payload: ", payload)

	if (payload.runtime === 0) payload.runtime = 5000
	const invalid = validateStats(limits, payload)
	if (invalid != null) return { code: 406, error: invalid }

	const submissions = await Promise.all([
		updateScriptStats(id, payload),
		upsertUserStats(user_id, payload)
	])

	if (submissions[0].error && submissions[1].error) {
		return { code: 514, error: submissions[0].error + "\n\n" + submissions[1].error }
	}

	if (submissions[0].error) return { code: 512, error: submissions[0].error }
	if (submissions[1].error) return { code: 513, error: submissions[1].error }

	return { code: 200, error: null }
}
