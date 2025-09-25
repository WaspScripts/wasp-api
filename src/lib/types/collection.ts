import { t } from "$src/index"
import { Static } from "elysia"
import { Database } from "./supabase"

export interface Limits {
	xp_min: Database["scripts"]["Tables"]["stats_limits"]["Row"]["xp_min"]
	xp_max: Database["scripts"]["Tables"]["stats_limits"]["Row"]["xp_max"]
	gp_min: Database["scripts"]["Tables"]["stats_limits"]["Row"]["gp_min"]
	gp_max: Database["scripts"]["Tables"]["stats_limits"]["Row"]["gp_max"]
}

export const StatsSchema = t.Object({
	experience: t.Number({ minimum: 0 }),
	gold: t.Number(),
	runtime: t.Number({ minimum: 0, maximum: 15 * 60 * 1000 })
})

export type StatsPayload = Static<typeof StatsSchema>

export interface ScriptStats {
	id: string
	experience: number
	gold: number
	runtime: number
}

export interface CachedLimits {
	limit: Limits
	timestamp: number
}
