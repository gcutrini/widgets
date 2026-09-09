// Ambient declarations for modules that ship without TypeScript types.
// Module paths must match the import specifiers exactly (some dists resolve
// via /dist, others /dist/index or /dist/index.js). Each block repeats its
// react import on purpose: a top-level import would turn this file into a
// module and the declarations into augmentations.

// ─── Widget dists — untyped pre-built bundles, one default-exported component ───

declare module 'event-feedback-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'full-schedule-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'lite-schedule-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'live-event-widget/dist/index.js' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'my-orders-tickets-widget/dist/index' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'my-orders-tickets-widget/dist/i18n';

declare module 'schedule-filter-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'speakers-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'summit-registration-lite/dist/components/registration-form' {
  import type { ComponentType } from 'react';
  export const RegistrationForm: ComponentType<Record<string, unknown>>;
  const _default: ComponentType<Record<string, unknown>>;
  export default _default;
}

declare module 'upcoming-events-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

// ─── uicore modules — only the surfaces we call are typed ───

declare module 'openstack-uicore-foundation/lib/components/extra-questions' {
  import type { ComponentType, RefObject } from 'react';
  interface ExtraQuestionsFormProps {
    extraQuestions: unknown[];
    userAnswers: unknown[];
    onAnswerChanges: (answers: Record<string, unknown>) => void;
    className?: string;
    questionContainerClassName?: string;
    questionLabelContainerClassName?: string;
    questionControlContainerClassName?: string;
    readOnly?: boolean;
    debug?: boolean;
    buttonText?: string;
    RequiredErrorMessage?: string;
    ValidationErrorClassName?: string;
    allowExtraQuestionsEdit?: boolean;
    onError?: (errors: unknown, ref?: unknown, id?: number) => void;
    shouldScroll2FirstError?: boolean;
    ref?: RefObject<ExtraQuestionsFormHandle | null>;
  }
  export interface ExtraQuestionsFormHandle {
    doSubmit(): void;
    scroll2QuestionById(id: number): void;
  }
  const ExtraQuestionsForm: ComponentType<ExtraQuestionsFormProps>;
  export default ExtraQuestionsForm;
}

declare module 'openstack-uicore-foundation/lib/utils/config' {
  export interface UicoreConfig {
    apiBaseUrl?: string;
    timeApiUrl?: string;
    allowedUserGroups?: string;
    oauth2ClientId?: string;
    oauth2Flow?: string;
    oauth2UseRefreshToken?: boolean;
    idpBaseUrl?: string;
    scopes?: string;
    exclusiveSections?: string[];
  }
  export const setConfig: (config?: UicoreConfig | null) => void;
}

// Only the opt-in setters uicore-host calls are typed.
declare module 'openstack-uicore-foundation/lib/security/methods' {
  export const setAccessTokenResolver: (
    resolver?: (() => Promise<string>) | null,
  ) => void;
  export const setAuthHandlers: (handlers?: {
    initLogOut?: () => void | Promise<void>;
    authErrorHandler?: (detail: { status: number }) => void;
  }) => void;
}
