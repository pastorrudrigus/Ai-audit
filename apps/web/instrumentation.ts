// Hook que o Next 14 chama em cold start (server e edge). Delega para os
// arquivos de config específicos — que só ligam se SENTRY_DSN existir.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
