'use client';

import { type ReactNode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

/**
 * Gives a widget's MUI the event font — a direct port of the reference site's
 * theme (event-site/src/styles/theme.js):
 *
 *     createTheme({ typography: { fontFamily: 'var(--font_family)' } })
 *
 * Why it's needed: a web-component widget runs on its OWN React + MUI instance,
 * so it can't read the app's MUI `ThemeProvider` — MUI-rendered text falls back
 * to its default (Roboto). Pointing `fontFamily` at the `--font_family` CSS var
 * (published on `:root`, inherited across the shadow boundary) fixes that; `var()`
 * is a plain string MUI passes through to emotion, so it resolves in the shadow.
 *
 * A FRESH `createTheme` (not a merge onto the outer theme) is deliberate: MUI
 * derives every typography variant's `fontFamily` from the base at theme-creation
 * time, so overriding only the base on an already-built theme would leave the
 * variants on Roboto. These widgets take their colors from `--color_*` (vendor
 * CSS), not the MUI palette, so building a fresh theme costs no color fidelity.
 *
 * Wrap INSIDE `EmotionShadowProvider` — the emotion cache must sit above MUI.
 */
const widgetTheme = createTheme({ typography: { fontFamily: 'var(--font_family)' } });

export function MuiThemeBridge({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={widgetTheme}>{children}</ThemeProvider>;
}
