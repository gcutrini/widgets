'use client';

import { createReactComponentWidget } from '../../mount/create-widget-component';
import { eventFeedbackManifest } from './manifest';

/** event-feedback on the host React, from its full manifest. */
export default createReactComponentWidget(eventFeedbackManifest);
