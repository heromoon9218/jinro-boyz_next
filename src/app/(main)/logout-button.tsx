"use client";

import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => logout()}>
      ログアウト
    </Button>
  );
}
