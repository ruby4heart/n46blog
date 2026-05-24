import { DEFAULT_MODEL, json } from "../_lib/shared.js";

export function onRequestGet({ env }) {
  return json({ ok: true, hasServerKey: Boolean(env.OPENAI_API_KEY), defaultModel: DEFAULT_MODEL });
}
