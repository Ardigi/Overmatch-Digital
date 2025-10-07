// Mock for SanitizationUtil in E2E tests
class SanitizationUtil {
  static sanitizeHtml(content, strict = false) {
    return content || '';
  }

  static sanitizeText(text) {
    // Don't modify text in E2E tests to preserve UUIDs
    return text || '';
  }

  static sanitizeEmail(email) {
    return email || '';
  }

  static sanitizeUrl(url) {
    return url || '';
  }

  static sanitizeFilePath(path) {
    return path || '';
  }

  static sanitizeJson(json) {
    return json;
  }

  static sanitizePolicyContent(content) {
    return content;
  }

  static sanitizeSqlInput(input) {
    return input || '';
  }

  static sanitizeSearchQuery(query) {
    return query || '';
  }

  static sanitizeNumber(value, min, max) {
    return Number(value);
  }

  static sanitizeBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return false;
  }

  static sanitizeDate(date) {
    return new Date(date);
  }

  static sanitizeArray(array, itemSanitizer, maxLength = 1000) {
    return array;
  }

  static sanitizeEnum(value, enumType) {
    return value;
  }

  static sanitizeObjectKeys(obj) {
    return obj;
  }
}

module.exports = { SanitizationUtil };
