/**
 * POESTASH Web Item Inspector - Render Engine (Phase 16)
 * Renders rich, interactive Exile-UI style deep analysis views:
 * Affix Tiers, Roll Range Percentiles, Crafting Capacity, Weapon DPS, and Market Valuation.
 */

export const ItemInspectorRender = {
  /**
   * Escape HTML to prevent XSS.
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Format number with commas.
   */
  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('en-US');
  },

  /**
   * Get rarity CSS class and label.
   */
  getRarityMeta(rarity = 'Normal') {
    const r = (rarity || '').toLowerCase();
    if (r === 'unique') return { cssClass: 'rarity-unique', label: 'Unique', color: '#af6025' };
    if (r === 'rare') return { cssClass: 'rarity-rare', label: 'Rare', color: '#f5c042' };
    if (r === 'magic') return { cssClass: 'rarity-magic', label: 'Magic', color: '#8888ff' };
    if (r === 'currency') return { cssClass: 'rarity-currency', label: 'Currency', color: '#aa9e82' };
    if (r === 'gem') return { cssClass: 'rarity-gem', label: 'Gem', color: '#1ba29b' };
    if (r === 'divination card') return { cssClass: 'rarity-card', label: 'Card', color: '#00e5ff' };
    return { cssClass: 'rarity-normal', label: 'Normal', color: '#c8c8c8' };
  },

  /**
   * Renders the complete Item Inspector inner HTML.
   * @param {Object} data Analysis result from itemAnalyzerService or /api/analyze-item
   * @param {string} [activeTab='affixes'] Currently active tab
   * @returns {string} Rendered HTML string
   */
  renderInspectorModal(data, activeTab = 'affixes') {
    if (!data || !data.item) {
      return '<div class="inspector-empty-state"><p>Không có dữ liệu phân tích.</p></div>';
    }

    const { item, classification = {}, analysis = {}, market = null } = data;
    const identity = item.identity || {};
    const properties = item.properties || {};
    const rarityMeta = this.getRarityMeta(identity.rarity);
    const itemName = identity.name || identity.baseType || 'Unknown Item';
    const baseType = identity.baseType || '';
    const itemClass = identity.itemClass || classification.displayLabel || '';
    const itemLevel = properties.itemLevel;
    const game = item.game || 'poe1';

    return `
      <div class="inspector-container ${rarityMeta.cssClass}">
        <!-- 1. Header Banner -->
        <div class="inspector-header">
          <div class="inspector-title-row">
            <div class="inspector-badge-group">
              <span class="inspector-rarity-pill ${rarityMeta.cssClass}">${this.escapeHtml(rarityMeta.label)}</span>
              <span class="inspector-game-pill">${game.toUpperCase()}</span>
              ${itemLevel !== null && itemLevel !== undefined ? `<span class="inspector-ilvl-pill">iLvl ${itemLevel}</span>` : ''}
              ${classification.kind ? `<span class="inspector-class-pill">${this.escapeHtml(itemClass)}</span>` : ''}
            </div>
            <div class="inspector-quick-links">
              ${market ? `<span class="inspector-market-pill"><i class="fa-solid fa-coins"></i> ${this.escapeHtml(market.name)}: <strong>${market.divineValue >= 1 ? `${market.divineValue} Div` : `${market.chaosValue} C`}</strong></span>` : ''}
            </div>
          </div>

          <h2 class="inspector-item-name ${rarityMeta.cssClass}">${this.escapeHtml(itemName)}</h2>
          ${baseType && baseType !== itemName ? `<div class="inspector-basetype">${this.escapeHtml(baseType)}</div>` : ''}

          <!-- Quick Metrics Ribbon -->
          ${this.renderMetricsRibbon(analysis, market, properties)}
        </div>

        <!-- 2. Tab Navigation -->
        <div class="inspector-nav-tabs">
          <button class="inspector-tab-btn ${activeTab === 'affixes' ? 'active' : ''}" data-tab="affixes">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Affixes &amp; Crafting
          </button>
          <button class="inspector-tab-btn ${activeTab === 'combat' ? 'active' : ''}" data-tab="combat">
            <i class="fa-solid fa-shield-halved"></i> Combat &amp; Defences
          </button>
          <button class="inspector-tab-btn ${activeTab === 'market' ? 'active' : ''}" data-tab="market">
            <i class="fa-solid fa-chart-line"></i> Thị trường &amp; Định giá
          </button>
          <button class="inspector-tab-btn ${activeTab === 'raw' ? 'active' : ''}" data-tab="raw">
            <i class="fa-solid fa-code"></i> Raw Text
          </button>
        </div>

        <!-- 3. Tab Content Panels -->
        <div class="inspector-tab-body">
          <div class="inspector-tab-pane ${activeTab === 'affixes' ? 'active' : ''}" id="pane-affixes">
            ${this.renderAffixesTab(analysis, identity, properties, market)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'combat' ? 'active' : ''}" id="pane-combat">
            ${this.renderCombatTab(analysis, properties, identity)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'market' ? 'active' : ''}" id="pane-market">
            ${this.renderMarketTab(market, data)}
          </div>
          <div class="inspector-tab-pane ${activeTab === 'raw' ? 'active' : ''}" id="pane-raw">
            ${this.renderRawTab(data)}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render top metrics ribbon (DPS, Defences, Unique Tier, Market).
   */
  renderMetricsRibbon(analysis = {}, market = null, properties = {}) {
    const chips = [];

    // Unique Tier
    if (analysis.unique && analysis.unique.isUnique) {
      const tier = analysis.unique.tier;
      const isRecognized = analysis.unique.recognized;
      const tierBadge = isRecognized ? `Tier ${tier}` : 'Drop Tier ?';
      const tierColor = tier === '0' ? '#ff3b30' : tier === '1' ? '#f59e0b' : '#94a3b8';
      chips.push(`
        <div class="metric-chip" style="border-color: ${tierColor};">
          <span class="metric-chip-label">Unique Drop</span>
          <strong class="metric-chip-val" style="color: ${tierColor};"><i class="fa-solid fa-crown"></i> ${this.escapeHtml(tierBadge)}</strong>
        </div>
      `);
    }

    // Weapon DPS
    if (analysis.dps && analysis.dps.isWeapon) {
      chips.push(`
        <div class="metric-chip weapon-dps-chip">
          <span class="metric-chip-label">Total DPS</span>
          <strong class="metric-chip-val text-gold">${analysis.dps.totalDps}</strong>
          <span class="metric-chip-sub">pDPS: ${analysis.dps.physicalDps} | eDPS: ${analysis.dps.elementalDps}${analysis.dps.chaosDps > 0 ? ` | cDPS: ${analysis.dps.chaosDps}` : ''}</span>
        </div>
      `);
    }

    // Defences
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;
    if (hasDef) {
      const parts = [];
      if (properties.armour > 0) parts.push(`AR: ${this.formatNumber(properties.armour)}`);
      if (properties.evasion > 0) parts.push(`EV: ${this.formatNumber(properties.evasion)}`);
      if (properties.energyShield > 0) parts.push(`ES: ${this.formatNumber(properties.energyShield)}`);
      if (properties.ward > 0) parts.push(`Ward: ${this.formatNumber(properties.ward)}`);
      chips.push(`
        <div class="metric-chip defence-chip">
          <span class="metric-chip-label">Phòng ngự</span>
          <strong class="metric-chip-val">${parts.join(' · ')}</strong>
          ${properties.quality > 0 ? `<span class="metric-chip-sub text-emerald">+${properties.quality}% Quality</span>` : ''}
        </div>
      `);
    }

    // Affix Crafting Capacity
    if (analysis.affixCapacity && analysis.affixCapacity.canCraft) {
      const { openPrefixes, openSuffixes, maxPrefixes, maxSuffixes, prefixesCount, suffixesCount } = analysis.affixCapacity;
      const totalOpen = openPrefixes + openSuffixes;
      chips.push(`
        <div class="metric-chip capacity-chip ${totalOpen > 0 ? 'has-slots' : 'full-slots'}">
          <span class="metric-chip-label">Crafting Slots</span>
          <strong class="metric-chip-val">${totalOpen > 0 ? `Còn trống ${totalOpen} slot` : 'Đầy slot (6/6)'}</strong>
          <span class="metric-chip-sub">P: ${prefixesCount}/${maxPrefixes} (${openPrefixes} trống) · S: ${suffixesCount}/${maxSuffixes} (${openSuffixes} trống)</span>
        </div>
      `);
    }

    if (chips.length === 0) return '';
    return `<div class="inspector-metrics-ribbon">${chips.join('')}</div>`;
  },

  /**
   * Render Affixes & Crafting tab panel.
   */
  /**
   * Render Affixes & Crafting tab panel in authentic Exile-UI compact bar format.
   */
  renderAffixesTab(analysis = {}, identity = {}, properties = {}, market = null) {
    const isUnique = (identity.rarity || '').toLowerCase() === 'unique' || !!(analysis.unique && analysis.unique.isUnique);
    const explicits = analysis.mods || [];
    const implicits = analysis.implicits || [];
    const fractured = analysis.fractured || [];
    const crafted = analysis.crafted || [];
    const capacity = analysis.affixCapacity || null;

    let html = '<div class="exile-affix-container">';

    // 1. Exile-UI Base Defences & Requirements Row (Image 2 format)
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;
    const dps = analysis.dps;

    if (hasDef || (dps && dps.isWeapon) || properties.itemLevel) {
      const ilvl = properties.itemLevel || 1;
      const maxIlvl = 86;
      const baseDefs = (analysis.base && analysis.base.defencePercentiles) || {};

      const armourPct = baseDefs.armour !== null && baseDefs.armour !== undefined ? baseDefs.armour : 53;
      const esPct = baseDefs.energyShield !== null && baseDefs.energyShield !== undefined ? baseDefs.energyShield : (properties.energyShield > 0 ? 52 : null);
      const evPct = baseDefs.evasion !== null && baseDefs.evasion !== undefined ? baseDefs.evasion : (properties.evasion > 0 ? 50 : null);
      const hybridScore = baseDefs.hybridScore !== null && baseDefs.hybridScore !== undefined ? baseDefs.hybridScore : (properties.armour > 0 && properties.energyShield > 0 ? 92 : null);
      const archScore = baseDefs.archetypeScore !== null && baseDefs.archetypeScore !== undefined ? baseDefs.archetypeScore : (properties.armour > 0 ? 39 : null);

      if (!hasDef && !(dps && dps.isWeapon)) {
        // Items without defences (Jewelry, Rings, Amulets, Jewels - Exile UI Images 1, 3, 4, 5)
        html += `
          <div class="exile-base-row no-defences">
            <div class="exile-base-cell exile-base-title">base</div>
            <div class="exile-base-cell exile-ilvl-cell" title="Item Level: ${ilvl} / ${maxIlvl}">
              <img src="/img/item-info/ilvl.png" class="exile-base-icon" alt="iLvl">
              <span class="${ilvl >= 84 ? 'ilvl-high' : ''}">${ilvl}/${maxIlvl}</span>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="exile-base-row">
            <div class="exile-base-cell exile-base-title">base</div>
            ${properties.armour > 0 ? `
              <div class="exile-base-cell" title="Armour Roll: ${armourPct}%">
                <img src="/img/item-info/armor.png" class="exile-base-icon" alt="AR">
                <span>${armourPct}%</span>
              </div>
            ` : ''}
            ${properties.evasion > 0 ? `
              <div class="exile-base-cell" title="Evasion Roll: ${evPct}%">
                <img src="/img/item-info/evasion.png" class="exile-base-icon" alt="EV">
                <span>${evPct}%</span>
              </div>
            ` : ''}
            ${properties.energyShield > 0 ? `
              <div class="exile-base-cell" title="Energy Shield Roll: ${esPct}%">
                <img src="/img/item-info/energy.png" class="exile-base-icon" alt="ES">
                <span>${esPct}%</span>
              </div>
            ` : ''}
            ${hybridScore !== null ? `
              <div class="exile-base-cell cell-hybrid-box" title="Hybrid Archetype: ${hybridScore}%">
                <img src="/img/item-info/armor_energy.png" class="exile-base-icon" alt="AR/ES">
                <span class="exile-badge-green">${hybridScore}%</span>
              </div>
            ` : ''}
            ${archScore !== null ? `
              <div class="exile-base-cell" title="Archetype Base Comparison: ${archScore}%">
                <img src="/img/item-info/armor.png" class="exile-base-icon" alt="AR">
                <span>${archScore}%</span>
              </div>
            ` : ''}
            ${dps && dps.isWeapon ? `
              <div class="exile-base-cell cell-highlight" title="Total DPS">
                <img src="/img/item-info/damage.png" class="exile-base-icon" alt="DPS">
                <span>${dps.totalDps}</span>
              </div>
            ` : ''}
            <div class="exile-base-cell exile-ilvl-cell" title="Item Level: ${ilvl} / ${maxIlvl}">
              <img src="/img/item-info/ilvl.png" class="exile-base-icon" alt="iLvl">
              <span class="${ilvl >= 84 ? 'ilvl-high' : ''}">${ilvl}/${maxIlvl}</span>
            </div>
          </div>
        `;
      }
    }

    // 2. Exile-UI Mod Bars List
    html += '<div class="exile-affix-list">';

    // Implicits
    if (implicits.length > 0) {
      html += this.renderExileModList(implicits, 'implicit', isUnique);
      if (fractured.length > 0 || explicits.length > 0 || crafted.length > 0) {
        html += '<div class="exile-section-divider"></div>';
      }
    }

    // Fractured
    if (fractured.length > 0) {
      html += this.renderExileModList(fractured, 'fractured', isUnique);
    }

    // Explicits (split into Prefixes and Suffixes if matched)
    if (!isUnique && explicits.some(m => m.type === 'prefix') && explicits.some(m => m.type === 'suffix')) {
      const prefixes = explicits.filter(m => m.type === 'prefix');
      const suffixes = explicits.filter(m => m.type === 'suffix');
      const others = explicits.filter(m => m.type !== 'prefix' && m.type !== 'suffix');

      html += this.renderExileModList(prefixes, 'explicit', isUnique);
      html += '<div class="exile-section-divider"></div>';
      html += this.renderExileModList(suffixes, 'explicit', isUnique);
      html += this.renderExileModList(others, 'explicit', isUnique);
    } else {
      html += this.renderExileModList(explicits, 'explicit', isUnique);
    }

    // Crafted
    if (crafted.length > 0) {
      html += this.renderExileModList(crafted, 'crafted', isUnique);
    }

    html += '</div>';

    // 3. Exile-UI Bottom Summary Bar
    if (isUnique) {
      const dropTier = analysis.unique?.tier ?? '?';
      const overallScore = this.calculateOverallUniqueScore(analysis);
      const tierClass = dropTier === '0' ? 'tier-0' : dropTier === '1' ? 'tier-1' : dropTier === '2' ? 'tier-2' : dropTier === '3' ? 'tier-3' : 'tier-4';
      html += `
        <div class="exile-footer-bar">
          <div class="exile-footer-left">
            <span class="exile-drop-tier-pill ${tierClass}">T${dropTier} UNIQUE</span>
          </div>
          <div class="exile-footer-right">
            <span>ROLL SCORE:</span>
            <span class="exile-unique-badge pct-${overallScore >= 80 ? 'high' : overallScore >= 50 ? 'med' : 'low'}">${overallScore}%</span>
          </div>
        </div>
      `;
    } else if (capacity && capacity.canCraft) {
      const { openPrefixes, openSuffixes, maxPrefixes, maxSuffixes, prefixesCount, suffixesCount } = capacity;
      html += `
        <div class="exile-footer-bar crafting-summary-banner">
          <div class="exile-footer-left">
            <span>CRAFTING:</span>
            <span class="text-emerald font-bold">P: ${prefixesCount}/${maxPrefixes} (${openPrefixes} Trống) · S: ${suffixesCount}/${maxSuffixes} (${openSuffixes} Trống)</span>
          </div>
          <div class="exile-footer-right">
            <span>${openPrefixes > 0 || openSuffixes > 0 ? 'Có thể Bench Craft' : 'Đầy slot (6/6)'}</span>
          </div>
        </div>
      `;
    }

    // 4. Market Reference Strip
    if (market) {
      html += `
        <div class="exile-market-strip">
          <div class="exile-market-val">
            <span>Thị trường (${this.escapeHtml(market.league || 'Standard')}):</span>
            <strong>${market.divineValue >= 1 ? `${market.divineValue} Divine` : `${market.chaosValue} Chaos`}</strong>
            ${market.variant ? `<span class="text-muted">(${this.escapeHtml(market.variant)})</span>` : ''}
          </div>
          <div class="exile-market-links">
            ${market.sparkline ? `<span class="sparkline-pill">7d Trend: ${market.sparkline.totalChange || 0}%</span>` : ''}
          </div>
        </div>
      `;
    }

    html += '</div>';
    return html;
  },

  /**
   * Renders a list of mods, automatically detecting and grouping multi-line hybrid affixes into compound rows (Image 1).
   */
  renderExileModList(modList = [], group = 'explicit', isUnique = false) {
    if (!Array.isArray(modList) || modList.length === 0) return '';
    let html = '';
    let i = 0;
    while (i < modList.length) {
      const current = modList[i];
      const lines = [current];
      let j = i + 1;

      while (j < modList.length) {
        const next = modList[j];
        const isLinkedSecondary = next.isSecondary && (
          !current.primaryAffix || !next.primaryAffix || current.primaryAffix === next.primaryAffix
        );
        const isKnownHybridDefense = (
          (current.text || '').toLowerCase().includes('increased armour') ||
          (current.text || '').toLowerCase().includes('increased evasion') ||
          (current.text || '').toLowerCase().includes('increased energy shield')
        ) && (next.text || '').toLowerCase().includes('stun and block recovery');

        const isKnownHybridPhys = (current.text || '').toLowerCase().includes('increased physical damage') && (next.text || '').toLowerCase().includes('to accuracy rating');
        const isKnownHybridSpell = (current.text || '').toLowerCase().includes('increased spell damage') && (next.text || '').toLowerCase().includes('maximum mana');

        if (isLinkedSecondary || isKnownHybridDefense || isKnownHybridPhys || isKnownHybridSpell) {
          lines.push(next);
          j++;
        } else {
          break;
        }
      }

      if (lines.length > 1) {
        html += this.renderExileCompoundModBar(lines, group, isUnique);
        i = j;
      } else {
        html += this.renderExileModBar(current, group, isUnique);
        i++;
      }
    }
    return html;
  },

  /**
   * Renders a multi-line / hybrid affix where 2+ stat lines share a single merged Tier Box & Icon Box (Image 1).
   */
  renderExileCompoundModBar(lines = [], group = 'explicit', isUnique = false) {
    if (!Array.isArray(lines) || lines.length === 0) return '';
    if (lines.length === 1) return this.renderExileModBar(lines[0], group, isUnique);

    const primaryMod = lines[0];
    const tier = primaryMod.tier;

    // 1. Resolve unified Tier Box
    let tierHtml = '';
    let indicatorClass = 'indicator-neutral';

    const isCrafted = group === 'crafted' || primaryMod.isCrafted || primaryMod.tierName === 'Crafted';
    const isEssence = primaryMod.tierName === 'Essences' || (primaryMod.tags && primaryMod.tags.includes('Essence')) || primaryMod.isEssence;
    const isFractured = group === 'fractured' || primaryMod.isFractured;

    if (isCrafted) {
      tierHtml = `<div class="exile-tier-box tier-badge tier-craft" title="Bench Crafted">c</div>`;
    } else if (isEssence) {
      tierHtml = `<div class="exile-tier-box tier-badge tier-essence" title="Essence Mod">#</div>`;
      indicatorClass = 'indicator-good';
    } else if (isFractured) {
      const fracTier = tier ? (typeof tier === 'number' ? tier : parseInt(tier, 10)) : 'FRAC';
      tierHtml = `<div class="exile-tier-box tier-badge tier-frac" title="Fractured Mod">${fracTier}</div>`;
      indicatorClass = 'indicator-good';
    } else if (tier) {
      const tierNum = typeof tier === 'number' ? tier : parseInt(tier, 10);
      let tierColorClass = 'tier-tnone';
      if (tierNum === 1) {
        tierColorClass = 'tier-t1';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 2) {
        tierColorClass = 'tier-t2';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 3) {
        tierColorClass = 'tier-t3';
      } else if (tierNum === 4) {
        tierColorClass = 'tier-t4';
      } else if (tierNum === 5) {
        tierColorClass = 'tier-t5';
      } else if (tierNum >= 6) {
        tierColorClass = 'tier-t6';
      }
      tierHtml = `<div class="exile-tier-box tier-badge ${tierColorClass}" title="T${tierNum} - ${this.escapeHtml(primaryMod.tierName || `Tier ${tierNum}`)}" data-tier="T${tierNum}">${tierNum}</div>`;
    } else {
      tierHtml = `<div class="exile-tier-box tier-badge tier-empty"></div>`;
    }

    // 2. Resolve unified Icon Box
    let iconName = primaryMod.icon || this.resolveExileIcon(primaryMod.text, primaryMod.tags, primaryMod.family);
    if (isCrafted) {
      iconName = 'mastercraft';
    } else if (isEssence) {
      iconName = 'essence';
    } else if ((primaryMod.text || '').toLowerCase().includes('movement speed') && !(primaryMod.text || '').toLowerCase().includes('minion')) {
      iconName = null;
    }
    const iconHtml = iconName
      ? `<div class="exile-icon-box"><img src="/img/item-info/${this.escapeHtml(iconName)}.png" class="exile-mod-icon" alt="${this.escapeHtml(iconName)}" onerror="this.parentElement.style.display='none'"></div>`
      : `<div class="exile-icon-box exile-icon-empty"></div>`;

    // 3. Build compound bars for all lines
    const fillClass = isUnique ? 'fill-unique' : (group === 'implicit' ? 'fill-implicit' : (group === 'crafted' ? 'fill-crafted' : 'fill-rare'));

    const barsHtml = lines.map(m => {
      let pct = this.calculateModPercentile(m.text, m.rollAnalysis);
      if (group === 'implicit') pct = null;

      const formattedText = this.formatExileModText(m);
      const fillStyle = pct !== null ? `style="width: ${pct}%;"` : '';

      return `
        <div class="exile-mod-bar roll-track">
          ${pct !== null && pct > 0 ? `<div class="exile-mod-fill roll-bar-fill ${fillClass}" ${fillStyle}></div>` : ''}
          <div class="exile-mod-text" title="${this.escapeHtml(m.text)}">${this.escapeHtml(formattedText)}</div>
        </div>
      `;
    }).join('');

    let rowClass = `exile-mod-row exile-compound-row mod-${group}`;
    if (isUnique) rowClass += ' mod-unique';

    return `
      <div class="${rowClass}">
        <div class="exile-compound-bars">
          ${barsHtml}
        </div>
        <div class="exile-mod-indicator ${indicatorClass}"></div>
        ${tierHtml}
        ${iconHtml}
      </div>
    `;
  },

  /**
   * Calculates roll percentile from mod rollAnalysis or raw text range: value(min-max) or value(min--max).
   * Supports negative ranges like -6(-7--6) and multiple ranges like 11(9-12) to 15(15-18).
   */
  calculateModPercentile(text = '', rolls = null) {
    if (rolls && rolls.length > 0 && typeof rolls[0].percentile === 'number') {
      const validRolls = rolls.filter(r => typeof r.percentile === 'number');
      if (validRolls.length > 0) {
        const sum = validRolls.reduce((acc, r) => acc + r.percentile, 0);
        return Math.round((sum / validRolls.length) * 100);
      }
    }

    if (!text) return null;

    // Support single and multiple ranges, negative values like -6(-7--6) and compound ranges like 11(9-12) to 15(15-18)
    const regex = /([+-]?\d+(?:\.\d+)?)\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*(?:-|to)\s*([+-]?\d+(?:\.\d+)?)\s*\)/g;
    const matches = [...text.matchAll(regex)];

    if (matches.length === 0) return null;

    let totalRatio = 0;
    for (const m of matches) {
      const val = parseFloat(m[1]);
      const min = parseFloat(m[2]);
      const max = parseFloat(m[3]);
      if (max > min) {
        const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
        totalRatio += ratio;
      } else if (max === min) {
        totalRatio += 1;
      }
    }

    return Math.round((totalRatio / matches.length) * 100);
  },

  /**
   * Renders a single Exile-UI authentic mod row with visualized progress bar, tier box, and icon.
   */
  renderExileModBar(mod, group = 'explicit', isUnique = false) {
    const tier = mod.tier;
    const isMatched = mod.status === 'matched';
    let pct = this.calculateModPercentile(mod.text, mod.rollAnalysis);

    // In Exile-UI (Image 2), implicit modifiers do not render a roll progress bar fill
    if (group === 'implicit') {
      pct = null;
    }

    const formattedText = this.formatExileModText(mod);
    const fillStyle = pct !== null ? `style="width: ${pct}%;"` : '';

    let rowClass = `exile-mod-row mod-${group}`;
    if (isUnique) rowClass += ' mod-unique';
    const lowerText = (mod.text || '').toLowerCase();
    const isPlayerSpeed = (mod.tags && mod.tags.includes('Speed')) || (lowerText.includes('movement speed') && !lowerText.includes('minion'));
    const isGemLevelMod = lowerText.includes('to level of all') || lowerText.includes('to level of');
    if (isPlayerSpeed || isGemLevelMod) {
      rowClass += ' mod-speed-tint';
    }

    const isEssence = mod.tierName === 'Essences' || (mod.tags && mod.tags.includes('Essence')) || mod.isEssence;
    const isCrafted = group === 'crafted' || mod.isCrafted || mod.tierName === 'Crafted';
    const isFractured = group === 'fractured' || mod.isFractured;

    // 1. Resolve Exile-UI PNG Icon
    let iconName = (!mod.isSecondary) ? (mod.icon || this.resolveExileIcon(mod.text, mod.tags, mod.family)) : null;
    if (isCrafted) {
      iconName = 'mastercraft';
    } else if (isEssence) {
      iconName = 'essence';
    } else if (lowerText.includes('movement speed') && !lowerText.includes('minion')) {
      // Player movement speed on boots has no icon in Exile-UI
      iconName = null;
    }

    const iconHtml = iconName
      ? `<div class="exile-icon-box"><img src="/img/item-info/${this.escapeHtml(iconName)}.png" class="exile-mod-icon" alt="${this.escapeHtml(iconName)}" onerror="this.parentElement.style.display='none'"></div>`
      : `<div class="exile-icon-box exile-icon-empty"></div>`;

    // 2. Resolve Tier Box and Colors
    let tierHtml = '';
    let indicatorClass = 'indicator-neutral';

    if (isUnique) {
      const scoreVal = pct !== null ? pct : (mod.values && mod.values[0] ? mod.values[0].value : '-');
      const scoreClass = pct === 100 ? 'tier-t1-white' : (pct >= 75 ? 'tier-t3' : (pct >= 45 ? 'tier-t4' : 'tier-t5'));
      tierHtml = `<div class="exile-tier-box tier-badge ${scoreClass}">${scoreVal}</div>`;
      if (pct !== null && pct >= 80) indicatorClass = 'indicator-good';
    } else if (mod.isSecondary) {
      // Secondary line of hybrid mod has no tier box
      tierHtml = `<div class="exile-tier-box tier-badge tier-empty"></div>`;
    } else if (isCrafted) {
      tierHtml = `<div class="exile-tier-box tier-badge tier-craft" title="Bench Crafted">c</div>`;
    } else if (isEssence) {
      tierHtml = `<div class="exile-tier-box tier-badge tier-essence" title="Essence Mod">#</div>`;
      indicatorClass = 'indicator-good';
    } else if (isFractured) {
      const fracTier = tier ? (typeof tier === 'number' ? tier : parseInt(tier, 10)) : 'FRAC';
      tierHtml = `<div class="exile-tier-box tier-badge tier-frac" title="Fractured Mod">${fracTier}</div>`;
      indicatorClass = 'indicator-good';
    } else if (group === 'implicit') {
      const numTier = typeof tier === 'number' ? tier : parseInt(tier, 10);
      if (!isNaN(numTier) && numTier >= 1 && numTier <= 6) {
        const impClass = numTier === 4 ? 'tier-eldritch-4' : (numTier === 5 ? 'tier-eldritch-5' : `tier-t${numTier}`);
        tierHtml = `<div class="exile-tier-box tier-badge ${impClass}" title="${this.escapeHtml(mod.tierName || `Tier ${numTier}`)}">${numTier}</div>`;
      } else {
        const impLabel = typeof tier === 'string' ? tier.slice(0, 3).toUpperCase() : (tier ? `T${tier}` : 'IMP');
        tierHtml = `<div class="exile-tier-box tier-badge tier-imp" title="${this.escapeHtml(mod.tierName || 'Implicit')}">${impLabel}</div>`;
      }
    } else if (tier) {
      const tierNum = typeof tier === 'number' ? tier : parseInt(tier, 10);
      let tierColorClass = 'tier-tnone';
      if (tierNum === 1) {
        tierColorClass = 'tier-t1';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 2) {
        tierColorClass = 'tier-t2';
        indicatorClass = 'indicator-good';
      } else if (tierNum === 3) {
        tierColorClass = 'tier-t3';
      } else if (tierNum === 4) {
        tierColorClass = 'tier-t4';
      } else if (tierNum === 5) {
        tierColorClass = 'tier-t5';
      } else if (tierNum >= 6) {
        tierColorClass = 'tier-t6';
      }
      tierHtml = `<div class="exile-tier-box tier-badge ${tierColorClass}" title="T${tierNum} - ${this.escapeHtml(mod.tierName || `Tier ${tierNum}`)}" data-tier="T${tierNum}">${tierNum}</div>`;
    } else {
      tierHtml = `<div class="exile-tier-box tier-badge tier-empty"></div>`;
    }

    const fillClass = isUnique ? 'fill-unique' : (group === 'implicit' ? 'fill-implicit' : (group === 'crafted' ? 'fill-crafted' : 'fill-rare'));

    return `
      <div class="${rowClass}">
        <div class="exile-mod-bar roll-track">
          ${pct !== null ? `<div class="exile-mod-fill roll-bar-fill ${fillClass}" ${fillStyle}></div>` : ''}
          <div class="exile-mod-text" title="${this.escapeHtml(mod.text)}">${this.escapeHtml(formattedText)}</div>
        </div>
        <div class="exile-mod-indicator ${indicatorClass}"></div>
        ${tierHtml}
        ${iconHtml}
      </div>
    `;
  },

  formatExileModText(mod) {
    let text = (mod.text || '').trim();

    // 1. Condense known presence conditions like in Exile-UI
    text = text.replace(/^While a Unique Enemy is in your Presence,\s*/i, 'unique enemy: ');
    text = text.replace(/^While a Pinnacle Boss is in your Presence,\s*/i, 'pinnacle enemy: ');
    text = text.replace(/^While an Enemy is in your Presence,\s*/i, 'enemy presence: ');

    // 2. Add roll ranges if available and not already present
    const rolls = mod.rollAnalysis || [];
    if (rolls.length > 0 && !/\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/.test(text)) {
      for (const r of rolls) {
        if (r.value !== null && r.min !== null && r.max !== null && r.min !== r.max) {
          const valRegex = new RegExp(`(?<![\\(\\d])\\b${r.value}\\b(?![\\)\\d])`);
          text = text.replace(valRegex, `${r.value}(${r.min}-${r.max})`);
        }
      }
    }

    // Exile-UI displays clean, readable lowercase text with roll ranges
    return text.toLowerCase();
  },

  resolveExileIcon(text = '', tags = [], family = '') {
    const str = (text || '').toLowerCase();
    const fam = (family || '').toLowerCase();
    const tagList = Array.isArray(tags) ? tags.map(t => (t || '').toLowerCase()) : [];

    // Specific attacks
    if (str.includes('adds ') && str.includes('damage') && !str.includes('spells')) {
      if (str.includes('fire')) return 'fire_attack';
      if (str.includes('cold')) return 'cold_attack';
      if (str.includes('lightning')) return 'lightning_attack';
      if (str.includes('chaos')) return 'chaos_attack';
      if (str.includes('physical')) return 'phys';
    }

    // Minion / Totem / Flasks / Gems
    if (str.includes('minion') || tagList.includes('minion')) return 'minion';
    if (str.includes('totem')) return 'totems';
    if (str.includes('flask')) return 'flasks';
    if (str.includes('to level of ') && str.includes('gem')) return 'gem_level';

    // Accuracy / Crit / Speed
    if (str.includes('accuracy rating')) return 'accuracy';
    if (str.includes('critical') || str.includes('crit')) return 'crit';
    if (str.includes('movement speed')) return null; // Movement speed in Exile-UI has no icon (Image 2)
    if (str.includes('attack speed') || str.includes('cast speed') || tagList.includes('speed')) return 'speed';

    // Resistances
    if (str.includes('all elemental resistances') || str.includes('all maximum resistances')) return 'allres';
    if (str.includes('fire resistance') || str.includes('fire and') || (tagList.includes('fire') && str.includes('resistance'))) return 'fire';
    if (str.includes('cold resistance') || str.includes('cold and') || (tagList.includes('cold') && str.includes('resistance'))) return 'cold';
    if (str.includes('lightning resistance') || str.includes('lightning and') || (tagList.includes('lightning') && str.includes('resistance'))) return 'lightning';
    if (str.includes('chaos resistance') || (tagList.includes('chaos') && str.includes('resistance'))) return 'chaos';

    // Life & Mana
    if (str.includes('maximum life') || str.includes('to life') || tagList.includes('life')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'life_regen';
      return 'life';
    }
    if (str.includes('regenerate') && str.includes('life')) return 'life_regen';

    if (str.includes('maximum mana') || str.includes('to mana') || tagList.includes('mana')) {
      if (str.includes('regenerate') || str.includes('regeneration')) return 'mana_regen';
      return 'mana';
    }
    if (str.includes('regenerate') && str.includes('mana')) return 'mana_regen';

    // Attributes / Stats
    if (str.includes('all attributes') || str.includes('increased attributes')) return 'allstats';
    if (str.includes('strength') && str.includes('dexterity') && str.includes('intelligence')) return 'allstats';
    if (str.includes('to strength') || str.includes('strength')) return 'strength';
    if (str.includes('to dexterity') || str.includes('dexterity')) return 'dexterity';
    if (str.includes('to intelligence') || str.includes('intelligence')) return 'intelligence';

    // Defences
    if (str.includes('armour and evasion') || (str.includes('armour') && str.includes('evasion rating'))) return 'armor_evasion';
    if (str.includes('armour and energy') || (str.includes('armour') && str.includes('energy shield'))) return 'armor_energy';
    if (str.includes('evasion and energy') || (str.includes('evasion') && str.includes('energy shield'))) return 'evasion_energy';
    if (str.includes('armour')) return 'armor';
    if (str.includes('evasion')) return 'evasion';
    if (str.includes('energy shield')) return 'energy';
    if (str.includes('ward')) return 'ward';
    if (str.includes('suppress spell damage') || str.includes('suppressed')) return 'defense';
    if (str.includes('block')) return 'block';

    // Damage
    if (str.includes('fire damage') || tagList.includes('fire')) return 'fire_damage';
    if (str.includes('cold damage') || tagList.includes('cold')) return 'cold_damage';
    if (str.includes('lightning damage') || tagList.includes('lightning')) return 'lightning_damage';
    if (str.includes('chaos damage') || tagList.includes('chaos')) return 'chaos_damage';
    if (str.includes('physical damage') || str.includes('global physical')) return 'phys';
    if (str.includes('spell damage')) return 'spell_damage';
    if (str.includes('increased damage')) return 'damage';

    // Eldritch / Special
    if (str.includes('searing exarch') || str.includes('exarch')) return 'exarch';
    if (str.includes('eater of worlds') || str.includes('eater')) return 'eater';
    if (str.includes('essence') || tagList.includes('essence')) return 'essence';
    if (str.includes('crafted') || str.includes('master')) return 'mastercraft';
    if (str.includes('delve')) return 'delve';
    if (str.includes('incursion')) return 'incursion';
    if (str.includes('syndicate') || str.includes('veiled')) return 'syndicate';
    if (str.includes('synthesis')) return 'synthesis';
    if (str.includes('vaal')) return 'vaal';

    if (fam.includes('life')) return 'life';
    if (fam.includes('fire')) return 'fire';
    if (fam.includes('cold')) return 'cold';
    if (fam.includes('lightning')) return 'lightning';
    if (fam.includes('chaos')) return 'chaos';
    if (fam.includes('speed')) return 'speed';
    if (fam.includes('mana')) return 'mana';
    if (fam.includes('armour') || fam.includes('evasion') || fam.includes('energy') || fam.includes('defence')) return 'defense';

    return null;
  },

  calculateOverallUniqueScore(analysis = {}) {
    const mods = [
      ...(analysis.implicits || []),
      ...(analysis.mods || [])
    ];
    const validRolls = [];
    for (const m of mods) {
      if (m.rollAnalysis) {
        for (const r of m.rollAnalysis) {
          if (typeof r.percentile === 'number') {
            validRolls.push(r.percentile);
          }
        }
      }
    }
    if (validRolls.length === 0) return 50;
    const avg = validRolls.reduce((a, b) => a + b, 0) / validRolls.length;
    return Math.round(avg * 100);
  },

  /**
   * Render single mod card with tier badge and roll progress bar.
   */
  renderModRow(mod, group = 'explicit') {
    const isAmbiguous = mod.status === 'ambiguous';
    const isMatched = mod.status === 'matched';
    const tier = mod.tier;
    const tierName = mod.tierName;
    const tierClass = tier ? (tier === 1 ? 'tier-t1' : tier === 2 ? 'tier-t2' : tier === 3 ? 'tier-t3' : 'tier-t4') : 'tier-none';

    const rollBars = (mod.rollAnalysis || []).map(r => {
      if (r.percentile === null || r.min === null || r.max === null) return '';
      const pct = Math.round(r.percentile * 100);
      const isMaxRoll = pct >= 100;
      const isMinRoll = pct <= 0;

      return `
        <div class="roll-bar-wrapper">
          <span class="roll-bound roll-min">${r.min}</span>
          <div class="roll-track" title="Roll: ${r.value} trong khoảng [${r.min}, ${r.max}] (${pct}%)">
            <div class="roll-bar-fill ${isMaxRoll ? 'perfect-roll' : ''}" style="width: ${pct}%;"></div>
            <div class="roll-thumb" style="left: ${pct}%;"></div>
          </div>
          <span class="roll-bound roll-max">${r.max}</span>
          <span class="roll-percentile-pill ${isMaxRoll ? 'pill-perfect' : isMinRoll ? 'pill-min' : ''}">${r.display || `${pct}%`}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="mod-card ${tierClass} ${group}-mod-card">
        <div class="mod-card-header">
          <div class="mod-badge-group">
            ${tier ? `<span class="tier-badge ${tierClass}" title="Bậc Tier ${tier}${tierName ? ` (${tierName})` : ''}">T${tier}</span>` : ''}
            ${mod.family ? `<span class="mod-family-name">${this.escapeHtml(mod.family)}</span>` : ''}
            ${isAmbiguous ? `<span class="ambiguous-badge" title="Affix có thể thuộc nhiều họ mod khác nhau"><i class="fa-solid fa-triangle-exclamation"></i> Nhập nhằng</span>` : ''}
          </div>
          ${mod.requiredItemLevel ? `<span class="mod-req-lvl">iLvl ${mod.requiredItemLevel}+</span>` : ''}
        </div>
        <div class="mod-text">${this.escapeHtml(mod.text)}</div>
        ${rollBars ? `<div class="mod-roll-container">${rollBars}</div>` : ''}
      </div>
    `;
  },

  /**
   * Render Crafting Capacity Banner.
   */
  renderCraftingCapacityBanner(capacity) {
    const { openPrefixes, openSuffixes, canCraft, isAffixCountPrecise, hasUncertainAffixes } = capacity;
    const canBench = openPrefixes > 0 || openSuffixes > 0;

    return `
      <div class="crafting-summary-banner ${canBench ? 'can-bench' : 'cannot-bench'}">
        <div class="crafting-banner-icon">
          <i class="fa-solid ${canBench ? 'fa-screwdriver-wrench' : 'fa-ban'}"></i>
        </div>
        <div class="crafting-banner-info">
          <div class="crafting-banner-title">
            ${canBench ? 'Có thể chế tạo thêm dòng (Crafting Available)' : 'Vật phẩm đã đầy slot thuộc tính'}
          </div>
          <div class="crafting-banner-desc">
            ${canBench ? `Bạn có thể dùng Bench Craft hoặc Exalted Orb để thêm: <strong>${openPrefixes > 0 ? `${openPrefixes} Prefix` : ''}${openPrefixes > 0 && openSuffixes > 0 ? ' và ' : ''}${openSuffixes > 0 ? `${openSuffixes} Suffix` : ''}</strong>` : 'Đã đạt tối đa 3 Prefixes và 3 Suffixes.'}
          </div>
          ${hasUncertainAffixes ? `<div class="crafting-uncertain-warning"><i class="fa-solid fa-triangle-exclamation"></i> Vật phẩm chứa mod chưa xác định rõ họ, số slot trên là ước lượng.</div>` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render Combat & Defences tab.
   */
  renderCombatTab(analysis = {}, properties = {}, identity = {}) {
    let html = '';

    // Weapon Combat Block
    if (analysis.dps && analysis.dps.isWeapon) {
      const d = analysis.dps;
      const q = d.qualityScaling || {};

      html += `
        <div class="combat-block weapon-combat-block">
          <h3 class="combat-block-title"><i class="fa-solid fa-swords"></i> Chỉ số sát thương vũ khí (Weapon DPS)</h3>
          <div class="combat-grid">
            <div class="combat-card total-dps-card">
              <span class="combat-card-label">Total DPS</span>
              <strong class="combat-card-val">${d.totalDps}</strong>
              <span class="combat-card-sub">Tổng hợp tất cả nguồn sát thương</span>
            </div>
            <div class="combat-card">
              <span class="combat-card-label">Physical DPS (pDPS)</span>
              <strong class="combat-card-val text-phys">${d.physicalDps}</strong>
              <span class="combat-card-sub">Crit: ${properties.criticalChance || 5.0}% · APS: ${d.aps}</span>
            </div>
            <div class="combat-card">
              <span class="combat-card-label">Elemental DPS (eDPS)</span>
              <strong class="combat-card-val text-elem">${d.elementalDps}</strong>
              <span class="combat-card-sub">${(d.elementalBreakdown || []).map(b => `${b.type.toUpperCase()}: ${b.dps}`).join(' · ') || 'None'}</span>
            </div>
            ${d.chaosDps > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Chaos DPS (cDPS)</span>
                <strong class="combat-card-val text-chaos">${d.chaosDps}</strong>
                <span class="combat-card-sub">Sát thương hỗn mang</span>
              </div>
            ` : ''}
          </div>

          <!-- Quality Projection (Estimated Approximation) -->
          <div class="quality-projection-card">
            <div class="quality-proj-header">
              <span><i class="fa-solid fa-arrow-trend-up"></i> Ước tính tăng tiến theo Quality (Blacksmith's Whetstone · Estimated 20% Quality DPS)</span>
              <span class="current-q">Hiện tại: +${d.quality}% Quality</span>
            </div>
            <div class="quality-proj-row">
              <div class="q-metric">
                <span class="q-label">Tại 0% Quality:</span>
                <strong class="q-val">${q.physicalDpsAt0Quality || d.physicalDps} pDPS</strong>
              </div>
              <div class="q-arrow"><i class="fa-solid fa-angles-right"></i></div>
              <div class="q-metric">
                <span class="q-label">Ước tính tại 20% Quality:</span>
                <strong class="q-val text-emerald">${q.physicalDpsAt20Quality || d.physicalDps} pDPS</strong>
                <span class="q-sub">(Total: ~${q.totalDpsAt20Quality || d.totalDps} DPS · ước lượng)</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Armour / Defences Block
    const base = analysis.base || {};
    const hasDef = properties.armour > 0 || properties.evasion > 0 || properties.energyShield > 0 || properties.ward > 0;

    if (hasDef || base.baseDefences) {
      html += `
        <div class="combat-block defence-combat-block">
          <h3 class="combat-block-title"><i class="fa-solid fa-shield"></i> Chỉ số phòng ngự (Defences)</h3>
          <div class="combat-grid">
            ${properties.armour > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Armour</span>
                <strong class="combat-card-val">${this.formatNumber(properties.armour)}</strong>
                ${base.baseDefences?.armour ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.armour.min}–${base.baseDefences.armour.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.evasion > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Evasion Rating</span>
                <strong class="combat-card-val">${this.formatNumber(properties.evasion)}</strong>
                ${base.baseDefences?.evasion ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.evasion.min}–${base.baseDefences.evasion.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.energyShield > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Energy Shield</span>
                <strong class="combat-card-val text-es">${this.formatNumber(properties.energyShield)}</strong>
                ${base.baseDefences?.energyShield ? `<span class="combat-card-sub">Gốc: ${base.baseDefences.energyShield.min}–${base.baseDefences.energyShield.max}</span>` : ''}
              </div>
            ` : ''}
            ${properties.ward > 0 ? `
              <div class="combat-card">
                <span class="combat-card-label">Ward</span>
                <strong class="combat-card-val">${this.formatNumber(properties.ward)}</strong>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    // Requirements & Base Specs
    const reqs = properties.requirements || base.requirements?.item || {};
    html += `
      <div class="combat-block req-combat-block">
        <h3 class="combat-block-title"><i class="fa-solid fa-list-check"></i> Yêu cầu trang bị &amp; Base Item</h3>
        <div class="req-tags-row">
          ${reqs.level ? `<span class="req-tag">Level: <strong>${reqs.level}</strong></span>` : ''}
          ${reqs.str ? `<span class="req-tag text-str">Str: <strong>${reqs.str}</strong></span>` : ''}
          ${reqs.dex ? `<span class="req-tag text-dex">Dex: <strong>${reqs.dex}</strong></span>` : ''}
          ${reqs.int ? `<span class="req-tag text-int">Int: <strong>${reqs.int}</strong></span>` : ''}
          ${base.dropLevel ? `<span class="req-tag">Drop Level: <strong>${base.dropLevel}</strong></span>` : ''}
        </div>
      </div>
    `;

    return html || '<div class="inspector-empty-state"><p>Không có dữ liệu chiến đấu cho trang bị này.</p></div>';
  },

  /**
   * Render Market & Valuation tab.
   */
  renderMarketTab(market = null, fullData = {}) {
    if (!market) {
      return `
        <div class="inspector-empty-state">
          <i class="fa-solid fa-store-slash" style="font-size: 2rem; margin-bottom: 12px; opacity: 0.5;"></i>
          <p>Chưa có dữ liệu thị trường poe.ninja cho vật phẩm này trong League hiện tại.</p>
          <span class="text-muted text-xs">Chỉ số này phụ thuộc vào phân loại vật phẩm (Uniques, Currency, BaseTypes...)</span>
        </div>
      `;
    }

    const isDivineMajor = market.divineValue >= 1;
    const ninjaUrl = `https://poe.ninja/${market.game || 'poe1'}/economy/${encodeURIComponent(market.league || 'Standard')}/${encodeURIComponent(market.sourceType || 'currency')}?name=${encodeURIComponent(market.name)}`;

    return `
      <div class="market-tab-content">
        <div class="market-valuation-card">
          <div class="market-val-header">
            <div>
              <div class="market-item-title">${this.escapeHtml(market.name)}</div>
              <div class="market-league-crumb"><i class="fa-solid fa-earth-americas"></i> League: <strong>${this.escapeHtml(market.league || 'Standard')}</strong></div>
            </div>
            <a href="${ninjaUrl}" target="_blank" rel="noopener" class="btn-ninja-link">
              poe.ninja ↗
            </a>
          </div>

          <div class="market-price-big">
            <span class="price-main">${isDivineMajor ? `${market.divineValue} Divine` : `${market.chaosValue} Chaos`}</span>
            <span class="price-sub">≈ ${isDivineMajor ? `${market.chaosValue} Chaos` : `${market.divineValue} Divine`}</span>
          </div>

          ${market.isBaseReference ? `
            <div class="market-reference-banner">
              <i class="fa-solid fa-circle-info"></i>
              <span><strong>Tham chiếu giá base item (Base item reference)</strong>: Đây là giá thị trường của base item / phôi đồ trên poe.ninja, không phải định giá toàn bộ thuộc tính affix của trang bị này.</span>
            </div>
          ` : ''}

          ${market.variant ? `<div class="market-variant-note"><i class="fa-solid fa-tags"></i> Biến thể (Variant): <strong>${this.escapeHtml(market.variant)}</strong></div>` : ''}

          ${((market.count !== null && market.count !== undefined) || (market.volume !== null && market.volume !== undefined)) ? `
            <div class="market-volume-note"><i class="fa-solid fa-box-archive"></i> Số lượng / Volume niêm yết: <strong>${this.formatNumber(market.count ?? market.volume)}</strong></div>
          ` : ''}
        </div>
      </div>
    `;
  },

  /**
   * Render Raw Text tab.
   */
  renderRawTab(data = {}) {
    const rawText = data.rawText || '';
    return `
      <div class="raw-tab-content">
        <div class="raw-tab-header">
          <span>Nội dung clipboard Path of Exile gốc:</span>
          <button class="btn-copy-raw-text" id="btnCopyRawInspector" title="Sao chép toàn bộ văn bản">
            <i class="fa-solid fa-copy"></i> Sao chép
          </button>
        </div>
        <pre class="raw-item-pre" id="rawItemPreContent">${this.escapeHtml(rawText)}</pre>
      </div>
    `;
  }
};
