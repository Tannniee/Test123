/**
 * POESTASH Item Input Validator
 * Unified validation for item text across Bridge (/api/bridge/inspect) and Analyzer (/api/analyze-item).
 */

const DEFAULT_MAX_LENGTH = 20000;

/**
 * Validates raw item clipboard text.
 *
 * @param {*} rawText Input item text
 * @param {Object} [options]
 * @param {boolean} [options.requirePoeMarkers=false] Whether text must contain standard PoE clipboard markers
 * @param {number} [options.maxLength=20000] Maximum allowed characters
 * @returns {{ isValid: boolean, status?: number, error?: string, trimmedText?: string }}
 */
function validateItemRawText(rawText, options = {}) {
  const { requirePoeMarkers = false, maxLength = DEFAULT_MAX_LENGTH } = options;

  if (rawText === null || rawText === undefined || typeof rawText !== 'string') {
    return {
      isValid: false,
      status: 400,
      error: 'Field "rawText" is required and must be a string.'
    };
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      status: 400,
      error: 'Field "rawText" is required and cannot be empty.'
    };
  }

  if (rawText.length > maxLength) {
    return {
      isValid: false,
      status: 400,
      error: `Field "rawText" exceeds maximum allowed length of ${maxLength.toLocaleString('en-US')} characters.`
    };
  }

  if (requirePoeMarkers) {
    const hasPoeMarkers =
      trimmed.includes('Item Class:') ||
      trimmed.includes('Rarity:') ||
      trimmed.includes('--------') ||
      trimmed.includes('Item Level:') ||
      trimmed.includes('Waystone Tier:');

    if (!hasPoeMarkers) {
      return {
        isValid: false,
        status: 400,
        error: 'Invalid rawText: does not match standard Path of Exile clipboard item format.'
      };
    }
  }

  return {
    isValid: true,
    trimmedText: trimmed
  };
}

module.exports = {
  validateItemRawText,
  DEFAULT_MAX_LENGTH
};
