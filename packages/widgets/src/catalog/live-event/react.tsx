'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { liveEventManifest } from './manifest';

/** live-event on the host React, from its full manifest. */
export default createManifestWidget(liveEventManifest);
