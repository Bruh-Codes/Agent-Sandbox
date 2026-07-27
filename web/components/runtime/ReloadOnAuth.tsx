"use client";

import { useAui } from "@assistant-ui/react";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export function ReloadOnAuth() {
	const aui = useAui();
	const { data: session, isPending } = authClient.useSession();
	useEffect(() => {
		if (!isPending && session) aui.threads().reload();
	}, [isPending, session?.user?.id]);
	return null;
}
