(()=>{'use strict';
  const params = new URLSearchParams(location.hash.slice(1));
  let token = params.get('setup') || '';
  const login = document.getElementById('loginForm');
  const form = document.getElementById('setupForm');
  const tokenField = document.getElementById('setupToken');
  function openSetup() { login.hidden = true; form.hidden = false; tokenField.focus(); }
  document.getElementById('openSetup').onclick = openSetup;
  if (token) { history.replaceState(null, '', location.pathname); tokenField.value = token; openSetup(); }
  form.onsubmit = async event => {
    event.preventDefault();
    const error = document.getElementById('setupError');
    const password = document.getElementById('setupPassword').value;
    token = tokenField.value.trim();
    error.textContent = '';
    if (password !== document.getElementById('setupConfirm').value) {
      error.textContent = 'كلمتا المرور غير متطابقتين'; return;
    }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      const response = await fetch('/api/admin/setup', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({token, password})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'تعذر إكمال الإعداد');
      token = null;
      form.reset();
      location.replace(location.pathname);
    } catch (e) { error.textContent = e.message; button.disabled = false; }
  };
})();
