import './theme.css';
import './removalDialog.css';

export function createRemovalDialog() {
  const root = document.createElement('div');
  root.className = 'removal-overlay';
  root.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'removal-dialog';
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-modal', 'true');
  const heading = document.createElement('h2');
  heading.id = 'removal-title';
  const message = document.createElement('p');
  message.id = 'removal-message';
  panel.setAttribute('aria-labelledby', heading.id);
  panel.setAttribute('aria-describedby', message.id);
  const actions = document.createElement('div');
  actions.className = 'removal-actions';
  const cancel = document.createElement('button');
  cancel.className = 'ui-button';
  cancel.textContent = 'Cancel';
  const confirm = document.createElement('button');
  confirm.className = 'ui-button primary';
  confirm.textContent = 'Confirm removal';
  actions.append(cancel, confirm);
  panel.append(heading, message, actions);
  root.append(panel);
  document.body.append(root);
  let action: (() => void) | undefined;
  let previousFocus: HTMLElement | null = null;
  function close() {
    if (root.hidden) return;
    root.hidden = true;
    action = undefined;
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    const pending = action;
    close();
    pending?.();
  });
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === cancel ? confirm : cancel).focus();
    }
  });
  root.addEventListener('keyup', event => event.stopPropagation());
  return {
    open(name: string, description: string, onConfirm: () => void) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      heading.textContent = `Remove ${name}?`;
      message.textContent = description;
      action = onConfirm;
      root.hidden = false;
      cancel.focus();
    },
    close,
    isOpen: () => !root.hidden,
  };
}
