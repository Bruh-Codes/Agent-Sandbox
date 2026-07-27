import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import db from "@/lib/db";
import * as schema from "@/schema/auth-schema";

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET!,
	url: process.env.BETTER_AUTH_URL!,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	providers: [],
});
