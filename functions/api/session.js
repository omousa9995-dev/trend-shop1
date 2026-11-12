// Pages Functions deployment and the existing Pages->Worker service binding share one implementation.
// GEMINI_API_KEY is read only from context.env by the server handler; never returned to the browser.
import worker from '../../src/worker.js';
export function onRequestPost(context){return context.env.STORE?context.env.STORE.fetch(context.request):worker.fetch(context.request,context.env,context)}
