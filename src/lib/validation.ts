import type { Limits, StatsPayload } from "./types/collection"

export const MIN_RUNTIME = 1000
export const MAX_RUNTIME = 15 * 60 * 1000

export function validateStats(limits: Limits, payload: StatsPayload) {
	if (payload.experience < limits.xp_min) {
		return "Reported experience is less than the script approved limits!"
	}

	if (payload.experience > limits.xp_max) {
		return "Reported experience is more than the script approved limits!"
	}

	if (payload.gold < limits.gp_min) {
		return "Reported gold is less than the script approved limits!"
	}

	if (payload.gold > limits.gp_max) {
		return "Reported gold is more than the script approved limits!"
	}

	if (payload.runtime < MIN_RUNTIME || payload.runtime > MAX_RUNTIME) {
		return "Reported runtime is not within the approved limits!"
	}

	if (payload.experience === 0 && payload.gold === 0) {
		return "No experience nor gold was reported!"
	}

	return null
}
