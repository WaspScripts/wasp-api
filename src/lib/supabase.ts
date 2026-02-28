import { createClient } from "@supabase/supabase-js"
import { Database } from "./types/supabase"
import { CachedLimits, StatsPayload } from "./types/collection"

export const CACHE_TIMEOUT = 2 * 60 * 1000

export const supabase = createClient<Database>(process.env.URL, process.env.ANON_KEY)
const supabaseAdmin = createClient<Database>(process.env.URL, process.env.SERVICE_KEY)

const limits: Map<string, CachedLimits> = new Map()

export async function setSession(access_token: string, refresh_token: string) {
	const {
		data: { user, session },
		error: err
	} = await supabase.auth.setSession({ access_token, refresh_token })

	if (err) {
		return {
			user: null,
			email: null,
			error: `AuthError Code: ${err.code} Name: ${err.name} Status: ${err.status} Message: ${err.message}`
		}
	}

	if (!user || !session) return { email: null, error: "Invalid Session." }

	if (!user.email) {
		return {
			user: null,
			email: null,
			error: "Your account needs an email tied to your account to submit stats"
		}
	}

	return { user: user.id, email: user.email, error: null }
}

export async function createSession(email: string) {
	const { data, error } = await supabaseAdmin.auth.admin.generateLink({
		type: "magiclink",
		email: email
	})
	if (error) {
		console.error("AuthAdminError: " + JSON.stringify(error))
		return {
			session: null,
			error: `AuthAdminError Code: ${error.code} Name: ${error.name} Status: ${error.status} Message: ${error.message}`
		}
	}

	const {
		data: { session },
		error: err
	} = await supabase.auth.verifyOtp({
		token_hash: data.properties.hashed_token,
		type: "magiclink"
	})

	if (err) {
		console.error("AuthError: " + JSON.stringify(err))
		return {
			session: null,
			error: `AuthError Code: ${err.code} Name: ${err.name} Status: ${err.status} Message: ${err.message}`
		}
	}
	if (!session) {
		return {
			session: null,
			error: `AuthError Session was not created.`
		}
	}

	return { session, error: null }
}

async function getAccess(id: string) {
	const { data, error: err } = await supabase
		.schema("profiles")
		.rpc("can_access", { script_id: id })

	if (err) {
		return {
			error: `PostgrestError Code: ${err.code} Name: ${err.name} Status: ${err.hint} Details: ${err.details} Message: ${err.message}`
		}
	}

	if (!data) {
		return {
			error: "You do not have access to this script. Please consider supporting their creators."
		}
	}
	return { error: null }
}

async function getLimits(id: string) {
	const now = Date.now()
	const cached = limits.get(id)
	if (cached && now - cached.timestamp < CACHE_TIMEOUT) {
		return { limits: cached.limit, error: null }
	}

	const { data, error } = await supabase
		.schema("stats")
		.from("limits")
		.select("xp_min, xp_max, gp_min, gp_max")
		.eq("id", id)
		.single()

	if (error) {
		console.error(error)
		return {
			limits: null,
			error: `PostgrestError Code: ${error.code} Name: ${error.name} Status: ${error.hint} Details: ${error.details} Message: ${error.message}`
		}
	}

	return { limits: data, error: null }
}

async function updateScriptStats(id: string, payload: StatsPayload) {
	const { data, error } = await supabase
		.schema("stats")
		.from("values")
		.select("experience, gold, runtime")
		.eq("id", id)
		.single()

	if (error) {
		console.error(error)
		return {
			error: `PostgrestError Code: ${error.code} Name: ${error.name} Status: ${error.hint} Details: ${error.details} Message: ${error.message}`
		}
	}

	data.experience += payload.experience
	data.gold += payload.gold
	data.runtime += payload.runtime

	const { error: err } = await supabaseAdmin
		.schema("stats")
		.from("values")
		.update(data)
		.eq("id", id)

	if (err) {
		console.error(err)
		return {
			error: `PostgrestError Code: ${err.code} Name: ${err.name} Status: ${err.hint} Details: ${err.details} Message: ${err.message}`
		}
	}
	return { error: null }
}

async function upsertUserStats(user_id: string, payload: StatsPayload) {
	const { data, error } = await supabase
		.schema("stats")
		.from("stats")
		.select("experience, gold, runtime")
		.eq("id", user_id)
		.maybeSingle()

	if (error) {
		console.error(error)
		return {
			error: `PostgrestError Code: ${error.code} Name: ${error.name} Status: ${error.hint} Details: ${error.details} Message: ${error.message}`
		}
	}

	const { error: err } = await supabaseAdmin
		.schema("stats")
		.from("stats")
		.upsert({
			id: user_id,
			experience: payload.experience + (data?.experience ?? 0),
			gold: payload.gold + (data?.gold ?? 0),
			runtime: payload.runtime + (data?.runtime ?? 0)
		})

	if (err) {
		console.error(err)
		return {
			error: `PostgrestError Code: ${err.code} Name: ${err.name} Status: ${err.hint} Details: ${err.details} Message: ${err.message}`
		}
	}
	return { error: null }
}

async function update_online_status(id: string, user_id: string) {
	const { error } = await supabase.schema("stats").from("online").upsert({
		script_id: id,
		user_id: user_id,
		last_seen: new Date().toISOString()
	})

	if (error) {
		console.error(error)
		return {
			error: `PostgrestError Code: ${error.code} Name: ${error.name} Status: ${error.hint} Details: ${error.details} Message: ${error.message}`
		}
	}

	return { error: null }
}

export async function upsertStats(id: string, user_id: string, payload: StatsPayload) {
	const promises = await Promise.all([
		getAccess(id),
		getLimits(id),
		update_online_status(id, user_id)
	])

	const { error: errAccess } = promises[0]
	if (errAccess != null) return { error: errAccess }

	const { limits, error } = promises[1]
	if (error != null) return { error }

	const { error: errOnline } = promises[2]
	if (errOnline != null) return { error: errOnline }

	if (payload.experience < limits.xp_min) {
		return { error: "Reported experience is less than the script aproved limits!" }
	}

	if (payload.experience > limits.xp_max) {
		return { error: "Reported experience is more than the script aproved limits!" }
	}

	if (payload.gold < limits.gp_min) {
		return { error: "Reported gold is less than the script aproved limits!" }
	}

	if (payload.gold > limits.gp_max) {
		return { error: "Reported gold is more than the script aproved limits!" }
	}

	if (payload.runtime === 0) payload.runtime = 5000
	if (payload.runtime < 1000 || payload.runtime > 15 * 60 * 1000) {
		return { error: "Reported runtime is not within the aproved limits!" }
	}

	if (payload.experience === 0 && payload.gold === 0) {
		return { error: "No experience nor gold was reported!" }
	}

	const submissions = await Promise.all([
		updateScriptStats(id, payload),
		upsertUserStats(user_id, payload)
	])

	if (submissions[0].error) return { error: submissions[0].error }
	if (submissions[1].error) return { error: submissions[1].error }

	return { error: null }
}
