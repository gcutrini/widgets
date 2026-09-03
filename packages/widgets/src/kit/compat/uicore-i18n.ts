/**
 * Seeds uicore's i18n-react dictionary before any widget renders.
 *
 * uicore components translate their UI strings (confirm dialogs, error
 * modals, form labels — `general.*`, `errors.*`) through i18n-react, whose
 * texts must be set by the host. uicore ships its own dictionaries behind
 * `openstack-uicore-foundation/lib/i18n`, which calls `T.setTexts` for the
 * browser language (falling back to English) as an import side effect.
 *
 * Without this seed, any uicore string that renders before some other
 * uicore entrypoint happens to self-seed shows the raw key (e.g. an error
 * modal displaying `errors.session_expired`). The app's reactComponent
 * renderer imports this module alongside the other compat shims, and the
 * each island widget entry imports it (an external, served once by the
 * shared runtime graph), so the
 * dictionary exists before any widget bundle loads, on every page.
 *
 * Site-specific overrides (a broader dictionary loader) can layer on top
 * later: `T.setTexts` merges by replacement, so a later seed with a fuller
 * dictionary simply wins.
 */
import 'openstack-uicore-foundation/lib/i18n';
