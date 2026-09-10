'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { liveEventManifest } from './manifest';

/** live-event on the host React, from its full manifest. */
export default createReactComponentWidget(liveEventManifest);
