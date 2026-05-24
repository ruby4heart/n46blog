import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDERS, json, publicProviders } from "../_lib/shared.js";

export function onRequestGet({ env }) {
  return json({
    ok: true,
    hasServerKey: Object.values(PROVIDERS).some((provider) => Boolean(env[provider.envKey])),
    defaultModel: DEFAULT_MODEL,
    defaultProvider: DEFAULT_PROVIDER,
    providers: publicProviders()
  });
}
