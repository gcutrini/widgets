'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { scheduleFullManifest } from './manifest';

/** schedule-full on the host React, from its full manifest. */
export default createReactComponentWidget(scheduleFullManifest);
