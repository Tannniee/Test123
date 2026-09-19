/**
 * POESTASH Web Item Inspector - Orchestrator (Phase 16 & 17)
 * Manages modal lifecycle, tab transitions, clipboard paste capture,
 * and integration with the backend /api/analyze-item endpoint.
 */

import { ItemInspectorRender } from './itemInspectorRender.js';
import { Clipboard } from './clipboard.js';

export class ItemInspectorManager {
  constructor() {
    this.currentData = null;
    this.activeTab = 'affixes';
    this.overlayEl = null;
    this.cardEl = null;
    this.bodyEl = null;
    this.isOpen = false;
    this._keydownHandler = null;
  }

  /**
   * Initializes DOM references and global paste event handlers.
   * @param {Object} dom App DOM cache
   * @param {Object} state App state
   */
  init(dom, state) {
    this.overlayEl = document.getElementById('deepItemInspectorOverlay');
    this.cardEl = document.getElementById('deepItemInspectorCard');
    this.bodyEl = document.getElementById('deepItemInspectorBody');

    if (!this.overlayEl) {
      console.warn('[ItemInspector] Overlay element #deepItemInspectorOverlay not found in DOM.');
      return;
    }

    // Close on backdrop click
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Close button
    const closeBtn = document.getElementById('closeDeepItemInspector');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Tab and action delegation inside modal body
    if (this.bodyEl) {
      this.bodyEl.addEventListener('click', (e) => {
        // Tab switching
        const tabBtn = e.target.closest('.inspector-tab-btn');
        if (tabBtn) {
          const tab = tabBtn.dataset.tab;
          if (tab && tab !== this.activeTab) {
            this.switchTab(tab);
          }
          return;
        }

        // Copy raw text action
        const copyRawBtn = e.target.closest('#btnCopyRawInspector');
        if (copyRawBtn && this.currentData) {
          const rawText = this.currentData.rawText || (this.currentData.item ? this.currentData.item.rawText : '');
          if (rawText) {
            Clipboard.copyText(rawText).then(ok => {
              if (ok) Clipboard.showToast('Đã sao chép nội dung item gốc!', 'success');
            });
          }
          return;
        }
      });
    }

    // Phase 17: Global paste listener for instant item inspection (Ctrl+V anywhere)
    document.addEventListener('paste', (e) => {
      // Don't intercept if user is typing into an input or textarea
      const targetTag = e.target ? e.target.tagName : '';
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
        return;
      }

      const clipboardText = e.clipboardData ? e.clipboardData.getData('text') : '';
      if (this.isPoeItemText(clipboardText)) {
        e.preventDefault();
        Clipboard.showToast('Đang phân tích vật phẩm từ clipboard...', 'info');
        this.inspectRawText(clipboardText, state ? state.currentGame : 'poe1', state ? state.currentLeague : null);
      }
    });
  }

  /**
   * Quick check if text has PoE clipboard signatures.
   */
  isPoeItemText(text) {
    if (!text || typeof text !== 'string' || text.length < 10) return false;
    return (
      text.includes('Item Class:') ||
      text.includes('Rarity:') ||
      text.includes('--------') ||
      text.includes('Item Level:')
    );
  }

  /**
   * Opens the Item Inspector with analysis data.
   * @param {Object} data Analysis payload
   * @param {string} [initialTab='affixes']
   */
  open(data, initialTab = 'affixes') {
    if (!this.overlayEl || !this.bodyEl) return;

    this.currentData = data;
    this.activeTab = initialTab;
    this.isOpen = true;

    // Render HTML
    this.bodyEl.innerHTML = ItemInspectorRender.renderInspectorModal(data, this.activeTab);

    // Reveal modal
    this.overlayEl.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Register Escape key
    if (this._keydownHandler) {
      window.removeEventListener('keydown', this._keydownHandler);
    }
    this._keydownHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };
    window.addEventListener('keydown', this._keydownHandler);
  }

  /**
   * Closes the inspector.
   */
  close() {
    if (!this.isOpen || !this.overlayEl) return;
    this.overlayEl.classList.add('hidden');
    document.body.classList.remove('modal-open');
    this.isOpen = false;
    if (this._keydownHandler) {
      window.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  }

  /**
   * Switches active tab inside the inspector.
   * @param {string} tab
   */
  switchTab(tab) {
    this.activeTab = tab;
    if (this.currentData && this.bodyEl) {
      this.bodyEl.innerHTML = ItemInspectorRender.renderInspectorModal(this.currentData, this.activeTab);
    }
  }

  /**
   * Calls /api/analyze-item and opens the inspector.
   * @param {string} rawText Raw PoE clipboard text
   * @param {string} game 'poe1' | 'poe2'
   * @param {string} league Active league name
   */
  async inspectRawText(rawText, game = 'poe1', league = null) {
    if (!rawText || !rawText.trim()) {
      Clipboard.showToast('Vui lòng cung cấp nội dung vật phẩm hợp lệ!', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          game,
          league,
          source: 'web_paste'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const analysisResult = await res.json();
      analysisResult.rawText = rawText; // Attach rawText for copy tab

      this.open(analysisResult);
      Clipboard.showToast(`Đã phân tích: ${analysisResult.item?.identity?.name || 'Vật phẩm'}`, 'success');
    } catch (err) {
      console.error('[ItemInspector] Failed to analyze item:', err);
      Clipboard.showToast(`Không thể phân tích: ${err.message}`, 'error');
    }
  }
}

export const itemInspector = new ItemInspectorManager();
