'use client';

import { createWebComponentWidget } from '../../mount/create-widget-component';

/**
 * registration on the web-component runtime — its own bundle owns the manifest,
 * so this module stays out of the manifest graph.
 */
export default createWebComponentWidget('registration');
