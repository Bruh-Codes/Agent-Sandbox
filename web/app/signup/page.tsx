"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { LeafIcon } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const SignUpPage = () => {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isGoogleLoading, setIsGoogleLoading] = useState(false);

	const handleEmailSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		const { error } = await authClient.signUp.email({ name, email, password });
		if (error) {
			toast.error(error.message ?? "Failed to create account");
			setIsLoading(false);
		} else {
			window.location.href = "/";
		}
	};

	const handleGoogleSignIn = async () => {
		setIsGoogleLoading(true);
		const { error } = await authClient.signIn.social({ provider: "google" });
		if (error) {
			toast.error(error.message ?? "Failed to sign in with Google");
			setIsGoogleLoading(false);
		}
	};

	return (
		<div className="flex min-h-dvh items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="items-center text-center">
					<div className="mb-2 flex items-center gap-2 text-lg font-semibold">
						<LeafIcon className="size-6 text-green-600" />
						<span>FarmDesk</span>
					</div>
					<CardTitle className="text-xl">Create an account</CardTitle>
					<CardDescription>
						Enter your details below to create your account.
					</CardDescription>
				</CardHeader>
				<form onSubmit={handleEmailSignUp}>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Full name</Label>
							<Input
								id="name"
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								placeholder="you@example.com"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								autoComplete="email"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="new-password"
							/>
						</div>
						<Button className="w-full cursor-pointer" type="submit" disabled={isLoading}>
							{isLoading ? <Spinner className="mr-2" /> : null}
							{isLoading ? "Creating account..." : "Create Account"}
						</Button>
						<div className="relative flex items-center gap-2">
							<Separator className="flex-1" />
							<span className="text-muted-foreground shrink-0 px-2 text-xs uppercase">
								Or continue with
							</span>
							<Separator className="flex-1" />
						</div>
						<Button className="w-full cursor-pointer" variant="outline" disabled={isGoogleLoading} onClick={handleGoogleSignIn}>
							{isGoogleLoading ? (
								<Spinner className="mr-2" />
							) : (
								<svg
									aria-label="Google"
									className="mr-2 h-4 w-4"
									role="img"
									viewBox="0 0 24 24"
								>
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
							)}
							{isGoogleLoading ? "Signing in..." : "Continue with Google"}
						</Button>
					</CardContent>
				</form>
				<CardFooter className="justify-center">
					<p className="text-muted-foreground text-sm">
						Already have an account?{" "}
						<Link href="/signin" className="font-medium underline">
							Sign in
						</Link>
					</p>
				</CardFooter>
			</Card>
		</div>
	);
};

export default SignUpPage;
