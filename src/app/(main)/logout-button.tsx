"use client";

import { useQueryClient } from "@tanstack/react-query";
import { logout } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const queryClient = useQueryClient();

  const handleLogout = () => {
    queryClient.clear();
    logout();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      ログアウト
    </Button>
  );
}
