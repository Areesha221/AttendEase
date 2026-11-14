import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth";

export default function SignOutForm({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={`btn btn-ghost ${compact ? "btn-sm" : ""}`}>
        <LogOut className="h-4 w-4" />
        {compact ? "Sign out" : "Sign out"}
      </button>
    </form>
  );
}
