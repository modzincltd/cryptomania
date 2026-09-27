import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  return handle(() => db.select().from(schema.logs).orderBy(desc(schema.logs.ts)).limit(Number(new URL(req.url).searchParams.get("limit") ?? 200)).all());
}
