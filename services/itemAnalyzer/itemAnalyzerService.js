const ItemTextParser = require('./itemTextParser');
const ItemClassifier = require('./itemClassifier');
const modMatcher = require('./modMatcher');
const rollAnalyzer = require('./rollAnalyzer');
const baseAnalyzer = require('./baseAnalyzer');
const dpsAnalyzer = require('./dpsAnalyzer');
const uniqueAnalyzer = require('./uniqueAnalyzer');
const marketResolver = require('./marketResolver');
const defaultCacheManager = require('../cacheManager');

class ItemAnalyzerService {
  analyze(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      throw new Error('Field "rawText" is required and cannot be empty.');
    }

    const initialGame = options.game || 'poe1';
    const canonicalItem = ItemTextParser.parse(rawText, initialGame);
    const game = canonicalItem.game || initialGame;

    const classification = ItemClassifier.classify(canonicalItem);

    const matchOpts = {
      itemLevel: canonicalItem.properties ? canonicalItem.properties.itemLevel : 100,
      itemClass: canonicalItem.identity ? canonicalItem.identity.itemClass : null,
      game,
      descriptors: (canonicalItem.modifiers && canonicalItem.modifiers.descriptors) || {}
    };

    // Analyze modifiers
    const explicits = (canonicalItem.modifiers && canonicalItem.modifiers.explicits) || [];
    const implicits = (canonicalItem.modifiers && canonicalItem.modifiers.implicits) || [];
    const fractured = (canonicalItem.modifiers && canonicalItem.modifiers.fractured) || [];
    const crafted = (canonicalItem.modifiers && canonicalItem.modifiers.crafted) || [];

    const analyzedExplicits = rollAnalyzer.analyzeAll(modMatcher.matchAll(explicits, matchOpts));
    const analyzedImplicits = rollAnalyzer.analyzeAll(modMatcher.matchAll(implicits, matchOpts));
    const analyzedFractured = rollAnalyzer.analyzeAll(modMatcher.matchAll(fractured, matchOpts));
    const analyzedCrafted = rollAnalyzer.analyzeAll(modMatcher.matchAll(crafted, matchOpts));

    // Analyze base properties & affix capacity
    const allCraftableAffixes = [...analyzedExplicits, ...analyzedFractured, ...analyzedCrafted];
    const baseAnalysis = baseAnalyzer.analyze(canonicalItem, allCraftableAffixes, game);

    // Analyze DPS for weapons
    const dpsAnalysis = dpsAnalyzer.analyze(canonicalItem);

    // Analyze Unique metadata
    const uniqueAnalysis = uniqueAnalyzer.analyze(canonicalItem, game);

    // Resolve market valuation
    const cacheMgr = options.cacheManager || defaultCacheManager;
    const marketData = marketResolver.resolve(canonicalItem, {
      game,
      league: options.league,
      cacheManager: cacheMgr
    });

    return {
      success: true,
      item: canonicalItem,
      classification,
      analysis: {
        base: baseAnalysis,
        mods: analyzedExplicits,
        implicits: analyzedImplicits,
        fractured: analyzedFractured,
        crafted: analyzedCrafted,
        dps: dpsAnalysis,
        unique: uniqueAnalysis,
        affixCapacity: baseAnalysis ? baseAnalysis.affixCapacity : null
      },
      market: marketData,
      source: options.source || 'manual_paste'
    };
  }
}

module.exports = new ItemAnalyzerService();
