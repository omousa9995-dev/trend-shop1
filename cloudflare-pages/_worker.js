// Free short hostname; forward through a private Cloudflare service binding.
// The original request URL preserves the browser's origin and secure admin cookies.
export default {
  fetch(request, env) {
    return env.STORE.fetch(request);
  }
};
