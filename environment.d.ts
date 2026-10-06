declare global {
	namespace NodeJS {
		interface ProcessEnv {
			[key: string]: string | undefined
			SUPABASE_URL: string
			SUPABASE_ANON_KEY: string
			SUPABASE_SERVICE_KEY: string
			DOMAIN: string | undefined
			PORT: number | undefined
			NODE_ENV: "development" | "production" | "debug"
		}
	}
}

export {}
