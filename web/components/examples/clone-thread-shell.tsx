"use client";

import {
	ThreadListItems,
	ThreadListNew,
	ThreadListRoot,
	ThreadListSearch,
} from "@/components/assistant-ui/thread-list";
import { NavUser } from "@/components/ui/nav-user";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarProvider,
	SidebarRail,
	useSidebar,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useAuiState } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import { useEffect, useState, type FC, type ReactNode } from "react";

const NewThreadButton: FC = () => {
	const { open } = useSidebar();
	return (
		<ThreadListNew
			className={cn(
				"overflow-hidden transition-all duration-200",
				open ? "gap-2 px-2.5 w-full" : "size-8 justify-center p-0!",
			)}
			labelClassName={open ? "max-w-24" : "hidden"}
		/>
	);
};

const SidebarHeaderInner: FC<{ children: ReactNode }> = ({ children }) => {
	const { open } = useSidebar();
	return (
		<SidebarHeader
			className={cn(
				"flex h-12 shrink-0 flex-row items-center gap-2",
				!open && "px-0! justify-center",
			)}
		>
			{children}
		</SidebarHeader>
	);
};

type CloneThreadShellProps = {
	children: ReactNode;
	collapsed?: boolean | undefined;
	onCollapsedChange?: ((value: boolean) => void) | undefined;
	headerContent?: ReactNode | undefined;
	showSearch?: boolean | undefined;
	wrapNewThreadTooltip?: boolean | undefined;
};

export const CloneThreadShell: FC<CloneThreadShellProps> = ({
	children,
	collapsed,
	onCollapsedChange,
	headerContent,
	showSearch = true,
	wrapNewThreadTooltip = false,
}) => {
	const [search, setSearch] = useState("");
	const hasThreads = useAuiState((s) => s.threads.threadIds.length > 0);
	const [user, setUser] = useState<{
		name: string;
		email: string;
		avatar?: string;
	}>({
		name: "Guest",
		email: "guest@farmdesk.app",
	});
	useEffect(() => {
		authClient.getSession().then((res) => {
			if (res.data?.user) {
				setUser({
					name: res.data.user.name ?? "User",
					email: res.data.user.email ?? "",
					avatar: res.data.user.image ?? undefined,
				});
			}
		});
	}, []);

	return (
		<SidebarProvider
			defaultOpen={true}
			className="h-full min-h-0 overflow-hidden"
		>
			<Sidebar collapsible="icon" className="bg-muted/30">
				<SidebarHeaderInner>{headerContent}</SidebarHeaderInner>
				<SidebarContent>
					<ThreadListRoot className="flex-1 p-3">
						<NewThreadButton />
						{showSearch && hasThreads && (
							<ThreadListSearch value={search} onValueChange={setSearch} />
						)}
						<ThreadListItems
							searchQuery={showSearch && hasThreads ? search : ""}
						/>
					</ThreadListRoot>
				</SidebarContent>
				<SidebarFooter className="border-t p-2">
					<SidebarMenu>
						<NavUser user={user} />
					</SidebarMenu>
				</SidebarFooter>
				<SidebarRail />
			</Sidebar>
			<SidebarInset className="min-h-0 overflow-hidden p-0">
				<div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
};
