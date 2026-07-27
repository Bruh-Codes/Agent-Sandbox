import { Suspense } from "react";
import { MyProvider } from "@/components/runtime/my-provider";
import { SessionGuard } from "@/components/runtime/session-guard";
import { Base } from "@/components/examples/base";

export default function Page() {
  return (
    <main className="h-dvh overflow-hidden">
      <SessionGuard>
        <Suspense>
          <MyProvider>
            <Base />
          </MyProvider>
        </Suspense>
      </SessionGuard>
    </main>
  );
}
