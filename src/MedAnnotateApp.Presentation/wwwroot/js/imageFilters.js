document.querySelectorAll('[data-image-filter-form]').forEach(form => {
  const groups = [...form.querySelectorAll('[data-required-selection]')];
  function validateGroup(group) {
    const selected = group.querySelector('input[type="checkbox"]:checked') !== null;
    group.querySelector('[data-selection-error]').textContent = selected ? '' : 'Select at least one option in this list.';
    group.setAttribute('aria-invalid', String(!selected));
    return selected;
  }
  groups.forEach(group => group.addEventListener('change', () => validateGroup(group)));
  form.addEventListener('submit', event => {
    const invalid = groups.filter(group => !validateGroup(group));
    if (invalid.length) {
      event.preventDefault();
      invalid[0].querySelector('input[type="checkbox"]').focus();
    }
  });
});
