(() => {
  const fields = document.querySelectorAll('.mail-connection-status');
  if (!fields.length) return;
  async function check() {
    let message = 'تعذر تأكيد اتصال بريد الطلبات. حاول تحديث الصفحة.', state = 'pending';
    try {
      const response = await fetch('/api/mail-health', {cache: 'no-store'});
      const health = await response.json();
      if (health.reachable && health.canSend) {
        message = 'بريد الطلبات متصل وجاهز للإرسال'; state = 'ready';
      } else if (health.reachable) {
        message = 'بريد الطلبات متصل؛ حصة الإرسال اليومية غير متاحة حاليًا.';
      } else if (health.configured === false) {
        message = 'ربط بريد الطلبات لم يكتمل بعد.';
      }
    } catch {}
    for (const field of fields) { field.textContent = message; field.dataset.state = state; }
  }
  check();
})();
