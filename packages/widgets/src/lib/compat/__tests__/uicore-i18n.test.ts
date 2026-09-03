import { describe, expect, it } from 'vitest';
import T from 'i18n-react';
// The seed under test: imports uicore's dictionary module for its
// T.setTexts side effect, exactly as the reactComponent renderer and the
// island widget entries do before any widget code runs.
import '../uicore-i18n';

/**
 * uicore components surface these keys in sweetalert error modals and
 * confirm dialogs. If the seed is missing — or if i18n-react resolves
 * to a different module instance than the one uicore seeds — users see
 * the raw key (e.g. "errors.session_expired") instead of a sentence.
 */
const USER_FACING_KEYS = [
  'errors.session_expired',
  'errors.user_not_authz',
  'errors.user_not_auth',
  'errors.server_error',
  'general.are_you_sure',
] as const;

describe('uicore i18n seed', () => {
  it.each(USER_FACING_KEYS)('resolves %s to a human string', (key) => {
    const text = T.translate(key);
    expect(text).toBeTruthy();
    expect(String(text)).not.toMatch(/^(errors|general)\./);
  });
});
