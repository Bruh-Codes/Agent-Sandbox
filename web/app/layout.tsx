import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/runtime/query-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";

export const metadata: Metadata = {
	title: "FarmDesk",
	description: "FarmDesk - AI-powered farm management assistant.",
	icons: { icon: "/icon.svg" },
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<QueryProvider>
					<ThemeProvider
						attribute="class"
						defaultTheme="system"
						enableSystem
						disableTransitionOnChange
					>
						{children}
					</ThemeProvider>
				</QueryProvider>
				<Toaster richColors={true} />
			</body>
		</html>
	);
}
