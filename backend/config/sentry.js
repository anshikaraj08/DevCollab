import * as Sentry from "@sentry/node";
import env from "./env.js";

/**
 * Scrubs all sensitive data from Sentry error events.
 * Removes request bodies, headers, cookies, tokens, and code content.
 * Retains only the user ID.
 */
export function scrubSentryEvent(event) {
  if (!event) return event;

  if (event.request) {
    delete event.request.data;
    delete event.request.body;
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers["set-cookie"];
    }
  }

  if (event.user) {
    event.user = { id: event.user.id || event.user._id };
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((b) => {
      if (b.data) {
        delete b.data.code;
        delete b.data.token;
        delete b.data.password;
        delete b.data.body;
      }
      return b;
    });
  }

  if (event.extra) {
    delete event.extra.code;
    delete event.extra.token;
    delete event.extra.password;
    delete event.extra.body;
  }

  return event;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN || env?.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    release: process.env.APP_VERSION || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    beforeSend(event) {
      return scrubSentryEvent(event);
    },
  });
}

export default { initSentry, scrubSentryEvent };

