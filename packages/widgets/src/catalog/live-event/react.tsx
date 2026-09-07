'use client';

import { createReactComponentWidget } from '../../mount/create-widget-component';
import { liveEventManifest } from './manifest';

/** live-event on the host React, from its full manifest. */
export default createReactComponentWidget(liveEventManifest);
