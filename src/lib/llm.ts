import Anthropic from "@anthropic-ai/sdk";
import { getGlobal } from "./settings";

export type Provider = "anthropic" | "openai";
export interface StructuredTool { name: string; description: string; input_schema: Record<string, unknown> }
export interface LlmResult<T> { data: T; model: string; provider: Provider; inputTokens: number; outputTokens: number }

export const openaiKey = () => process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY || "";
export const anthropicKey = () => process.env.ANTHROPIC_API_KEY || "";
export const providerKeys = () => ({ anthropic: !!anthropicKey(), openai: !!openaiKey() });

export function activeProvider(): { provider: Provider; model: string } {
  const g = getGlobal();
  const keys = providerKeys();
  let provider: Provider = g.aiProvider;
  if (!keys[provider]) provider = keys.openai ? "openai" : "anthropic"; // fall back to whichever key exists
  const model = g.aiModel && g.aiModel.trim() ? g.aiModel : provider === "openai" ? "gpt-5.4-mini" : "claude-sonnet-5";
  return { provider, model };
}

export async function callStructured<T>(opts: { system: string; user: string; tool: StructuredTool; maxTokens?: number }): Promise<LlmResult<T>> {
  const { provider, model } = activeProvider();
  if (provider === "openai") {
    if (!openaiKey()) throw new Error("OPEN_AI_KEY / OPENAI_API_KEY missing in .env");
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { authorization: `Bearer ${openaiKey()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model, max_completion_tokens: opts.maxTokens ?? 4000,
        messages: [{ role: "system", content: opts.system }, { role: "user", content: `${opts.user}\n\nRespond ONLY with JSON matching the schema.` }],
        response_format: { type: "json_schema", json_schema: { name: opts.tool.name, description: opts.tool.description, schema: opts.tool.input_schema } },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j.error?.message ?? JSON.stringify(j).slice(0, 200)}`);
    const content = j.choices?.[0]?.message?.content;
    if (!content) throw new Error(`OpenAI returned no content (finish_reason ${j.choices?.[0]?.finish_reason})`);
    return { data: JSON.parse(content) as T, model: j.model ?? model, provider, inputTokens: j.usage?.prompt_tokens ?? 0, outputTokens: j.usage?.completion_tokens ?? 0 };
  }
  if (!anthropicKey()) throw new Error("ANTHROPIC_API_KEY missing in .env");
  const client = new Anthropic();
  const res = await client.messages.create({
    model, max_tokens: opts.maxTokens ?? 4000, system: opts.system,
    tools: [opts.tool as unknown as Anthropic.Tool], tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.user }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Model returned no structured result");
  return { data: block.input as T, model, provider, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

export interface ModelInfo { id: string; provider: Provider; label: string }
const modelCache: { at: number; data: ModelInfo[] } = { at: 0, data: [] };

export async function listModels(): Promise<ModelInfo[]> {
  if (Date.now() - modelCache.at < 10 * 60_000 && modelCache.data.length) return modelCache.data;
  const out: ModelInfo[] = [];
  if (anthropicKey()) {
    try { const c = new Anthropic(); const m = await c.models.list({ limit: 50 }); for (const x of m.data) out.push({ id: x.id, provider: "anthropic", label: x.display_name ?? x.id }); } catch { /* key invalid */ }
  }
  if (openaiKey()) {
    try {
      const r = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${openaiKey()}` } });
      const j = await r.json();
      const ids: string[] = (j.data ?? []).map((m: { id: string }) => m.id)
        .filter((i: string) => /^(gpt-|o[0-9])/.test(i) && !/audio|realtime|tts|transcribe|image|search|embedding|moderation|instruct|codex|computer|live|-\d{4}-\d{2}-\d{2}$/.test(i))
        .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
      for (const id of ids) out.push({ id, provider: "openai", label: id });
    } catch { /* ignore */ }
  }
  modelCache.at = Date.now(); modelCache.data = out;
  return out;
}
