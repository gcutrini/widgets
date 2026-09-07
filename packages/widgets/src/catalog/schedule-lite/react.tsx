'use client';

import { createReactComponentWidget } from '../../mount/create-widget-component';
import { scheduleLiteManifest } from './manifest';

/** schedule-lite on the host React, from its full manifest. */
export default createReactComponentWidget(scheduleLiteManifest);
