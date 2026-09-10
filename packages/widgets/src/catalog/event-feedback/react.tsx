'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { eventFeedbackManifest } from './manifest';

/** event-feedback on the host React, from its full manifest. */
export default createReactComponentWidget(eventFeedbackManifest);
