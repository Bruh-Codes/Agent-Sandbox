"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [hasSession, setHasSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    authClient.getSession().then((res) => {
      setHasSession(!!res.data?.user);
      setChecked(true);
    });
  }, []);

  if (!checked) return <>{children}</>;

  if (!hasSession) {
    return (
      <>
        <div className="pointer-events-none blur-xs">{children}</div>
        <Dialog open={true}>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-sm"
          >
            <DialogTitle className="text-base font-semibold">
              Your session has expired
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Please log in again to continue using the app.
            </DialogDescription>
            <Button
              className="mt-2 w-full"
              onClick={() => router.push("/signin")}
            >
              Login
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return <>{children}</>;
}
