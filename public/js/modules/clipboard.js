/**
 * Clipboard, Toast, and In-game Text Scanning Module (XSS-Safe)
 */

export const Clipboard = {
  /**
   * Safe Toast Notification without HTML Injection
   */
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // XSS Guard: Use textContent exclusively
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  },

  /**
   * Copy plain text to clipboard
   */
  async copyText(text) {
    if (!navigator.clipboard) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      } catch (e) {
        document.body.removeChild(ta);
        return false;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Format PoE whisper text
   */
  formatWhisper(item, qty = 1, priceText = '') {
    const itemName = item.name || 'Item';
    if (qty > 1) {
      return `@trade Hi, I'd like to buy your ${qty}x ${itemName} for ${priceText} in ${item.league || 'current league'}.`;
    }
    return `@trade Hi, I'd like to buy your ${itemName} for ${priceText} in ${item.league || 'current league'}.`;
  },

  /**
   * Attach Ctrl+V paste scanner
   */
  initPasteListener(onItemFound) {
    window.addEventListener('paste', (e) => {
      // Don't capture paste when user is typing in search input or other inputs
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const pastedText = clipboardData.getData('text');
      if (!pastedText || !pastedText.trim()) return;

      if (typeof window.PoeItemParser !== 'undefined') {
        const parsed = window.PoeItemParser.parse(pastedText);
        if (parsed && parsed.searchQuery) {
          onItemFound(parsed);
        }
      }
    });
  }
};
