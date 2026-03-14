import type { SignatureParams } from "../types.js";

/**
 * Derived component resolvers for RFC 9421.
 * These extract values from a Request object.
 */
const DERIVED_RESOLVERS: Record<string, (req: Request) => string> = {
  "@method": (req) => req.method.toUpperCase(),
  "@authority": (req) => new URL(req.url).host,
  "@path": (req) => new URL(req.url).pathname,
  "@query": (req) => {
    const q = new URL(req.url).search;
    return q || "?";
  },
  "@target-uri": (req) => req.url,
};

/**
 * Build the RFC 9421 signature base string.
 *
 * Format:
 * ```
 * "@method": POST
 * "@authority": api.example.com
 * "@path": /api/orders
 * "content-digest": sha-256=:base64:
 * "@signature-params": ("@method" "@authority" "@path" "content-digest");created=...;keyid="..."
 * ```
 */
export function buildSignatureBase(
  request: Request,
  components: string[],
  params: SignatureParams
): string {
  const lines: string[] = [];

  for (const component of components) {
    const value = resolveComponent(request, component);
    lines.push(`"${component}": ${value}`);
  }

  const paramsLine = buildSignatureParams(components, params);
  lines.push(`"@signature-params": ${paramsLine}`);

  return lines.join("\n");
}

/**
 * Build the @signature-params value.
 * Format: ("comp1" "comp2");created=123;expires=456;keyid="pubkey";nonce="abc"
 */
export function buildSignatureParams(
  components: string[],
  params: SignatureParams
): string {
  const componentList = components.map((c) => `"${c}"`).join(" ");
  let result = `(${componentList})`;

  result += `;created=${params.created}`;
  result += `;expires=${params.expires}`;
  result += `;keyid="${params.keyid}"`;

  if (params.nonce !== undefined) {
    result += `;nonce="${params.nonce}"`;
  }

  if (params.scope !== undefined) {
    result += `;scope=${params.scope}`;
  }

  return result;
}

/**
 * Parse a @signature-params string back into components and params.
 */
export function parseSignatureParams(
  input: string
): { components: string[]; params: SignatureParams } | null {
  // Match component list: ("@method" "@authority" ...)
  const listMatch = input.match(/^\(([^)]*)\)/);
  if (!listMatch) return null;

  const components = listMatch[1]
    .match(/"([^"]+)"/g)
    ?.map((s) => s.slice(1, -1)) ?? [];

  const rest = input.slice(listMatch[0].length);

  const created = extractIntParam(rest, "created");
  const expires = extractIntParam(rest, "expires");
  const keyid = extractStringParam(rest, "keyid");

  if (created === null || expires === null || keyid === null) return null;

  const nonce = extractStringParam(rest, "nonce") ?? undefined;
  const scope = extractIntParam(rest, "scope") ?? undefined;

  return {
    components,
    params: { created, expires, keyid, nonce, scope },
  };
}

function resolveComponent(request: Request, component: string): string {
  if (component.startsWith("@")) {
    const resolver = DERIVED_RESOLVERS[component];
    if (!resolver) throw new Error(`Unknown derived component: ${component}`);
    return resolver(request);
  }
  // Regular header
  const value = request.headers.get(component);
  if (value === null) throw new Error(`Missing header: ${component}`);
  return value;
}

function extractIntParam(input: string, name: string): number | null {
  const match = input.match(new RegExp(`;${name}=(\\d+)`));
  return match ? parseInt(match[1], 10) : null;
}

function extractStringParam(input: string, name: string): string | null {
  const match = input.match(new RegExp(`;${name}="([^"]*)"`));
  return match ? match[1] : null;
}
