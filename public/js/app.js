/**
 * PoE Quick Price Checker v1.0.0 - Modular Orchestrator
 * Data-Driven Categories, Pure Event Delegation, Zero Inline Handlers
 */

import { state } from './modules/state.js';
import { Api } from './modules/api.js';
import { Search } from './modules/search.js';
import { Render } from './modules/render.js';
import { Modals } from './modules/modals.js';
import { Clipboard } from './modules/clipboard.js';

// DOM Elements Cache
const dom = {};

function initDom() {
  // Navigation & Game Selector
  dom.sidebar = document.getElementById('sidebar');
  dom.sidebarNav = document.getElementById('sidebarNav');
  dom.btnPoe1 = document.getElementById('btnPoe1');
  dom.btnPoe2 = document.getElementById('btnPoe2');
  dom.leagueSelect = document.getElementById('leagueSelect');

  // Rates Ticker & Status
  dom.divinePriceText = document.getElementById('divinePriceText');
  dom.mirrorPriceText = document.getElementById('mirrorPriceText');
  dom.tickerDivineChaos = document.getElementById('tickerDivineChaos');
  dom.tickerMirrorDiv = document.getElementById('tickerMirrorDiv');
  dom.cacheStatusPill = document.getElementById('cacheStatusPill');
  dom.btnRefreshAll = document.getElementById('btnRefreshAll');
  dom.btnRefreshCategory = document.getElementById('btnRefreshCategory');
  dom.btnDiagnostics = document.getElementById('btnDiagnostics');
  dom.btnAlerts = document.getElementById('btnAlerts');
  dom.btnSettings = document.getElementById('btnSettings');
  dom.btnCompareDrawer = document.getElementById('btnCompareDrawer');
  dom.compareCountBadge = document.getElementById('compareCountBadge');

  // Search & Views
  dom.searchInput = document.getElementById('searchInput');
  dom.clearSearchBtn = document.getElementById('clearSearchBtn');
  dom.resultsCount = document.getElementById('resultsCount');
  dom.currentCategoryTitle = document.getElementById('currentCategoryTitle');
  dom.breadcrumbCategory = document.getElementById('breadcrumbCategory');
  dom.filterChips = document.querySelectorAll('.chip-btn');
  dom.viewTableBtn = document.getElementById('viewTableBtn');
  dom.viewGridBtn = document.getElementById('viewGridBtn');
  dom.tableView = document.getElementById('tableView');
  dom.gridView = document.getElementById('gridView');
  dom.itemsTableBody = document.getElementById('itemsTableBody');
  dom.itemsGrid = document.getElementById('itemsGrid');
  dom.pagination = document.getElementById('pagination');

  // Table Sort Headers
  dom.itemsTableHeader = document.getElementById('itemsTableHeader');
  dom.sortHeaders = document.querySelectorAll('.sortable-th');

  // Mobile Drawer Navigation
  dom.btnMobileMenu = document.getElementById('btnMobileMenu');
  dom.sidebarBackdrop = document.getElementById('sidebarBackdrop');

  // Calculator & Item Inspection Modal
  dom.itemInspectOverlay = document.getElementById('itemInspectOverlay');
  dom.closeInspectModal = document.getElementById('closeInspectModal');
  dom.btnInspectBack = document.getElementById('btnInspectBack');
  dom.inspectCategoryCrumb = document.getElementById('inspectCategoryCrumb');
  dom.inspectIcon = document.getElementById('inspectIcon');
  dom.inspectName = document.getElementById('inspectName');
  dom.inspectLeagueTag = document.getElementById('inspectLeagueTag');
  dom.inspectTypeTag = document.getElementById('inspectTypeTag');
  dom.inspectMainPrice = document.getElementById('inspectMainPrice');
  dom.inspectMainCur = document.getElementById('inspectMainCur');
  dom.inspectTrendBadge = document.getElementById('inspectTrendBadge');
  dom.inspectSubPrice = document.getElementById('inspectSubPrice');
  dom.inspectRateNote = document.getElementById('inspectRateNote');
  dom.btnInspectWhisper = document.getElementById('btnInspectWhisper');
  dom.inspectWikiLink = document.getElementById('inspectWikiLink');
  dom.inspectNinjaLink = document.getElementById('inspectNinjaLink');
  dom.poeCardName = document.getElementById('poeCardName');
  dom.poeCardType = document.getElementById('poeCardType');
  dom.poeCardMods = document.getElementById('poeCardMods');
  dom.poeCardFlavourSep = document.getElementById('poeCardFlavourSep');
  dom.poeCardFlavour = document.getElementById('poeCardFlavour');
  dom.inspectChartSummary = document.getElementById('inspectChartSummary');
  dom.inspectChartContainer = document.getElementById('inspectChartContainer');
  dom.inspectRankText = document.getElementById('inspectRankText');
  dom.inspectRankPercentile = document.getElementById('inspectRankPercentile');
  dom.inspectRankBar = document.getElementById('inspectRankBar');
  dom.inspectVolumeStat = document.getElementById('inspectVolumeStat');
  dom.inspectAvgStat = document.getElementById('inspectAvgStat');
  dom.inspectRelatedList = document.getElementById('inspectRelatedList');
  dom.sidebarCategoryFilter = document.getElementById('sidebarCategoryFilter');

  // Backward compatibility dom elements
  dom.calcModalOverlay = dom.itemInspectOverlay;
  dom.closeCalcModal = dom.closeInspectModal;

  // Quick Currency Converter
  dom.convChaosInput = document.getElementById('convChaosInput');
  dom.convDivineInput = document.getElementById('convDivineInput');
  dom.convPrimarySym = document.getElementById('convPrimarySym');

  // PoE In-Game Floating Tooltip
  dom.poeFloatingTooltip = document.getElementById('poeFloatingTooltip');
  dom.tooltipTitle = document.getElementById('tooltipTitle');
  dom.tooltipBasetype = document.getElementById('tooltipBasetype');
  dom.tooltipMagic = document.getElementById('tooltipMagic');
  dom.tooltipInstructions = document.getElementById('tooltipInstructions');
  dom.tooltipExplicits = document.getElementById('tooltipExplicits');
  dom.tooltipDivider = document.getElementById('tooltipDivider');
  dom.tooltipFlavour = document.getElementById('tooltipFlavour');
  dom.tooltipFooter = document.getElementById('tooltipFooter');
  dom.tooltipIcon = document.getElementById('tooltipIcon');
  dom.tooltipPinBtn = document.getElementById('tooltipPinBtn');
}

// Current categories available for the active game+league
let currentAvailableCategories = [];
let warmingPollTimer = null;

// ==========================================================================
// Initialization & League Boot
// ==========================================================================
async function init() {
  initDom();

  // Sync initial UI classes from loaded preferences
  dom.btnPoe1.classList.toggle('active', state.currentGame === 'poe1');
  dom.btnPoe2.classList.toggle('active', state.currentGame === 'poe2');
  dom.viewTableBtn.classList.toggle('active', state.currentView === 'table');
  dom.viewGridBtn.classList.toggle('active', state.currentView === 'grid');
  updateSortHeaderUI();
  updateFilterChipsForGame(state.currentGame);

  bindEvents();

  // 1. Fetch dynamic leagues list
  await loadLeagues();

  // 2. Fetch data-driven categories and items
  await loadCategoriesAndData();

  // 3. Setup In-Game Paste scanner
  Clipboard.initPasteListener((parsed) => {
    dom.searchInput.value = parsed.searchQuery;
    dom.clearSearchBtn.classList.remove('hidden');
    state.searchQuery = parsed.searchQuery;
    filterAndRender();

    const match = state.filteredItems[0];
    if (match) {
      Clipboard.showToast(`Đã nhận diện: ${match.name}`, 'success');
      Modals.openCalculator(match, state, dom);
    } else {
      Clipboard.showToast(`Đã tìm kiếm: "${parsed.searchQuery}"`, 'info');
    }
  });

  // 4. Background status poll
  setInterval(updateStatusUI, 60000);
}

async function loadLeagues() {
  try {
    const leaguesData = await Api.fetchLeagues();
    state.availableLeagues = leaguesData;
    populateLeagueSelect();
  } catch (err) {
    console.warn('Failed to load dynamic leagues:', err);
  }
}

function populateLeagueSelect() {
  const leagues = state.availableLeagues[state.currentGame] || [];
  dom.leagueSelect.innerHTML = '';

  if (leagues.length === 0) {
    const defaultName = state.currentGame === 'poe2' ? 'Forbidden Rites' : 'Allflame';
    dom.leagueSelect.innerHTML = `<option value="${defaultName}">${defaultName}</option>`;
    state.currentLeague = defaultName;
    return;
  }

  for (const l of leagues) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    if (l.default) opt.selected = true;
    dom.leagueSelect.appendChild(opt);
  }

  const selected = leagues.find(l => l.default) || leagues[0];
  state.currentLeague = selected.id;
}

// ==========================================================================
// Data-Driven Categories & League Data Loading
// ==========================================================================
async function loadCategoriesAndData() {
  if (warmingPollTimer) {
    clearInterval(warmingPollTimer);
    warmingPollTimer = null;
  }

  await loadCategories();
  await loadData();
}

async function loadCategories() {
  try {
    const res = await Api.fetchCategories(state.currentGame, state.currentLeague);
    currentAvailableCategories = res.categories || [];

    // Check if activeCategory is still available in this league
    const currentCatLower = (state.activeCategory || '').toLowerCase().trim();
    const stillValid = currentAvailableCategories.some(c => {
      const labelLower = c.label.toLowerCase().trim();
      const typeLower = c.type.toLowerCase().trim();
      return labelLower === currentCatLower ||
             typeLower === currentCatLower ||
             labelLower.replace(/s$/, '') === currentCatLower.replace(/s$/, '');
    });
    if (!stillValid && currentAvailableCategories.length > 0) {
      state.activeCategory = currentAvailableCategories[0].label;
    }

    renderSidebar();
    dom.breadcrumbCategory.textContent = state.activeCategory;
    dom.currentCategoryTitle.textContent = state.activeCategory;
  } catch (err) {
    console.warn('Failed to fetch categories:', err);
  }
}

async function loadData() {
  dom.resultsCount.textContent = `Đang nạp dữ liệu ${state.currentLeague}...`;
  try {
    const data = await Api.fetchItems(state.currentGame, state.currentLeague);

    if (data.status === 'warming' || data.status === 'discovering') {
      dom.resultsCount.textContent = data.message || `Đang tải và khám phá danh mục cho "${state.currentLeague}"...`;
      state.items = data.items || [];
      filterAndRender();

      // Poll every 2.5s until cache discovery/warming is fully ready
      if (!warmingPollTimer) {
        warmingPollTimer = setInterval(async () => {
          const pollData = await Api.fetchItems(state.currentGame, state.currentLeague);
          if (pollData.status === 'ready') {
            clearInterval(warmingPollTimer);
            warmingPollTimer = null;
            await loadCategories(); // Crucial: Re-fetch categories so newly discovered ones populate the sidebar!
            applyLoadedData(pollData);
          } else if (pollData.items && pollData.items.length > 0) {
            state.items = pollData.items;
            dom.resultsCount.textContent = pollData.message || `Đang khám phá danh mục (${pollData.items.length} items)...`;
            filterAndRender();
          }
        }, 2500);
      }
      return;
    }

    applyLoadedData(data);
  } catch (err) {
    console.error('Failed to load items:', err);
    Clipboard.showToast('Lỗi tải dữ liệu cache', 'error');
    dom.resultsCount.textContent = 'Không thể tải cache.';
  }
}

function applyLoadedData(data) {
  state.items = data.items || [];
  state.rates = {
    divinePriceInChaos: data.divinePriceInChaos || 0,
    mirrorPriceInChaos: data.mirrorPriceInChaos || 0,
    rawRates: data.rates || {}
  };
  state.updatedAt = data.updatedAt;

  renderSidebar();
  updateHeaderRates();
  updateStatusUI();
  filterAndRender();

  // Check Price Alerts after cache loaded
  Modals.checkPriceAlerts(state.items, state);
}

function filterAndRender() {
  const isSearching = state.searchQuery.trim().length > 0;
  state.filteredItems = Search.filterAndRank(state.items, {
    query: state.searchQuery,
    category: isSearching ? 'All' : state.activeCategory,
    subCategory: isSearching ? null : state.activeSubCategory,
    priceFilter: state.priceFilter,
    onlyFavorites: state.onlyFavorites,
    favoritesSet: state.favorites,
    game: state.currentGame
  });

  // Apply column sorting (if not searching with relevance score)
  if (!state.searchQuery.trim()) {
    applySort(state.filteredItems);
  }

  state.currentPage = 1;
  renderCurrentView();
  updateHeaderRates();
}

function applySort(items) {
  const col = state.sortColumn;
  const dir = state.sortDirection === 'asc' ? 1 : -1;

  items.sort((a, b) => {
    if (col === 'name') {
      return dir * a.name.localeCompare(b.name);
    }
    if (col === 'value') {
      const valA = state.currentGame === 'poe2' ? (a.divineValue || 0) : (a.chaosValue || 0);
      const valB = state.currentGame === 'poe2' ? (b.divineValue || 0) : (b.chaosValue || 0);
      return dir * (valA - valB);
    }
    if (col === 'change7d') {
      return dir * ((a.change7d || 0) - (b.change7d || 0));
    }
    if (col === 'volume') {
      return dir * ((a.volume || 0) - (b.volume || 0));
    }
    return 0;
  });
}

function renderCurrentView() {
  const total = state.filteredItems.length;
  if (state.searchQuery && state.searchQuery.trim()) {
    dom.resultsCount.innerHTML = `Tìm thấy <strong>${total.toLocaleString()}</strong> kết quả cho "<em>${Render.escapeHtml(state.searchQuery.trim())}</em>"`;
  } else {
    dom.resultsCount.textContent = `${total.toLocaleString()} vật phẩm`;
  }

  const totalPages = Math.ceil(total / state.pageSize) || 1;
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const pageItems = state.filteredItems.slice(startIdx, startIdx + state.pageSize);

  if (state.currentView === 'table') {
    dom.tableView.classList.remove('hidden');
    dom.gridView.classList.add('hidden');
    dom.itemsTableBody.innerHTML = Render.renderTableRows(pageItems, state);
  } else {
    dom.tableView.classList.add('hidden');
    dom.gridView.classList.remove('hidden');
    dom.itemsGrid.innerHTML = Render.renderGridCards(pageItems, state);
  }

  dom.pagination.innerHTML = Render.renderPagination(state.currentPage, totalPages);
  updateCompareBadge();
}

const SIDEBAR_GROUPS = [
  { id: 'general', label: 'GENERAL' },
  { id: 'atlas', label: 'ATLAS & MAPS' },
  { id: 'gems', label: 'EQUIPMENT & GEMS' },
  { id: 'crafting', label: 'CRAFTING' }
];

let sidebarFilterQuery = '';

// ==========================================================================
// UI Updates & Dynamic Sidebar Grouping (POESTASH style)
// ==========================================================================
function renderSidebar() {
  if (!dom.sidebarNav) return;
  dom.sidebarNav.innerHTML = '';

  const activeLower = (state.activeCategory || '').toLowerCase().trim();
  const filterQuery = (sidebarFilterQuery || '').toLowerCase().trim();

  const filteredCategories = filterQuery
    ? currentAvailableCategories.filter(c => 
        (c.label || '').toLowerCase().includes(filterQuery) || 
        (c.type || '').toLowerCase().includes(filterQuery)
      )
    : currentAvailableCategories;

  if (filteredCategories.length === 0) {
    dom.sidebarNav.innerHTML = `
      <div style="padding: 16px 8px; color: #64748b; font-size: 0.78rem; text-align: center;">
        Không tìm thấy danh mục phù hợp
      </div>
    `;
    return;
  }

  for (const group of SIDEBAR_GROUPS) {
    const groupCats = filteredCategories.filter(c => (c.group || 'general') === group.id);
    if (groupCats.length === 0) continue;

    const groupHeader = document.createElement('div');
    groupHeader.className = 'nav-group-header';
    groupHeader.innerHTML = `<span>${group.label}</span>`;
    dom.sidebarNav.appendChild(groupHeader);

    for (const cat of groupCats) {
      const catLabelLower = cat.label.toLowerCase().trim();
      const catTypeLower = cat.type.toLowerCase().trim();

      const count = state.items.filter(i => {
        const itemCat = (i.category || '').toLowerCase().trim();
        const itemSource = (i.sourceType || '').toLowerCase().trim();
        return itemCat === catLabelLower || itemSource === catTypeLower ||
               itemCat === catTypeLower || itemCat.replace(/s$/, '') === catLabelLower.replace(/s$/, '');
      }).length;

      const isActive = activeLower === catLabelLower || activeLower === catTypeLower || activeLower.replace(/s$/, '') === catLabelLower.replace(/s$/, '');

      const btn = document.createElement('button');
      btn.className = `nav-item ${isActive ? 'active' : ''}`;
      btn.dataset.category = cat.label;
      btn.dataset.type = cat.type;

      btn.innerHTML = `
        <span class="nav-icon ${cat.iconClass}"></span>
        <span class="nav-label">${Render.escapeHtml(cat.label)}</span>
        <span class="nav-badge">${count}</span>
      `;

      dom.sidebarNav.appendChild(btn);
    }
  }
}

// ==========================================================================
// PoE In-game Floating Tooltip Logic
// ==========================================================================
let isTooltipPinned = false;

function showItemTooltip(e, item) {
  if (!dom.poeFloatingTooltip || isTooltipPinned) return;
  if (typeof window === 'undefined' || !window.PoeItemDescriptions) return;

  const tt = window.PoeItemDescriptions.getTooltip(item);
  if (!tt) return;

  dom.tooltipTitle.textContent = tt.title || item.name;
  dom.tooltipTitle.className = `tooltip-title rarity-${tt.rarity || 'currency'}`;

  dom.tooltipBasetype.textContent = tt.baseType || tt.category || '';
  dom.tooltipMagic.textContent = tt.magicLine || '';
  dom.tooltipInstructions.textContent = tt.instructions || '';

  if (tt.explicits) {
    dom.tooltipExplicits.textContent = tt.explicits;
    dom.tooltipExplicits.classList.remove('hidden');
  } else {
    dom.tooltipExplicits.textContent = '';
    dom.tooltipExplicits.classList.add('hidden');
  }

  if (tt.flavour) {
    dom.tooltipDivider.classList.remove('hidden');
    dom.tooltipFlavour.textContent = tt.flavour;
    dom.tooltipFlavour.classList.remove('hidden');
  } else {
    dom.tooltipDivider.classList.add('hidden');
    dom.tooltipFlavour.classList.add('hidden');
  }

  const iconSrc = tt.icon || item.icon;
  if (iconSrc) {
    dom.tooltipIcon.src = iconSrc;
    dom.tooltipFooter.classList.remove('hidden');
  } else {
    dom.tooltipFooter.classList.add('hidden');
  }

  positionTooltip(e);
  dom.poeFloatingTooltip.classList.remove('hidden');
}

function positionTooltip(e) {
  if (!dom.poeFloatingTooltip || isTooltipPinned) return;
  const offset = 18;
  let x = e.clientX + offset;
  let y = e.clientY + offset;

  const ttRect = dom.poeFloatingTooltip.getBoundingClientRect();
  const w = ttRect.width || 320;
  const h = ttRect.height || 220;

  // Prevent overflowing viewport bounds
  if (x + w > window.innerWidth - 12) {
    x = Math.max(12, e.clientX - w - 14);
  }
  if (y + h > window.innerHeight - 12) {
    y = Math.max(12, window.innerHeight - h - 14);
  }

  dom.poeFloatingTooltip.style.left = `${x}px`;
  dom.poeFloatingTooltip.style.top = `${y}px`;
}

function hideItemTooltip() {
  if (!dom.poeFloatingTooltip || isTooltipPinned) return;
  dom.poeFloatingTooltip.classList.add('hidden');
}

function updateHeaderRates() {
  const isPoe2 = state.currentGame === 'poe2';
  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 0;
    dom.divinePriceText.textContent = exRate > 0 ? `${exRate} Ex` : '...';
    dom.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${exRate > 0 ? exRate : '...'}</strong> Ex`;

    const mirrorItem = state.items.find(i => i.key === 'mirror' || (i.name && i.name.toLowerCase().includes('mirror of kalandra')));
    const mirrorDiv = mirrorItem?.divineValue || 0;
    if (mirrorDiv > 0) {
      const mFormatted = mirrorDiv >= 1000 ? (mirrorDiv / 1000).toFixed(1) + 'k' : mirrorDiv.toLocaleString();
      dom.mirrorPriceText.textContent = `${mFormatted} Div`;
      dom.tickerMirrorDiv.innerHTML = `1 <span style="color:#f2a93b;">Mirror</span> = <strong>${mFormatted}</strong> Div`;
    } else {
      dom.tickerMirrorDiv.innerHTML = `1 <span style="color:#f2a93b;">Mirror</span> = <strong>...</strong> Div`;
    }
    dom.convPrimarySym.textContent = 'Ex';
  } else {
    const divChaos = state.rates.divinePriceInChaos;
    if (divChaos > 0) {
      dom.divinePriceText.textContent = `${divChaos.toLocaleString()} C`;
      dom.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${divChaos.toLocaleString()}</strong> C`;
    }
    if (state.rates.mirrorPriceInChaos > 0 && divChaos > 0) {
      const mirrorInDiv = Math.round(state.rates.mirrorPriceInChaos / divChaos);
      dom.mirrorPriceText.textContent = `${mirrorInDiv.toLocaleString()} Div`;
      dom.tickerMirrorDiv.innerHTML = `1 <span style="color:#f2a93b;">Mirror</span> = <strong>${mirrorInDiv.toLocaleString()}</strong> Div`;
    }
    dom.convPrimarySym.textContent = 'C';
  }
  updateConverterRates();
  updateFilterChipsForGame(state.currentGame);
}

function updateConverterRates() {
  if (!dom.convChaosInput || !dom.convDivineInput) return;
  const val = parseFloat(dom.convChaosInput.value) || 0;
  const isPoe2 = state.currentGame === 'poe2';
  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 0;
    dom.convDivineInput.value = exRate > 0 ? +(val / exRate).toFixed(3) : 0;
  } else {
    const divChaos = state.rates.divinePriceInChaos || 0;
    dom.convDivineInput.value = divChaos > 0 ? +(val / divChaos).toFixed(2) : 0;
  }
}

function updateFilterChipsForGame(game) {
  const chipLow = document.querySelector('.chip-btn[data-filter="<10c"]');
  const chipMid = document.querySelector('.chip-btn[data-filter="10-100c"]');
  if (game === 'poe2') {
    if (chipLow) chipLow.textContent = '< 10 Ex';
    if (chipMid) chipMid.textContent = '10 - 100 Ex';
  } else {
    if (chipLow) chipLow.innerHTML = '&lt; 10c';
    if (chipMid) chipMid.textContent = '10c - 100c';
  }
}

function updateSortHeaderUI() {
  if (!dom.itemsTableHeader) return;
  dom.itemsTableHeader.querySelectorAll('th.sortable').forEach(h => {
    h.classList.remove('sorted', 'sorted-asc', 'sorted-desc');
    const arrow = h.querySelector('.sort-indicator, .sort-arrow');
    if (arrow) arrow.textContent = '';
    if (h.dataset.sort === state.sortColumn) {
      h.classList.add('sorted', `sorted-${state.sortDirection}`);
      if (arrow) arrow.textContent = state.sortDirection === 'desc' ? '▼' : '▲';
    }
  });
}

async function updateStatusUI() {
  try {
    const status = await Api.fetchStatus();
    state.rotationInfo = status;

    if (status.isRefreshing) {
      dom.cacheStatusPill.className = 'cache-status-pill syncing';
      dom.cacheStatusPill.innerHTML = '<span class="status-dot"></span><span>Đang tải...</span>';
    } else {
      const isStale = status.summary?.[state.currentGame]?.[state.currentLeague]?.isStale;
      dom.cacheStatusPill.className = `cache-status-pill ${isStale ? 'warning' : 'synced'}`;
      dom.cacheStatusPill.innerHTML = `<span class="status-dot"></span><span>5p Xoay tua | 30p Core ${isStale ? '(Stale)' : ''}</span>`;
    }
  } catch (e) {}
}

function updateCompareBadge() {
  const count = state.compareList.size;
  dom.compareCountBadge.textContent = count;
  if (count > 0) {
    dom.btnCompareDrawer.classList.remove('hidden');
  } else {
    dom.btnCompareDrawer.classList.add('hidden');
  }
}

// ==========================================================================
// Event Delegation Handlers (Pure & Safe)
// ==========================================================================
function bindEvents() {
  // Global Image Error Fallback (Safe, zero inline onerror)
  document.body.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && (e.target.classList.contains('item-thumb') || e.target.classList.contains('grid-item-thumb'))) {
      e.target.src = 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png';
    }
  }, true);

  // Game Selector
  dom.btnPoe1.addEventListener('click', () => switchGame('poe1'));
  dom.btnPoe2.addEventListener('click', () => switchGame('poe2'));

  // Mobile Menu & Backdrop Delegation
  if (dom.btnMobileMenu && dom.sidebarBackdrop) {
    dom.btnMobileMenu.addEventListener('click', () => {
      dom.sidebar.classList.toggle('mobile-open');
      dom.sidebarBackdrop.classList.toggle('hidden');
    });

    dom.sidebarBackdrop.addEventListener('click', () => {
      dom.sidebar.classList.remove('mobile-open');
      dom.sidebarBackdrop.classList.add('hidden');
    });
  }

  // League Selector
  dom.leagueSelect.addEventListener('change', (e) => {
    state.currentLeague = e.target.value;
    loadCategoriesAndData();
  });

  // Sidebar Category Delegation
  dom.sidebarNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const cat = btn.dataset.category;
    if (!cat) return;

    try {
      // Reset search input & query so the category view updates immediately
      if (dom.searchInput) dom.searchInput.value = '';
      state.searchQuery = '';
      if (dom.clearSearchBtn) dom.clearSearchBtn.classList.add('hidden');

      state.activeCategory = cat;
      state.activeSubCategory = null;
      state.onlyFavorites = false;
      state.currentPage = 1;

      document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
      document.querySelector('.chip-btn[data-filter="all"]')?.classList.add('active');

      dom.sidebarNav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (dom.breadcrumbCategory) dom.breadcrumbCategory.textContent = cat;
      if (dom.currentCategoryTitle) dom.currentCategoryTitle.textContent = cat;

      // Close mobile drawer if open
      if (dom.sidebar) dom.sidebar.classList.remove('mobile-open');
      if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.add('hidden');
    } catch (err) {
      console.warn('Sidebar delegation pre-render warning:', err);
    }

    filterAndRender();

    // Smooth scroll content area to top
    if (window.scrollY > 80) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Search Input
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    dom.clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
    filterAndRender();
  });

  dom.clearSearchBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchQuery = '';
    dom.clearSearchBtn.classList.add('hidden');
    filterAndRender();
  });

  // Filter Chips Delegation
  document.querySelector('.filter-chips-wrap')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (!chip) return;

    dom.filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const filter = chip.dataset.filter;
    if (filter === 'fav') {
      state.onlyFavorites = true;
      state.priceFilter = 'all';
    } else {
      state.onlyFavorites = false;
      state.priceFilter = filter;
    }
    filterAndRender();
  });

  // Views Toggle
  dom.viewTableBtn.addEventListener('click', () => switchView('table'));
  dom.viewGridBtn.addEventListener('click', () => switchView('grid'));

  // Quick Currency Converter Two-Way Reactivity
  if (dom.convChaosInput && dom.convDivineInput) {
    dom.convChaosInput.addEventListener('input', () => {
      const val = parseFloat(dom.convChaosInput.value) || 0;
      const isPoe2 = state.currentGame === 'poe2';
      if (isPoe2) {
        const exRate = state.rates.rawRates?.exalted || 0;
        dom.convDivineInput.value = exRate > 0 ? +(val / exRate).toFixed(3) : 0;
      } else {
        const divChaos = state.rates.divinePriceInChaos || 0;
        dom.convDivineInput.value = divChaos > 0 ? +(val / divChaos).toFixed(2) : 0;
      }
    });

    dom.convDivineInput.addEventListener('input', () => {
      const val = parseFloat(dom.convDivineInput.value) || 0;
      const isPoe2 = state.currentGame === 'poe2';
      if (isPoe2) {
        const exRate = state.rates.rawRates?.exalted || 0;
        dom.convChaosInput.value = exRate > 0 ? Math.round(val * exRate) : 0;
      } else {
        const divChaos = state.rates.divinePriceInChaos || 0;
        dom.convChaosInput.value = divChaos > 0 ? Math.round(val * divChaos) : 0;
      }
    });
  }

  // Table Sort Delegation
  document.querySelector('.items-table-header')?.addEventListener('click', (e) => {
    const th = e.target.closest('.sortable-th');
    if (!th) return;
    const col = th.dataset.sort;
    if (!col) return;

    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortColumn = col;
      state.sortDirection = 'desc';
    }

    updateSortHeaderUI();
    applySort(state.filteredItems);
    renderCurrentView();
  });

  // Table Body Delegation
  dom.itemsTableBody.addEventListener('click', handleItemAction);
  dom.itemsGrid.addEventListener('click', handleItemAction);

  // In-Game Floating Tooltip Event Delegation
  const handleTooltipHover = (e) => {
    const el = e.target.closest('[data-tooltip-id]');
    if (el) {
      const item = state.items.find(i => i.id === el.dataset.tooltipId);
      if (item) showItemTooltip(e, item);
    }
  };

  dom.tableView.addEventListener('mouseover', handleTooltipHover);
  dom.tableView.addEventListener('mousemove', (e) => {
    if (!isTooltipPinned && dom.poeFloatingTooltip && !dom.poeFloatingTooltip.classList.contains('hidden')) {
      positionTooltip(e);
    }
  });
  dom.tableView.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tooltip-id]');
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) {
      hideItemTooltip();
    }
  });

  dom.gridView.addEventListener('mouseover', handleTooltipHover);
  dom.gridView.addEventListener('mousemove', (e) => {
    if (!isTooltipPinned && dom.poeFloatingTooltip && !dom.poeFloatingTooltip.classList.contains('hidden')) {
      positionTooltip(e);
    }
  });
  dom.gridView.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tooltip-id]');
    if (el && (!e.relatedTarget || !el.contains(e.relatedTarget))) {
      hideItemTooltip();
    }
  });

  // Tooltip Pin Toggle
  dom.tooltipPinBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    isTooltipPinned = !isTooltipPinned;
    if (isTooltipPinned) {
      dom.poeFloatingTooltip.classList.add('pinned');
      dom.tooltipPinBtn.textContent = '🔒';
      dom.tooltipPinBtn.title = 'Bỏ ghim tooltip';
    } else {
      dom.poeFloatingTooltip.classList.remove('pinned');
      dom.tooltipPinBtn.textContent = '📌';
      dom.tooltipPinBtn.title = 'Ghim tooltip';
      hideItemTooltip();
    }
  });

  // Hide pinned tooltip when clicking anywhere outside
  document.addEventListener('click', (e) => {
    if (isTooltipPinned && dom.poeFloatingTooltip && !dom.poeFloatingTooltip.contains(e.target)) {
      isTooltipPinned = false;
      dom.poeFloatingTooltip.classList.remove('pinned');
      if (dom.tooltipPinBtn) {
        dom.tooltipPinBtn.textContent = '📌';
        dom.tooltipPinBtn.title = 'Ghim tooltip';
      }
      hideItemTooltip();
    }
  });

  // Pagination Delegation
  dom.pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('.pg-btn');
    if (!btn || btn.classList.contains('disabled')) return;

    const action = btn.dataset.action;
    const totalPages = Math.ceil(state.filteredItems.length / state.pageSize) || 1;

    if (action === 'page-prev' && state.currentPage > 1) {
      state.currentPage--;
    } else if (action === 'page-next' && state.currentPage < totalPages) {
      state.currentPage++;
    } else if (action === 'page-goto') {
      state.currentPage = parseInt(btn.dataset.page, 10) || 1;
    }
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Per-category Refresh
  dom.btnRefreshCategory.addEventListener('click', async () => {
    dom.btnRefreshCategory.classList.add('fa-spin');
    Clipboard.showToast(`Đang làm mới danh mục "${state.activeCategory}"...`);
    try {
      await Api.refreshCategory(state.currentGame, state.currentLeague, state.activeCategory);
      await loadCategoriesAndData();
      Clipboard.showToast(`Đã làm mới "${state.activeCategory}" thành công!`, 'success');
    } catch (err) {
      Clipboard.showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      dom.btnRefreshCategory.classList.remove('fa-spin');
    }
  });

  // Full Refresh with Status Polling (No blind setTimeout!)
  dom.btnRefreshAll.addEventListener('click', async () => {
    dom.btnRefreshAll.classList.add('fa-spin');
    Clipboard.showToast('Bắt đầu đồng bộ toàn bộ cache...');
    try {
      await Api.refreshAll();
      
      // Poll /api/status until isRefreshing becomes false
      const pollInterval = setInterval(async () => {
        const st = await Api.fetchStatus();
        if (!st.isRefreshing) {
          clearInterval(pollInterval);
          dom.btnRefreshAll.classList.remove('fa-spin');
          await loadCategoriesAndData();
          Clipboard.showToast('Đã hoàn tất đồng bộ toàn bộ cache!', 'success');
        }
      }, 1500);
    } catch (err) {
      dom.btnRefreshAll.classList.remove('fa-spin');
      Clipboard.showToast('Không thể kích hoạt làm mới cache', 'error');
    }
  });

  // Diagnostics Modal Trigger
  dom.btnDiagnostics.addEventListener('click', async () => {
    const status = await Api.fetchStatus();
    Modals.openDiagnostics(status);
  });
  document.getElementById('closeDiagnosticsModal')?.addEventListener('click', Modals.closeDiagnostics);

  // Compare Drawer & Modal Trigger
  dom.btnCompareDrawer.addEventListener('click', () => Modals.openCompare(state, dom));
  document.getElementById('closeCompareModal')?.addEventListener('click', Modals.closeCompare);
  document.getElementById('btnClearCompare')?.addEventListener('click', () => {
    state.clearCompare();
    Modals.closeCompare();
    renderCurrentView();
  });
  document.getElementById('compareTableContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-compare"]');
    if (!btn) return;
    const id = btn.dataset.id;
    state.compareList.delete(id);
    Modals.openCompare(state, dom);
    renderCurrentView();
  });

  // Price Alerts Modal Trigger
  dom.btnAlerts.addEventListener('click', () => Modals.openAlerts(state));
  document.getElementById('closeAlertsModal')?.addEventListener('click', Modals.closeAlerts);
  document.getElementById('btnAddAlert')?.addEventListener('click', () => {
    const itemName = document.getElementById('newAlertItemName')?.value.trim();
    const condition = document.getElementById('newAlertCondition')?.value;
    const threshold = parseFloat(document.getElementById('newAlertThreshold')?.value);
    const currency = document.getElementById('newAlertCurrency')?.value;

    if (!itemName || isNaN(threshold) || threshold <= 0) {
      Clipboard.showToast('Vui lòng nhập tên vật phẩm và ngưỡng giá hợp lệ!', 'warning');
      return;
    }

    state.addAlert({ itemName, condition, threshold, currency });
    document.getElementById('newAlertItemName').value = '';
    document.getElementById('newAlertThreshold').value = '';
    Modals.renderAlertsList(state);
    Clipboard.showToast(`Đã thêm cảnh báo cho "${itemName}"!`, 'success');
  });
  document.getElementById('alertsListContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete-alert"]');
    if (!btn) return;
    const id = btn.dataset.id;
    state.removeAlert(id);
    Modals.renderAlertsList(state);
    Clipboard.showToast('Đã xóa cảnh báo.', 'info');
  });

  // Settings Modal Trigger & Overlay Dismissal
  dom.btnSettings.addEventListener('click', () => Modals.openSettings(state));
  document.getElementById('closeSettingsModal')?.addEventListener('click', () => Modals.closeSettings());
  document.getElementById('settingsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModalOverlay') Modals.closeSettings();
  });
  document.getElementById('btnSaveSettings')?.addEventListener('click', (e) => {
    e.preventDefault();
    const game = document.getElementById('settingDefaultGame')?.value;
    const view = document.getElementById('settingDefaultView')?.value;
    state.saveSettings({ defaultGame: game, defaultView: view });
    Modals.closeSettings();
    Clipboard.showToast('Đã lưu tùy chọn thành công!', 'success');
  });

  // Compare & Alerts & Diagnostics Backdrop Dismissals
  document.getElementById('compareModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'compareModalOverlay') Modals.closeCompare();
  });
  document.getElementById('alertsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'alertsModalOverlay') Modals.closeAlerts();
  });
  document.getElementById('diagnosticsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'diagnosticsModalOverlay') Modals.closeDiagnostics();
  });

  // Sidebar Category Filter
  dom.sidebarCategoryFilter?.addEventListener('input', (e) => {
    sidebarFilterQuery = e.target.value;
    renderSidebar();
  });

  // POESTASH Item Inspection Modal Events
  dom.closeInspectModal?.addEventListener('click', () => Modals.closeItemInspection(dom));
  dom.btnInspectBack?.addEventListener('click', () => Modals.closeItemInspection(dom));
  dom.itemInspectOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.itemInspectOverlay) Modals.closeItemInspection(dom);
  });

  // Copy Whisper Action from Inspection Modal
  dom.btnInspectWhisper?.addEventListener('click', async () => {
    if (!state.activeModalItem) return;
    const isPoe2 = state.currentGame === 'poe2';
    const priceText = isPoe2
      ? (state.activeModalItem.divineValue >= 1 ? `${state.activeModalItem.divineValue} Div` : `${state.activeModalItem.exaltedValue || 0} Ex`)
      : (state.activeModalItem.divineValue >= 1 ? `${state.activeModalItem.divineValue} Div` : `${state.activeModalItem.chaosValue || 0} C`);
    const whisper = Clipboard.formatWhisper(state.activeModalItem, 1, priceText);
    const success = await Clipboard.copyText(whisper);
    if (success) {
      dom.btnInspectWhisper.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
      setTimeout(() => {
        dom.btnInspectWhisper.innerHTML = '<i class="fa-solid fa-copy"></i> Sao chép whisper';
      }, 1800);
      Clipboard.showToast(`Đã sao chép câu lệnh whisper!`, 'success');
    }
  });

  // Related Items Click Delegation in Inspection Modal
  dom.inspectRelatedList?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-action="inspect-related"]');
    if (!row) return;
    const id = row.dataset.id;
    const item = state.items.find(i => i.id === id);
    if (item) {
      Modals.openItemInspection(item, state, dom);
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // 1. Escape: close modals if open, or clear search & blur
    if (e.key === 'Escape') {
      const isAnyModalOpen = [
        dom.calcModalOverlay,
        dom.compareModalOverlay,
        dom.alertsModalOverlay,
        dom.diagnosticsModalOverlay,
        dom.settingsModalOverlay
      ].some(el => el && !el.classList.contains('hidden') && el.style.display !== 'none');

      if (isAnyModalOpen) {
        Modals.closeCalculator(dom);
        Modals.closeCompare();
        Modals.closeAlerts();
        Modals.closeDiagnostics();
        Modals.closeSettings();
      } else if (document.activeElement === dom.searchInput || state.searchQuery) {
        dom.searchInput.value = '';
        state.searchQuery = '';
        dom.clearSearchBtn.classList.add('hidden');
        dom.searchInput.blur();
        filterAndRender();
      }
    } 
    // 2. Focus search on '/' or 'Ctrl+K' / 'Cmd+K'
    else if ((e.key === '/' && document.activeElement !== dom.searchInput) ||
             ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      dom.searchInput.focus();
      dom.searchInput.select();
    } 
    // 3. Open calculator on Enter in search
    else if (e.key === 'Enter' && document.activeElement === dom.searchInput) {
      if (state.filteredItems.length > 0) {
        Modals.openCalculator(state.filteredItems[0], state, dom);
      }
    }
    // 4. Quick pagination with '[' and ']' when not typing in inputs
    else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      const totalPages = Math.ceil(state.filteredItems.length / state.pageSize) || 1;
      if (e.key === '[' && state.currentPage > 1) {
        state.currentPage--;
        renderCurrentView();
      } else if (e.key === ']' && state.currentPage < totalPages) {
        state.currentPage++;
        renderCurrentView();
      }
    }
  });
}

// Action Dispatcher for Table and Grid items
function handleItemAction(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  // Clear search quick button (from empty states)
  if (action === 'clear-search') {
    dom.searchInput.value = '';
    state.searchQuery = '';
    dom.clearSearchBtn.classList.add('hidden');
    filterAndRender();
    dom.searchInput.focus();
    return;
  }

  const id = target.dataset.id;
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  if (action === 'open-inspect' || action === 'open-calc') {
    Modals.openItemInspection(item, state, dom);
  } else if (action === 'copy-whisper') {
    e.stopPropagation();
    const isPoe2 = state.currentGame === 'poe2';
    const priceText = isPoe2
      ? (item.divineValue >= 1 ? `${item.divineValue} Div` : `${item.exaltedValue || 0} Ex`)
      : (item.divineValue >= 1 ? `${item.divineValue} Div` : `${item.chaosValue || 0} C`);
    const whisper = Clipboard.formatWhisper(item, 1, priceText);
    Clipboard.copyText(whisper).then(ok => {
      if (ok) Clipboard.showToast(`Đã sao chép whisper cho "${item.name}"!`, 'success');
    });
  } else if (action === 'toggle-fav') {
    e.stopPropagation();
    const isFav = state.toggleFavorite(item.id);
    Clipboard.showToast(isFav ? `★ Đã thêm "${item.name}" vào yêu thích` : `Đã xóa "${item.name}" khỏi yêu thích`);
    renderCurrentView();
  } else if (action === 'toggle-compare') {
    e.stopPropagation();
    const res = state.toggleCompare(item);
    if (res === 'limit_reached') {
      Clipboard.showToast('Bạn chỉ có thể so sánh tối đa 5 vật phẩm cùng lúc!', 'warning');
      if ('checked' in target) target.checked = false;
      return;
    }
    const isNowComparing = state.isInCompare(item.id);
    Clipboard.showToast(isNowComparing ? `⚖️ Đã thêm "${item.name}" vào bảng so sánh (${state.compareList.length}/5)` : `Đã bỏ so sánh "${item.name}"`);
    renderCurrentView();
  }
}

async function switchGame(game) {
  if (state.currentGame === game) return;
  state.currentGame = game;
  state.activeCategory = 'Currency';

  dom.btnPoe1.classList.toggle('active', game === 'poe1');
  dom.btnPoe2.classList.toggle('active', game === 'poe2');

  populateLeagueSelect();
  await loadCategoriesAndData();
  Clipboard.showToast(`Chuyển sang ${game.toUpperCase()}`);
}

function switchView(view) {
  state.currentView = view;
  dom.viewTableBtn.classList.toggle('active', view === 'table');
  dom.viewGridBtn.classList.toggle('active', view === 'grid');
  renderCurrentView();
}

// Boot
window.addEventListener('DOMContentLoaded', init);
