'use client';

import { createManifestWidget } from '../../mount/create-widget-component';
import { eventFeedbackManifest } from './manifest';

/** event-feedback on the host React, from its full manifest. */
export default createManifestWidget(eventFeedbackManifest);
