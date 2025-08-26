// DOM-based notification system that works in VM browsers
// Replaces window.alert() and window.confirm() with DOM elements

let notificationContainer = null;

// Initialize the notification container
function initNotifications() {
  if (notificationContainer) return;
  
  notificationContainer = document.createElement('div');
  notificationContainer.id = 'notification-container';
  notificationContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
  `;
  document.body.appendChild(notificationContainer);
}

// Show a toast notification (replaces alert)
export function showNotification(message, type = 'error', duration = 4000) {
  initNotifications();
  
  const notification = document.createElement('div');
  notification.style.cssText = `
    background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
    color: white;
    padding: 12px 20px;
    margin-bottom: 10px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 350px;
    word-wrap: break-word;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
  `;
  notification.textContent = message;
  
  notificationContainer.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Show confirmation dialog (replaces confirm)
export function showConfirmation(message) {
  return new Promise((resolve) => {
    initNotifications();
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      text-align: center;
    `;
    
    const messageEl = document.createElement('p');
    messageEl.style.cssText = `
      margin: 0 0 20px 0;
      font-size: 16px;
      line-height: 1.5;
      color: #333;
    `;
    messageEl.textContent = message;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 10px 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      color: #666;
      cursor: pointer;
      font-size: 14px;
    `;
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Confirm';
    confirmButton.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      background: #f44336;
      color: white;
      cursor: pointer;
      font-size: 14px;
    `;
    
    // Event handlers
    const cleanup = () => {
      document.body.removeChild(overlay);
    };
    
    cancelButton.onclick = () => {
      cleanup();
      resolve(false);
    };
    
    confirmButton.onclick = () => {
      cleanup();
      resolve(true);
    };
    
    // ESC key handling
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
        document.removeEventListener('keydown', handleKeyPress);
      }
    };
    document.addEventListener('keydown', handleKeyPress);
    
    // Click outside to cancel
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    };
    
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    dialog.appendChild(messageEl);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus confirm button
    confirmButton.focus();
  });
}

// Convenience functions
export const notify = {
  error: (message) => showNotification(message, 'error'),
  success: (message) => showNotification(message, 'success'),
  info: (message) => showNotification(message, 'info')
};