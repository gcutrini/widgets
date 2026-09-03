'use client';

import { registerRenderer } from './registry';
import type { WidgetRenderer } from './WidgetRenderer';
import { registerHostConfig, type HostConfig } from '../core/host-config';
import { registerHostAuth, type HostAuth } from '../core/host-auth';
import { configureUicore } from '../lib/uicore-host';

export interface WidgetHostSetup {
  config: HostConfig;
  auth: HostAuth;
  renderers: WidgetRenderer[];
}

/**
 * The host's single setup call: fills the ports, registers the renderers and
 * hands uicore its configuration. Owning the sequence here matters —
 * configureUicore reads the config port eagerly, so it must run after the
 * port is filled, an ordering no caller should have to know about.
 *
 * Deliberately NOT exported from the ./mount barrel: this module pulls
 * uicore (through uicore-host), and the barrel is imported by every widget
 * client graph.
 */
export function configureWidgetHost({ config, auth, renderers }: WidgetHostSetup): void {
  registerHostConfig(config);
  registerHostAuth(auth);
  for (const renderer of renderers) registerRenderer(renderer);
  configureUicore();
}
