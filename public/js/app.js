/**
 * PoE Ninja Quick Price Checker - Modern Exchange-Only Architecture
 */

// Application State
const state = {
  currentGame: 'poe1',
  currentLeague: 'Allflame',
  activeCategory: 'Currency',
  valueDisplayMode: 'adaptive', // 'adaptive' | 'divine' | 'chaos'
  searchQuery: '',
  subFilterQuery: '',
  currentView: 'table', // 'table' | 'grid'
  items: [],
  filteredItems: [],
  rates: {
    divinePriceInChaos: 0,
    mirrorPriceInChaos: 0,
    rawRates: {}
  },
  updatedAt: null,
  selectedItem: null,
  isRefreshing: false,
  tooltipPinned: false,
  activeHoveredItem: null,
  sortColumn: 'value', // 'value' | 'name' | 'change7d' | 'volume'
  sortDirection: 'desc', // 'desc' | 'asc'
  rotationInfo: null
};

// Category Definitions with specific PoE 1 and PoE 2 icons and labels
const CATEGORY_CONFIG = {
  poe1: [
    { id: 'Currency', label: 'Currency', iconClass: 'currency-ico' },
    { id: 'Fragments', label: 'Fragments', iconClass: 'fragment-ico' },
    { id: 'Divination Cards', label: 'Divination Cards', iconClass: 'card-ico' },
    { id: 'Scarabs', label: 'Scarabs', iconClass: 'scarab-ico' },
    { id: 'Essences', label: 'Essences', iconClass: 'essence-ico' },
    { id: 'Fossils', label: 'Fossils', iconClass: 'fossil-ico' },
    { id: 'Oils', label: 'Oils', iconClass: 'oil-ico' },
    { id: 'Catalysts', label: 'Catalysts', iconClass: 'catalyst-ico' },
    { id: 'Delirium Orbs', label: 'Delirium Orbs', iconClass: 'delirium-ico' },
    { id: 'Tattoos', label: 'Tattoos', iconClass: 'tattoo-ico' },
    { id: 'Omens', label: 'Omens', iconClass: 'omen-ico' },
    { id: 'Artifacts', label: 'Artifacts', iconClass: 'artifact-ico' },
    { id: 'Allflame Embers', label: 'Allflame Embers', iconClass: 'allflame-ico' },
    { id: 'Runegrafts', label: 'Runegrafts', iconClass: 'runegraft-ico' },
    { id: 'Ducats', label: 'Ducats', iconClass: 'ducat-ico' },
    { id: 'Enshrouding Crystals', label: 'Enshrouding Crystals', iconClass: 'crystal-ico' },
    { id: 'Incubators', label: 'Incubators', iconClass: 'incubator-ico' }
  ],
  poe2: [
    { id: 'Currency', label: 'Currency', iconClass: 'poe2-currency-ico' },
    { id: 'Ritual', label: 'Ritual', iconClass: 'poe2-ritual-ico' },
    { id: 'Breach', label: 'Breach', iconClass: 'poe2-breach-ico' },
    { id: 'Delirium', label: 'Delirium', iconClass: 'poe2-delirium-ico' },
    { id: 'Abyss', label: 'Abyss', iconClass: 'poe2-abyss-ico' },
    { id: 'Expedition', label: 'Expedition', iconClass: 'poe2-expedition-ico' },
    { id: 'Vaal', label: 'Vaal Infusers', iconClass: 'poe2-vaal-ico' }
  ]
};

// DOM Elements Cache
const elements = {
  // Sidebar
  appSidebar: document.getElementById('appSidebar'),
  sidebarNavContainer: document.getElementById('sidebarNavContainer'),
  
  // Top Header
  btnPoe1: document.getElementById('btnPoe1'),
  btnPoe2: document.getElementById('btnPoe2'),
  leagueSelect: document.getElementById('leagueSelect'),
  searchInput: document.getElementById('searchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  divinePriceText: document.getElementById('divinePriceText'),
  mirrorPriceText: document.getElementById('mirrorPriceText'),
  tickerDivineChaos: document.getElementById('tickerDivineChaos'),
  tickerMirrorDiv: document.getElementById('tickerMirrorDiv'),
  cacheStatusPill: document.getElementById('cacheStatusPill'),
  cachePulse: document.getElementById('cachePulse'),
  cacheText: document.getElementById('cacheText'),
  btnSyncNow: document.getElementById('btnSyncNow'),
  syncIcon: document.getElementById('syncIcon'),
  btnPasteAction: document.getElementById('btnPasteAction'),

  // Main Content
  breadcrumbCategory: document.getElementById('breadcrumbCategory'),
  currentCategoryTitle: document.getElementById('currentCategoryTitle'),
  subSearchInput: document.getElementById('subSearchInput'),
  valDisplaySelect: document.getElementById('valDisplaySelect'),
  resultsCount: document.getElementById('resultsCount'),
  viewTableBtn: document.getElementById('viewTableBtn'),
  viewGridBtn: document.getElementById('viewGridBtn'),
  itemsTableWrap: document.getElementById('itemsTableWrap'),
  itemsTable: document.getElementById('itemsTable'),
  itemsTableBody: document.getElementById('itemsTableBody'),
  itemsGrid: document.getElementById('itemsGrid'),
  emptyState: document.getElementById('emptyState'),

  // Table Sort Headers & Indicators
  thName: document.getElementById('thName'),
  thValue: document.getElementById('thValue'),
  thTrend: document.getElementById('thTrend'),
  thVolume: document.getElementById('thVolume'),
  sortIndName: document.getElementById('sortIndName'),
  sortIndValue: document.getElementById('sortIndValue'),
  sortIndTrend: document.getElementById('sortIndTrend'),
  sortIndVolume: document.getElementById('sortIndVolume'),

  // Quick Converter
  convChaosInput: document.getElementById('convChaosInput'),
  convDivineInput: document.getElementById('convDivineInput'),
  convPrimarySym: document.getElementById('convPrimarySym'),

  // Tooltip
  poeTooltip: document.getElementById('poeTooltip'),
  tooltipPinBtn: document.getElementById('tooltipPinBtn'),
  ttTitle: document.getElementById('ttTitle'),
  ttBaseType: document.getElementById('ttBaseType'),
  ttMagic: document.getElementById('ttMagic'),
  ttInstructions: document.getElementById('ttInstructions'),
  ttImplicits: document.getElementById('ttImplicits'),
  ttDiv1: document.getElementById('ttDiv1'),
  ttExplicits: document.getElementById('ttExplicits'),
  ttDiv2: document.getElementById('ttDiv2'),
  ttFlavour: document.getElementById('ttFlavour'),
  ttIcon: document.getElementById('ttIcon'),

  // Modal
  itemModal: document.getElementById('itemModal'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  modalItemIcon: document.getElementById('modalItemIcon'),
  modalItemName: document.getElementById('modalItemName'),
  modalItemSub: document.getElementById('modalItemSub'),
  modalLabelPrimary: document.getElementById('modalLabelPrimary'),
  modalChaosVal: document.getElementById('modalChaosVal'),
  modalDivineVal: document.getElementById('modalDivineVal'),
  modalTrendVal: document.getElementById('modalTrendVal'),
  modalDescContent: document.getElementById('modalDescContent'),
  modalSparklineWrap: document.getElementById('modalSparklineWrap'),
  modalQtyInput: document.getElementById('modalQtyInput'),
  modalCalcChaos: document.getElementById('modalCalcChaos'),
  modalCalcDivine: document.getElementById('modalCalcDivine'),
  modalCalcPrimarySym: document.getElementById('modalCalcPrimarySym'),
  modalStackBtn: document.getElementById('modalStackBtn'),
  modalWikiLink: document.getElementById('modalWikiLink'),
  modalNinjaLink: document.getElementById('modalNinjaLink'),
  modalCopyPriceBtn: document.getElementById('modalCopyPriceBtn'),
  toastContainer: document.getElementById('toastContainer')
};

const DEFAULT_FALLBACK_ICON = 'https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MX1d/ec48896769/CurrencyModValues.png';

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadData();
  startStatusPolling();
});

function initEventListeners() {
  // Game Switcher (PoE 1 / PoE 2)
  elements.btnPoe1.addEventListener('click', () => switchGame('poe1'));
  elements.btnPoe2.addEventListener('click', () => switchGame('poe2'));

  // League Selector
  elements.leagueSelect.addEventListener('change', (e) => {
    state.currentLeague = e.target.value;
    loadData();
  });

  // Global Search Input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    elements.searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
    filterAndRender();
  });

  elements.searchClearBtn.addEventListener('click', () => {
    elements.searchInput.value = '';
    state.searchQuery = '';
    elements.searchClearBtn.style.display = 'none';
    elements.searchInput.focus();
    filterAndRender();
  });

  // Sub Search Input (Filter by Name)
  elements.subSearchInput.addEventListener('input', (e) => {
    state.subFilterQuery = e.target.value;
    filterAndRender();
  });

  // Value Display Mode (Adaptive / Divine / Chaos)
  elements.valDisplaySelect.addEventListener('change', (e) => {
    state.valueDisplayMode = e.target.value;
    renderResults(state.filteredItems);
  });

  // View Mode (Table / Grid)
  elements.viewTableBtn.addEventListener('click', () => switchView('table'));
  elements.viewGridBtn.addEventListener('click', () => switchView('grid'));

  // Manual Sync Button
  elements.btnSyncNow.addEventListener('click', triggerManualRefresh);

  // Ctrl + V Paste Detection
  window.addEventListener('paste', handleGlobalPaste);
  elements.btnPasteAction.addEventListener('click', handlePasteButtonClick);

  // Global Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== elements.searchInput && document.activeElement !== elements.subSearchInput && document.activeElement !== elements.modalQtyInput) {
      e.preventDefault();
      elements.searchInput.focus();
      elements.searchInput.select();
    } else if (e.key === 'Escape') {
      if (elements.itemModal.style.display !== 'none') {
        closeModal();
      } else if (state.tooltipPinned) {
        unpinTooltip();
      } else if (elements.searchInput.value) {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.searchClearBtn.style.display = 'none';
        filterAndRender();
      }
    } else if (e.key === 'Enter') {
      if ((document.activeElement === elements.searchInput || document.activeElement === elements.subSearchInput) && elements.itemModal.style.display === 'none') {
        if (state.filteredItems && state.filteredItems.length > 0) {
          openItemModal(state.filteredItems[0].id);
        }
      }
    }
  });

  // Quick Converter Inputs
  elements.convChaosInput.addEventListener('input', updateConverterFromPrimary);
  elements.convDivineInput.addEventListener('input', updateConverterFromDivine);

  // Modal Events
  elements.modalCloseBtn.addEventListener('click', closeModal);
  elements.itemModal.addEventListener('click', (e) => {
    if (e.target === elements.itemModal) closeModal();
  });
  elements.modalQtyInput.addEventListener('input', updateModalQuantityCalc);
  elements.modalCopyPriceBtn.addEventListener('click', copyModalPriceToClipboard);

  // Tooltip Pin Button
  elements.tooltipPinBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTooltipPin();
  });
}

// ==========================================================================
// Dynamic Sidebar Rendering (Different for PoE 1 vs PoE 2)
// ==========================================================================
function renderSidebarNav() {
  const configs = CATEGORY_CONFIG[state.currentGame] || [];
  const sectionTitle = state.currentGame === 'poe1' ? 'GENERAL' : 'POE 2 MECHANICS';

  // Count items per category
  const countMap = {};
  for (const it of state.items) {
    countMap[it.category] = (countMap[it.category] || 0) + 1;
  }

  let html = `
    <div class="nav-section-title">${sectionTitle}</div>
    <nav class="sidebar-nav">
  `;

  for (const cfg of configs) {
    const count = countMap[cfg.id] || 0;
    const isActive = state.activeCategory === cfg.id ? 'active' : '';

    html += `
      <button class="nav-item ${isActive}" data-category="${escapeHtml(cfg.id)}" onclick="selectCategory('${escapeHtml(cfg.id)}')">
        <span class="nav-icon ${cfg.iconClass}"></span>
        <span class="nav-label">${escapeHtml(cfg.label)}</span>
        <span class="nav-badge">${count > 0 ? count : ''}</span>
      </button>
    `;
  }

  html += `
    </nav>
    <div class="sidebar-all-items">
      <button class="nav-item ${state.activeCategory === 'all' ? 'active' : ''}" data-category="all" onclick="selectCategory('all')">
        <span class="nav-icon all-ico">🔍</span>
        <span class="nav-label">Tất cả vật phẩm</span>
        <span class="nav-badge">${state.items.length.toLocaleString()}</span>
      </button>
    </div>
  `;

  elements.sidebarNavContainer.innerHTML = html;
}

window.selectCategory = function(cat) {
  state.activeCategory = cat;
  
  // Highlight active sidebar item
  document.querySelectorAll('.app-sidebar .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.category === cat);
  });

  elements.breadcrumbCategory.textContent = cat === 'all' ? 'All Items' : cat;
  elements.currentCategoryTitle.textContent = cat === 'all' ? 'All Items' : cat;

  filterAndRender();
};

// ==========================================================================
// Data Fetching & Sync
// ==========================================================================
async function loadData() {
  elements.resultsCount.textContent = 'Đang đọc dữ liệu cache...';
  try {
    const url = `/api/items?game=${state.currentGame}&league=${encodeURIComponent(state.currentLeague)}`;
    const res = await fetch(url);
    const data = await res.json();

    state.items = data.items || [];
    state.rates = {
      divinePriceInChaos: data.divinePriceInChaos || 0,
      mirrorPriceInChaos: data.mirrorPriceInChaos || 0,
      rawRates: data.rates || {}
    };
    state.updatedAt = data.updatedAt;

    renderSidebarNav();
    updateHeaderRates();
    updateCacheStatusUI();
    filterAndRender();
  } catch (err) {
    console.error('Failed to load items:', err);
    showToast('Lỗi tải dữ liệu cache', 'error');
  }
}

function switchGame(game) {
  if (state.currentGame === game) return;
  state.currentGame = game;
  state.activeCategory = 'Currency'; // Reset to Currency

  elements.btnPoe1.classList.toggle('active', game === 'poe1');
  elements.btnPoe2.classList.toggle('active', game === 'poe2');

  // Update Leagues dropdown
  elements.leagueSelect.innerHTML = '';
  if (game === 'poe1') {
    elements.leagueSelect.innerHTML = `
      <option value="Allflame">Allflame</option>
      <option value="Standard">Standard</option>
    `;
    state.currentLeague = 'Allflame';
    elements.convPrimarySym.textContent = 'C';
  } else {
    elements.leagueSelect.innerHTML = `
      <option value="Standard">PoE 2 Standard</option>
    `;
    state.currentLeague = 'Standard';
    elements.convPrimarySym.textContent = 'Ex';
  }

  elements.breadcrumbCategory.textContent = 'Currency';
  elements.currentCategoryTitle.textContent = 'Currency';

  loadData();
  showToast(`Chuyển sang ${game.toUpperCase()}`);
}

function switchView(view) {
  state.currentView = view;
  elements.viewTableBtn.classList.toggle('active', view === 'table');
  elements.viewGridBtn.classList.toggle('active', view === 'grid');

  if (view === 'table') {
    elements.itemsTableWrap.style.display = 'block';
    elements.itemsGrid.style.display = 'none';
  } else {
    elements.itemsTableWrap.style.display = 'none';
    elements.itemsGrid.style.display = 'grid';
  }
}

async function triggerManualRefresh() {
  if (state.isRefreshing) return;

  state.isRefreshing = true;
  elements.syncIcon.classList.add('spinning');
  elements.cachePulse.classList.add('syncing');
  elements.cacheText.textContent = 'Đang đồng bộ...';

  try {
    await fetch('/api/refresh', { method: 'POST' });
    showToast('Bắt đầu làm mới cache từ PoE Ninja...');
  } catch (err) {
    showToast('Không thể kích hoạt làm mới cache', 'error');
    state.isRefreshing = false;
    elements.syncIcon.classList.remove('spinning');
  }
}

function startStatusPolling() {
  fetchStatus();
  setInterval(fetchStatus, 8000);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.rotationInfo = data;

    if (data.isRefreshing) {
      state.isRefreshing = true;
      elements.syncIcon.classList.add('spinning');
      elements.cachePulse.classList.add('syncing');
      elements.cacheText.textContent = data.refreshProgress?.status || 'Đang xoay tua...';
    } else if (state.isRefreshing && !data.isRefreshing) {
      state.isRefreshing = false;
      elements.syncIcon.classList.remove('spinning');
      elements.cachePulse.classList.remove('syncing');
      showToast('Đã xoay tua cập nhật danh mục mới!', 'success');
      loadData();
    } else {
      updateCacheStatusUI();
    }
  } catch (e) {
    // Ignore background network blips
  }
}

function updateCacheStatusUI() {
  if (!state.updatedAt) {
    elements.cacheText.textContent = 'Chưa có cache';
    elements.cachePulse.classList.add('syncing');
    return;
  }

  elements.cachePulse.classList.remove('syncing');
  const now = new Date();
  const updated = new Date(state.updatedAt);
  const diffMinutes = Math.floor((now - updated) / (60 * 1000));

  const rotInfo = state.rotationInfo;
  const nextP1 = rotInfo?.nextRotationBatch?.friendlyP1 || 'Divination Cards';
  const lastP1 = rotInfo?.lastRotatedBatch?.friendlyP1;

  elements.cacheText.innerHTML = `<span class="status-rot">5p Xoay tua</span> | <span class="status-pri">30p Core</span>`;

  let tooltipText = `● LỊCH TẢI VẬT PHẨM (TRÁNH DỒN TẢI):\n` +
    `• Xoay tua 5 phút: Cứ mỗi 5 phút làm mới 2 mục lần lượt.\n` +
    `  - Kế tiếp trong hàng đợi: [${nextP1}]\n`;
  if (lastP1) {
    tooltipText += `  - Đợt vừa tải: [${lastP1}]\n`;
  }
  tooltipText += `• Priority 30 phút: Currency, Scarabs, Fragments (${updated.toLocaleTimeString()})\n` +
    `👉 Bấm biểu tượng xoay để kích hoạt tải ngay.`;

  elements.cacheStatusPill.title = tooltipText;
}

function updateHeaderRates() {
  const isPoe2 = state.currentGame === 'poe2';

  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 457.3;
    elements.divinePriceText.textContent = `${exRate} Ex`;
    elements.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${exRate}</strong> Ex`;
    elements.tickerMirrorDiv.innerHTML = `1 <span style="color:#f2a93b;">Mirror</span> = <strong>~22k</strong> Div`;
  } else {
    if (state.rates.divinePriceInChaos > 0) {
      elements.divinePriceText.textContent = `${state.rates.divinePriceInChaos.toLocaleString()} C`;
      elements.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${state.rates.divinePriceInChaos.toLocaleString()}</strong> C`;
    }
    if (state.rates.mirrorPriceInChaos > 0 && state.rates.divinePriceInChaos > 0) {
      const mirrorInDiv = Math.round(state.rates.mirrorPriceInChaos / state.rates.divinePriceInChaos);
      elements.mirrorPriceText.textContent = `${mirrorInDiv.toLocaleString()} Div`;
    }
  }

  updateConverterFromPrimary();
}

// ==========================================================================
// Filtering & Instant Search Engine
// ==========================================================================
function filterAndRender() {
  const globalQ = state.searchQuery.trim().toLowerCase();
  const subQ = state.subFilterQuery.trim().toLowerCase();
  const query = globalQ || subQ;
  const category = state.activeCategory;

  let results = state.items;

  // 1. Category filter (if not searching globally)
  if (!globalQ && category !== 'all') {
    results = results.filter(item => item.category === category || item.subCategory === category);
  }

  // 2. Search query filter (Multi-token instant matching)
  if (query) {
    const tokens = query.split(/\s+/).filter(Boolean);
    results = results.filter(item => {
      const name = (item.name || '').toLowerCase();
      const base = (item.baseType || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return tokens.every(token => name.includes(token) || base.includes(token) || cat.includes(token));
    });
  }

  // 3. Multi-Column Sorting
  results = applySort(results, query);

  state.filteredItems = results;
  renderResults(results);
}

function renderResults(items) {
  const displayItems = items.slice(0, 300); // Cap at 300 to display full category sets instantly

  if (items.length === 0) {
    elements.itemsTableBody.innerHTML = '';
    elements.itemsGrid.innerHTML = '';
    elements.emptyState.style.display = 'block';
    elements.resultsCount.textContent = '0 items found';
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.resultsCount.innerHTML = `Showing <strong>${displayItems.length}</strong> of <strong>${items.length.toLocaleString()}</strong> items`;

  // Render Table
  renderTable(displayItems);

  // Render Grid
  renderGrid(displayItems);
}

// ==========================================================================
// Multi-Column Sorting Logic
// ==========================================================================
function applySort(items, query) {
  const col = state.sortColumn || 'value';
  const dir = state.sortDirection === 'asc' ? 1 : -1;
  const isPoe2 = state.currentGame === 'poe2';

  return items.sort((a, b) => {
    // If user is actively searching, exact & prefix matches always stay on top
    if (query) {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aExact = aName === query;
      const bExact = bName === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aName.startsWith(query);
      const bStarts = bName.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
    }

    if (col === 'name') {
      return dir * (a.name || '').localeCompare(b.name || '');
    } else if (col === 'change7d') {
      const aVal = typeof a.change7d === 'number' ? a.change7d : 0;
      const bVal = typeof b.change7d === 'number' ? b.change7d : 0;
      return dir * (aVal - bVal);
    } else if (col === 'volume') {
      const aVal = typeof a.volume === 'number' ? a.volume : 0;
      const bVal = typeof b.volume === 'number' ? b.volume : 0;
      return dir * (aVal - bVal);
    } else {
      // Default: 'value'
      const aVal = isPoe2 ? (a.divineValue || 0) : (a.chaosValue || 0);
      const bVal = isPoe2 ? (b.divineValue || 0) : (b.chaosValue || 0);
      return dir * (aVal - bVal);
    }
  });
}

window.handleSort = function(col) {
  if (state.sortColumn === col) {
    state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
  } else {
    state.sortColumn = col;
    state.sortDirection = col === 'name' ? 'asc' : 'desc';
  }
  updateSortIndicators();
  filterAndRender();
};

function updateSortIndicators() {
  const cols = ['name', 'value', 'change7d', 'volume'];
  const indMap = {
    name: elements.sortIndName,
    value: elements.sortIndValue,
    change7d: elements.sortIndTrend,
    volume: elements.sortIndVolume
  };
  const thMap = {
    name: elements.thName,
    value: elements.thValue,
    change7d: elements.thTrend,
    volume: elements.thVolume
  };

  cols.forEach(c => {
    const ind = indMap[c];
    const th = thMap[c];
    if (ind && th) {
      if (state.sortColumn === c) {
        th.classList.add('sorted');
        ind.textContent = state.sortDirection === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('sorted');
        ind.textContent = '↕';
      }
    }
  });
}

// ==========================================================================
// Table Rendering (Exact PoE Ninja Layout)
// ==========================================================================
function renderTable(items) {
  const isPoe2 = state.currentGame === 'poe2';

  const rows = items.map(item => {
    const rarity = PoeItemDescriptions.getItemRarity(item);
    const wikiUrl = PoeItemDescriptions.getWikiUrl(item);
    const trendHtml = getTrendHtml(item.change7d);
    const sparklineSvg = renderSparklineSvg(item.sparkline, item.change7d >= 0);

    const valueCellHtml = formatTableValueCell(item, isPoe2);
    const volumeFormatted = formatVolume(item.volume);
    const popularPair = formatPopularPair(item, isPoe2);

    return `
      <tr data-id="${item.id}" onmouseenter="showItemTooltip(event, '${item.id}')" onmouseleave="hideItemTooltip(event)">
        <td class="col-name">
          <div class="table-name-cell">
            <img class="table-item-icon" src="${item.icon || DEFAULT_FALLBACK_ICON}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='${DEFAULT_FALLBACK_ICON}'"/>
            <div class="table-name-wrap">
              <a href="javascript:void(0)" class="item-link-name rarity-${rarity}" onclick="openItemModal('${item.id}')">${escapeHtml(item.name)}</a>
              <a href="${wikiUrl}" target="_blank" rel="noopener" class="wiki-badge" title="Mở trang Wiki của ${escapeHtml(item.name)}">
                WIKI ↗
              </a>
            </div>
          </div>
        </td>
        <td class="col-value text-right">
          ${valueCellHtml}
        </td>
        <td class="col-trend text-center">
          <div style="display:flex; align-items:center; justify-content:center;">
            ${sparklineSvg}
            ${trendHtml}
          </div>
        </td>
        <td class="col-volume text-right">
          <span style="font-family:var(--font-mono); color:#cbd5e1;">${volumeFormatted}</span>
        </td>
        <td class="col-popular text-center">
          <span class="exchange-pair">${popularPair}</span>
        </td>
        <td class="col-action text-center">
          <button class="btn-icon" style="width:26px; height:26px; margin:0 auto;" onclick="openItemModal('${item.id}')" title="Tính số lượng & xem chi tiết">
            🧮
          </button>
        </td>
      </tr>
    `;
  }).join('');

  elements.itemsTableBody.innerHTML = rows;
}

function formatTableValueCell(item, isPoe2) {
  const mode = state.valueDisplayMode;

  if (isPoe2) {
    if (mode === 'divine' || (mode === 'adaptive' && item.divineValue >= 1)) {
      return `
        <div class="value-display">
          <span>${formatDivine(item.divineValue)}</span>
          <img class="mini-ico" src="https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png" alt="Div"/>
        </div>
      `;
    }
    return `
      <div class="value-display">
        <span>${formatExalted(item.exaltedValue)}</span>
        <img class="mini-ico" src="https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png" alt="Ex"/>
      </div>
    `;
  }

  if (mode === 'divine' || (mode === 'adaptive' && item.divineValue >= 1)) {
    return `
      <div class="value-display">
        <span style="color:var(--text-gold); font-weight:700;">${formatDivine(item.divineValue)}</span>
        <img class="mini-ico" src="https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MX1d/ec48896769/CurrencyModValues.png" alt="Div"/>
      </div>
    `;
  }
  return `
    <div class="value-display">
      <span>${formatChaos(item.chaosValue)}</span>
      <img class="mini-ico" src="https://web.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjF9XQ/46a2347805/CurrencyRerollRare.png" alt="C"/>
    </div>
  `;
}

function formatPopularPair(item, isPoe2) {
  if (isPoe2) {
    if (item.divineValue >= 1) {
      return `1.0 Div ⇄ ${formatExalted(item.exaltedValue)}`;
    }
    return `${formatExalted(item.exaltedValue)} ⇄ 1.0 item`;
  }

  if (item.divineValue >= 1) {
    return `1.0 Div ⇄ ${Math.round(item.chaosValue)} C`;
  }
  return `${formatChaos(item.chaosValue)} ⇄ 1.0 item`;
}

function formatVolume(val) {
  if (!val || typeof val !== 'number') return '─';
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
  return Math.round(val).toString();
}

// ==========================================================================
// Grid Rendering (Card Mode)
// ==========================================================================
function renderGrid(items) {
  const isPoe2 = state.currentGame === 'poe2';
  const primaryLabel = isPoe2 ? 'Giá Exalted' : 'Giá Chaos';

  const html = items.map(item => {
    const rarity = PoeItemDescriptions.getItemRarity(item);
    const trendHtml = getTrendHtml(item.change7d);
    const sparklineSvg = renderSparklineSvg(item.sparkline, item.change7d >= 0);
    const primaryPriceFormatted = isPoe2 ? formatExalted(item.exaltedValue) : formatChaos(item.chaosValue);
    const wikiUrl = PoeItemDescriptions.getWikiUrl(item);

    return `
      <div class="item-card" data-id="${item.id}" onclick="openItemModal('${item.id}')" onmouseenter="showItemTooltip(event, '${item.id}')" onmouseleave="hideItemTooltip(event)">
        <div class="card-header">
          <div class="card-icon-wrap">
            <img class="card-icon" src="${item.icon || DEFAULT_FALLBACK_ICON}" alt="${escapeHtml(item.name)}" loading="lazy" onerror="this.src='${DEFAULT_FALLBACK_ICON}'"/>
          </div>
          <div class="card-title-group">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 class="card-item-name rarity-${rarity}" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h3>
              <a href="${wikiUrl}" target="_blank" rel="noopener" class="wiki-badge" onclick="event.stopPropagation()">WIKI ↗</a>
            </div>
            <p class="card-item-category">${escapeHtml(item.baseType || item.category)}</p>
          </div>
        </div>

        <div class="card-price-row">
          <div class="price-unit">
            <span class="price-label">${primaryLabel}</span>
            <span class="price-val chaos-val">${primaryPriceFormatted}</span>
          </div>
          <div class="price-unit text-right">
            <span class="price-label">Giá Divine</span>
            <span class="price-val divine-val">${formatDivine(item.divineValue)}</span>
          </div>
        </div>

        <div class="card-footer">
          ${trendHtml}
          ${sparklineSvg}
        </div>
      </div>
    `;
  }).join('');

  elements.itemsGrid.innerHTML = html;
}

// Sparkline SVG generator
function renderSparklineSvg(data, isPositive) {
  if (!Array.isArray(data) || data.length < 2) {
    return `<div class="sparkline-svg"></div>`;
  }

  const validData = data.filter(n => typeof n === 'number' && !isNaN(n));
  if (validData.length < 2) return `<div class="sparkline-svg"></div>`;

  const min = Math.min(...validData);
  const max = Math.max(...validData);
  const range = max - min || 1;

  const width = 75;
  const height = 18;
  const step = width / (validData.length - 1);

  const points = validData.map((val, i) => {
    const x = (i * step).toFixed(1);
    const y = (height - ((val - min) / range) * (height - 4) - 2).toFixed(1);
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return `
    <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}">
      <polyline
        fill="none"
        stroke="${strokeColor}"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
    </svg>
  `;
}

// ==========================================================================
// IN-GAME STYLE HOVER TOOLTIP (PoE Ninja Replica)
// ==========================================================================
window.showItemTooltip = function(event, itemId) {
  if (state.tooltipPinned) return;

  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  state.activeHoveredItem = item;
  const tooltipData = PoeItemDescriptions.getTooltip(item);
  if (!tooltipData) return;

  // Title & Rarity
  elements.ttTitle.textContent = tooltipData.title;
  elements.ttTitle.className = `tooltip-title rarity-${tooltipData.rarity}`;

  // BaseType
  if (tooltipData.baseType) {
    elements.ttBaseType.textContent = tooltipData.baseType;
    elements.ttBaseType.style.display = 'block';
  } else {
    elements.ttBaseType.style.display = 'none';
  }

  // Implicits
  if (tooltipData.implicits && tooltipData.implicits.length > 0) {
    elements.ttImplicits.innerHTML = tooltipData.implicits.map(m => `<div>${escapeHtml(m)}</div>`).join('');
    elements.ttImplicits.style.display = 'block';
    elements.ttDiv1.style.display = 'block';
  } else {
    elements.ttImplicits.style.display = 'none';
    elements.ttDiv1.style.display = 'none';
  }

  // Magic line
  if (tooltipData.magicLine) {
    elements.ttMagic.textContent = tooltipData.magicLine;
    elements.ttMagic.style.display = 'block';
  } else {
    elements.ttMagic.style.display = 'none';
  }

  // Explicits
  if (tooltipData.explicits && tooltipData.explicits.length > 0) {
    elements.ttExplicits.innerHTML = tooltipData.explicits.map(m => `<div>${escapeHtml(m)}</div>`).join('');
    elements.ttExplicits.style.display = 'block';
    elements.ttDiv2.style.display = 'block';
  } else {
    elements.ttExplicits.style.display = 'none';
    elements.ttDiv2.style.display = 'none';
  }

  // Instructions
  if (tooltipData.instructions) {
    elements.ttInstructions.textContent = tooltipData.instructions;
    elements.ttInstructions.style.display = 'block';
  } else {
    elements.ttInstructions.style.display = 'none';
  }

  // Flavour
  if (tooltipData.flavour) {
    elements.ttFlavour.textContent = `"${tooltipData.flavour}"`;
    elements.ttFlavour.style.display = 'block';
  } else {
    elements.ttFlavour.style.display = 'none';
  }

  // Artwork icon
  elements.ttIcon.src = tooltipData.icon || DEFAULT_FALLBACK_ICON;

  positionTooltip(event.clientX, event.clientY);
  elements.poeTooltip.style.display = 'block';
};

window.hideItemTooltip = function(event) {
  if (state.tooltipPinned) return;
  elements.poeTooltip.style.display = 'none';
  state.activeHoveredItem = null;
};

function positionTooltip(x, y) {
  const tt = elements.poeTooltip;
  const margin = 18;
  let left = x + margin;
  let top = y - 40;

  const ttWidth = 320;
  const ttHeight = tt.offsetHeight || 220;

  if (left + ttWidth > window.innerWidth - 10) {
    left = x - ttWidth - margin;
  }
  if (top + ttHeight > window.innerHeight - 10) {
    top = window.innerHeight - ttHeight - 10;
  }
  if (top < 10) top = 10;

  tt.style.left = `${left}px`;
  tt.style.top = `${top}px`;
}

function toggleTooltipPin() {
  state.tooltipPinned = !state.tooltipPinned;
  elements.poeTooltip.classList.toggle('pinned', state.tooltipPinned);
  elements.tooltipPinBtn.title = state.tooltipPinned ? 'Bỏ ghim (Esc)' : 'Ghim bảng miêu tả';
  if (!state.tooltipPinned) {
    elements.poeTooltip.style.display = 'none';
  }
}

function unpinTooltip() {
  state.tooltipPinned = false;
  elements.poeTooltip.classList.remove('pinned');
  elements.poeTooltip.style.display = 'none';
}

// ==========================================================================
// Item Detail & Calculator Modal
// ==========================================================================
window.openItemModal = function(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  state.selectedItem = item;
  const isPoe2 = state.currentGame === 'poe2';
  const rarity = PoeItemDescriptions.getItemRarity(item);
  const tooltipData = PoeItemDescriptions.getTooltip(item);

  elements.modalItemIcon.src = item.icon || DEFAULT_FALLBACK_ICON;
  elements.modalItemName.textContent = item.name;
  elements.modalItemName.className = `modal-item-name rarity-${rarity}`;
  elements.modalItemSub.textContent = `${item.baseType || item.category} • ${item.subCategory || ''}`;

  elements.modalLabelPrimary.textContent = isPoe2 ? 'Giá Exalted' : 'Giá Chaos';
  elements.modalChaosVal.textContent = isPoe2 ? formatExalted(item.exaltedValue) : formatChaos(item.chaosValue);
  elements.modalDivineVal.textContent = formatDivine(item.divineValue);

  const trendHtml = getTrendHtml(item.change7d);
  elements.modalTrendVal.innerHTML = trendHtml;

  // Description Content
  let descHtml = '';
  if (tooltipData.magicLine) {
    descHtml += `<div style="color:var(--text-magic-blue); margin-bottom:4px;">${escapeHtml(tooltipData.magicLine)}</div>`;
  }
  if (tooltipData.instructions) {
    descHtml += `<div style="color:#94a3b8; font-size:0.8rem; margin-bottom:6px;">${escapeHtml(tooltipData.instructions)}</div>`;
  }
  if (tooltipData.explicits && tooltipData.explicits.length > 0) {
    descHtml += `<div style="color:#8888ff; margin-bottom:6px;">${tooltipData.explicits.map(m => `<div>${escapeHtml(m)}</div>`).join('')}</div>`;
  }
  if (tooltipData.flavour) {
    descHtml += `<div style="color:#af6025; font-style:italic; font-size:0.8rem;">"${escapeHtml(tooltipData.flavour)}"</div>`;
  }
  elements.modalDescContent.innerHTML = descHtml || '<span style="color:#64748b;">Chưa có thêm thông tin chi tiết.</span>';

  // Configure Stack button label
  const cardKey = (item.detailsId || item.key || item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const card = PoeItemDescriptions.divinationCards?.[cardKey];
  if (elements.modalStackBtn) {
    if (card && card.count) {
      elements.modalStackBtn.textContent = `Full Stack (${card.count})`;
    } else if (item.category === 'Currency' || item.category === 'Scarabs') {
      elements.modalStackBtn.textContent = 'Stack (20)';
    } else {
      elements.modalStackBtn.textContent = 'Stack (10)';
    }
  }

  if (elements.modalCalcPrimarySym) {
    elements.modalCalcPrimarySym.textContent = isPoe2 ? 'Ex' : 'C';
  }

  // Chart
  elements.modalSparklineWrap.innerHTML = renderSparklineSvg(item.sparkline, item.change7d >= 0);

  // Qty reset to 1
  elements.modalQtyInput.value = 1;
  updateModalQuantityCalc();

  // Links
  elements.modalWikiLink.href = PoeItemDescriptions.getWikiUrl(item);
  const leagueParam = encodeURIComponent(state.currentLeague);
  const typeParam = encodeURIComponent(item.subCategory || 'Currency');
  elements.modalNinjaLink.href = `https://poe.ninja/${state.currentGame}/economy/${leagueParam}/${typeParam}`;

  elements.itemModal.style.display = 'flex';
};

window.setModalQty = function(n) {
  elements.modalQtyInput.value = n;
  updateModalQuantityCalc();
};

window.setModalStackQty = function() {
  if (!state.selectedItem) return;
  const key = (state.selectedItem.detailsId || state.selectedItem.key || state.selectedItem.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const card = PoeItemDescriptions.divinationCards?.[key];
  if (card && card.count) {
    elements.modalQtyInput.value = card.count;
  } else if (state.selectedItem.category === 'Currency' || state.selectedItem.category === 'Scarabs') {
    elements.modalQtyInput.value = 20;
  } else {
    elements.modalQtyInput.value = 10;
  }
  updateModalQuantityCalc();
};

function closeModal() {
  elements.itemModal.style.display = 'none';
  state.selectedItem = null;
}

function updateModalQuantityCalc() {
  if (!state.selectedItem) return;
  const qty = parseInt(elements.modalQtyInput.value, 10) || 1;
  const isPoe2 = state.currentGame === 'poe2';

  if (isPoe2) {
    const totalEx = (state.selectedItem.exaltedValue * qty);
    const totalDivine = (state.selectedItem.divineValue * qty);
    elements.modalCalcChaos.textContent = formatExalted(totalEx);
    elements.modalCalcDivine.textContent = formatDivine(totalDivine);
  } else {
    const totalChaos = (state.selectedItem.chaosValue * qty);
    const totalDivine = (state.selectedItem.divineValue * qty);
    elements.modalCalcChaos.textContent = formatChaos(totalChaos);
    elements.modalCalcDivine.textContent = formatDivine(totalDivine);
  }
}

function copyModalPriceToClipboard() {
  if (!state.selectedItem) return;
  const qty = parseInt(elements.modalQtyInput.value, 10) || 1;
  const item = state.selectedItem;
  const isPoe2 = state.currentGame === 'poe2';

  let textToCopy = '';
  if (isPoe2) {
    const totalEx = formatExalted(item.exaltedValue * qty);
    const totalDivine = formatDivine(item.divineValue * qty);
    textToCopy = `[PoE Ninja] ${qty}x ${item.name} = ${totalDivine} (~${totalEx})`;
  } else {
    const totalChaos = formatChaos(item.chaosValue * qty);
    const totalDivine = formatDivine(item.divineValue * qty);
    textToCopy = `[PoE Ninja] ${qty}x ${item.name} = ${totalChaos} (~${totalDivine})`;
  }

  navigator.clipboard.writeText(textToCopy).then(() => {
    elements.modalCopyPriceBtn.textContent = '✓ Đã sao chép!';
    elements.modalCopyPriceBtn.style.background = 'var(--green-trend)';
    setTimeout(() => {
      elements.modalCopyPriceBtn.textContent = 'Sao chép giá';
      elements.modalCopyPriceBtn.style.background = '';
    }, 1800);
    showToast(`Đã sao chép: "${textToCopy}"`, 'success');
  }).catch(() => {
    showToast('Không thể sao chép vào bộ nhớ tạm', 'error');
  });
}

// ==========================================================================
// In-game Item Text Clipboard Paste (Ctrl + C from game)
// ==========================================================================
async function handleGlobalPaste(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const clipboardText = e.clipboardData ? e.clipboardData.getData('text') : '';
  if (clipboardText) {
    processPastedItem(clipboardText);
  }
}

async function handlePasteButtonClick() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      processPastedItem(text);
    } else {
      showToast('Clipboard trống!', 'warning');
    }
  } catch (err) {
    const manual = prompt('Dán thông tin vật phẩm (Ctrl + C từ game PoE) vào đây:');
    if (manual) processPastedItem(manual);
  }
}

function processPastedItem(text) {
  const parsed = PoeItemParser.parse(text);
  if (!parsed || !parsed.searchQuery) {
    showToast('Không nhận diện được vật phẩm PoE!', 'warning');
    return;
  }

  const query = parsed.searchQuery;
  elements.searchInput.value = query;
  state.searchQuery = query;
  elements.searchClearBtn.style.display = 'block';

  filterAndRender();

  if (state.filteredItems.length > 0) {
    const matched = state.filteredItems[0];
    openItemModal(matched.id);
    showToast(`Đã nhận diện: ${matched.name} (${matched.category})`, 'success');
  } else {
    showToast(`Đã tìm kiếm: "${query}"`, 'info');
  }
}

// ==========================================================================
// Currency Quick Converter
// ==========================================================================
function updateConverterFromPrimary() {
  const isPoe2 = state.currentGame === 'poe2';
  const inputVal = parseFloat(elements.convChaosInput.value) || 0;

  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 457.3;
    const div = exRate > 0 ? +(inputVal / exRate).toFixed(3) : 0;
    elements.convDivineInput.value = div;
  } else {
    const rate = state.rates.divinePriceInChaos;
    if (rate > 0) {
      const div = +(inputVal / rate).toFixed(3);
      elements.convDivineInput.value = div;
    }
  }
}

function updateConverterFromDivine() {
  const isPoe2 = state.currentGame === 'poe2';
  const div = parseFloat(elements.convDivineInput.value) || 0;

  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 457.3;
    const ex = +(div * exRate).toFixed(1);
    elements.convChaosInput.value = ex;
  } else {
    const rate = state.rates.divinePriceInChaos;
    if (rate > 0) {
      const chaos = +(div * rate).toFixed(1);
      elements.convChaosInput.value = chaos;
    }
  }
}

// ==========================================================================
// Utility Helpers
// ==========================================================================
function getTrendHtml(change) {
  const num = typeof change === 'number' ? change : 0;
  if (num > 0) {
    return `<span class="trend-badge up">+${num.toFixed(0)}%</span>`;
  } else if (num < 0) {
    return `<span class="trend-badge down">${num.toFixed(0)}%</span>`;
  }
  return `<span class="trend-badge neutral">0%</span>`;
}

function formatChaos(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0 C';
  if (val >= 1000) return `${Math.round(val).toLocaleString()} C`;
  return `${+val.toFixed(1)} C`;
}

function formatExalted(val) {
  if (typeof val !== 'number' || isNaN(val)) return '0 Ex';
  if (val >= 100) return `${Math.round(val).toLocaleString()} Ex`;
  return `${+val.toFixed(1)} Ex`;
}

function formatDivine(val) {
  if (typeof val !== 'number' || isNaN(val) || val === 0) return '0 Div';
  if (val >= 100) return `${Math.round(val).toLocaleString()} Div`;
  return `${+val.toFixed(2)} Div`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}
