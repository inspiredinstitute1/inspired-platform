'use strict';
async function withAdminForm(form, task) {
  if (form.getAttribute('aria-busy') === 'true') return;
  const controls = [...form.querySelectorAll('input, select, textarea, button')];
  const disabled = controls.map(control => control.disabled);
  form.setAttribute('aria-busy', 'true');
  controls.forEach(control => { control.disabled = true; });
  try { return await task(); }
  finally {
    form.removeAttribute('aria-busy');
    controls.forEach((control, index) => { control.disabled = disabled[index]; });
  }
}
