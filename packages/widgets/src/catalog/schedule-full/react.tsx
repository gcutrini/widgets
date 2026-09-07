'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { scheduleFullManifest } from './manifest';

/** schedule-full on the host React, from its full manifest. */
export default createManifestWidget(scheduleFullManifest);
