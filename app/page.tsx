import { ChatApp } from "@/components/ChatApp";
import { getDataset, summarizeCategories } from "@/lib/dataset";

export const dynamic = "force-dynamic";

export default async function Page() {
  const dataset = await getDataset();
  const categories = summarizeCategories(dataset.records);
  return <ChatApp categories={categories} datasetReady={dataset.records.length > 0} />;
}
