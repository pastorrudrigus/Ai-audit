import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      // Idem servidor: nada de payload do usuário.
      if (event.request) {
        event.request.data = undefined;
        event.request.cookies = undefined;
      }
      return event;
    },
  });
}
