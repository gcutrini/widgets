/**
 * Host-styled replacement for uicore's `AjaxLoader` in the web-component build.
 *
 * The shared runtime serves this module under the
 * `openstack-uicore-foundation/lib/components/ajaxloader` specifier, so every
 * widget dist that imports AjaxLoader gets this instead of uicore's default.
 * It renders the host's sign-out overlay markup (AuthTransitionOverlay): a MUI
 * `<Backdrop>` with a `<CircularProgress color="inherit" />`, so the
 * in-widget loader matches the host's overlays.
 *
 * Backdrop and CircularProgress are bare imports from the pinned MUI-5 tree —
 * they bundle into this module's runtime chunk (esbuild splitting dedupes them
 * across chunks), and the theme reaches them through the served
 * @emotion/react.
 *
 * The spinner is fixed (MUI CircularProgress) for now. If a widget ever needs
 * a different loader, this could take the component as a prop/port instead —
 * see this package's UPSTREAM.md.
 */
import React from 'react';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

interface AjaxLoaderProps {
  show?: boolean;
  relative?: boolean;
  children?: React.ReactNode;
}

const AjaxLoader = ({ show, relative, children }: AjaxLoaderProps) => {
  if (!show) return null;

  return (
    <Backdrop
      open
      // Stable hook a widget's vendor-styles can target to hide this loader
      // (see kit/styles/suppress-ajax-loader). It's our own class, not MUI's
      // generic .MuiBackdrop-root, so hiding it can't affect other backdrops.
      className="wc-ajax-loader"
      sx={{
        position: relative ? 'absolute' : 'fixed',
        color: '#fff',
        // Lighter than MUI's default backdrop (0.5) so the form stays readable.
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        zIndex: (theme: { zIndex: { modal: number } }) => theme.zIndex.modal + 1,
      }}
    >
      <CircularProgress color="inherit" />
      {children}
    </Backdrop>
  );
};

export default AjaxLoader;
