// Next.js 15+ entry point для server-side инициализации. Сюда Sentry
// подключается на каждом cold start.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string
    method: string
    headers: Record<string, string | string[] | undefined>
  },
  context: {
    routerKind: "Pages Router" | "App Router"
    routePath: string
    routeType: "render" | "route" | "action" | "middleware"
    renderSource?: string
    revalidateReason?: "on-demand" | "stale" | undefined
    renderType?: "dynamic" | "dynamic-resume"
  }
) {
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(err, request, context)
}
