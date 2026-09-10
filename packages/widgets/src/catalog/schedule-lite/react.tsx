'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { scheduleLiteManifest } from './manifest';

/** schedule-lite on the host React, from its full manifest. */
export default createReactComponentWidget(scheduleLiteManifest);
