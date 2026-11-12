import worker from '../src/worker.js';
export function onRequestGet(context){return context.env.STORE?context.env.STORE.fetch(context.request):worker.fetch(context.request,context.env,context)}
