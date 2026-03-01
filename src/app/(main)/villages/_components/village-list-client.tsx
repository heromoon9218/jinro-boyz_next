"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/lib/trpc/react";
import { useAuthUser } from "@/lib/hooks/use-auth-user";
import { VillageCard } from "./village-card";
import { Pagination } from "./pagination";
import { CreateVillageDialog } from "./create-village-dialog";

export function VillageListClient() {
  const [filter, setFilter] = useState<"active" | "ended">("active");
  const [page, setPage] = useState(1);
  const { user: authUser } = useAuthUser();
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.village.list.queryOptions({
      filter,
      page,
      perPage: 10,
    }),
  );

  function handleFilterChange(value: string) {
    setFilter(value as "active" | "ended");
    setPage(1);
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList>
            <TabsTrigger value="active">募集中・進行中</TabsTrigger>
            <TabsTrigger value="ended">終了済み</TabsTrigger>
          </TabsList>
        </Tabs>
        {authUser && <CreateVillageDialog />}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border bg-muted"
            />
          ))}
        </div>
      ) : data && data.villages.length > 0 ? (
        <>
          <div className="space-y-3">
            {data.villages.map((village) => (
              <VillageCard key={village.id} village={village} />
            ))}
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <p className="py-8 text-center text-muted-foreground">
          {filter === "active"
            ? "現在募集中・進行中の村はありません"
            : "終了済みの村はありません"}
        </p>
      )}
    </div>
  );
}
