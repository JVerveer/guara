import { DatasetDetail } from "@/features/datasets/components/DatasetDetail";

interface DatasetDetailScreenProps {
  datasetId: string;
}

export function DatasetDetailScreen({ datasetId }: DatasetDetailScreenProps) {
  return <DatasetDetail datasetId={datasetId} />;
}
