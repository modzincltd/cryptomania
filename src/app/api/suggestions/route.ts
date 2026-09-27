import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { handle } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(() => {
    const scans = db.select().from(schema.scans).orderBy(desc(schema.scans.createdAt)).limit(10).all();
    const suggestions = db.select().from(schema.suggestions).orderBy(desc(schema.suggestions.createdAt)).limit(100).all();
    return { scans, suggestions };
  });
}
