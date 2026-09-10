'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { upcomingEventsManifest } from './manifest';

/** upcoming-events on the host React, from its full manifest. */
export default createReactComponentWidget(upcomingEventsManifest);
