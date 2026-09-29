import { handle } from "@/lib/api";
import { activeProvider, listModels, providerKeys } from "@/lib/llm";
export const dynamic = "force-dynamic";
export async function GET() { return handle(async () => ({ models: await listModels(), keys: providerKeys(), active: await activeProvider() })); }
