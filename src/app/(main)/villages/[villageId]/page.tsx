import { VillageDetailClient } from "./_components/village-detail-client";

interface VillageDetailPageProps {
  params: Promise<{ villageId: string }>;
}

export default async function VillageDetailPage({
  params,
}: VillageDetailPageProps) {
  const { villageId } = await params;
  return <VillageDetailClient villageId={villageId} />;
}
