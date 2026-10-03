import { env } from "@/config/env";

/**
 * GitHub star count — pages.md A13 / MarketingNav as-built note: the badge
 * is neutral ("Star") in static designs; a live count is populated at
 * runtime only. Third-party fetch, so it lives in the models layer (the
 * only layer that talks to the network).
 *
 * TEST_MODE: resolves `null` without touching the network (badge stays
 * neutral; Playwright/CI stay hermetic).
 */
/** Session cache — remounts reuse the count instead of refetching. */
const starCache = new Map<string, number>();

export const githubRepo = {
  async stars(repo = "cuesoftinc/upstat"): Promise<number | null> {
    if (env.testMode) return null;
    const cached = starCache.get(repo);
    if (cached !== undefined) return cached;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { stargazers_count?: number };
      if (typeof body.stargazers_count !== "number") return null;
      starCache.set(repo, body.stargazers_count);
      return body.stargazers_count;
    } catch {
      return null;
    }
  },
};
