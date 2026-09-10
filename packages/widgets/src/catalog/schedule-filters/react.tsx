'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { scheduleFiltersManifest } from './manifest';

/** schedule-filters on the host React, from its full manifest. */
export default createReactComponentWidget(scheduleFiltersManifest);
