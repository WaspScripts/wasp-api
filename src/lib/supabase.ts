import { createClient } from "@supabase/supabase-js"
import { Database, Json } from "./types/supabase"
import {
	CachedLimit,
	CachedScript,
	OnlineUsers,
	Script,
	ScriptStats,
	StatsPayload
} from "./types/collection"

export const CACHE_TIMEOUT = 2 * 60 * 1000

export const supabase = createClient<Database>(process.env.URL, process.env.ANON_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
})

const scripts: Map<string, CachedScript> = new Map()
const limits: Map<string, CachedLimit> = new Map()

export async function upsertStats(id: string, statsPayload: StatsPayload) {}
