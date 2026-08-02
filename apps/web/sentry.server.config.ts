import * as Sentry from "@sentry/nextjs";

// Só inicializa se SENTRY_DSN estiver configurado. Sem DSN = no-op silencioso,
// útil para dev local e para o ambiente até o piloto real começar.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Nunca envie o corpo da request para o Sentry — pode conter texto de peça
    // jurídica, CPF antes da tarja, etc.
    sendDefaultPii: false,
    beforeSend(event) {
      // Bloqueio defensivo: se por acaso um payload do usuário caiu em algum
      // campo de contexto, remove antes de sair.
      if (event.request) {
        event.request.data = undefined;
        event.request.cookies = undefined;
      }
      return event;
    },
  });
}
