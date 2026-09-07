'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { scheduleFiltersManifest } from './manifest';

/** schedule-filters on the host React, from its full manifest. */
export default createManifestWidget(scheduleFiltersManifest);
