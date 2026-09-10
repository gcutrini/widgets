'use client';

import { createReactComponentWidget } from '../../mount/createWidgetComponent';
import { extraQuestionsManifest } from './manifest';

/** extra-questions on the host React, from its full manifest. */
export default createReactComponentWidget(extraQuestionsManifest);
