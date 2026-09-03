// Ambient declarations for widget packages that ship without TypeScript types.

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

declare module 'schedule-filter-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'summit-registration-lite/dist/components/registration-form' {
  import type { ComponentType } from 'react';
  type WidgetProps = Record<string, unknown> & { [key: string]: unknown };
  export const RegistrationForm: ComponentType<WidgetProps>;
  const _default: ComponentType<WidgetProps>;
  export default _default;
}

declare module 'my-orders-tickets-widget/dist/index' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'my-orders-tickets-widget/dist/i18n';

declare module 'upcoming-events-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'live-event-widget/dist/index.js' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'speakers-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
}

declare module 'openstack-uicore-foundation/lib/components/clock-context' {
  import type { ComponentType, ReactNode } from 'react';
  export const ClockProvider: ComponentType<{
    timezone?: string;
    now?: number;
    children: ReactNode;
  }>;
  /**
   * The synchronized clock's "now" in epoch SECONDS (`null` until the
   * first tick). Subscribing re-renders the consumer every second —
   * prefer a `useClockSelector` derivation (minute, phase) unless
   * per-second granularity is genuinely needed.
   */
  export function useClock(): number | null;
  /**
   * Derive from the clock; the consumer re-renders only when the
   * selected value changes (per `equalityFn`, default `Object.is`).
   * `now` is epoch SECONDS, `null` until the first tick.
   */
  export function useClockSelector<T>(
    selector: (now: number | null) => T,
    equalityFn?: (a: T, b: T) => boolean,
  ): T;
}


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

declare module 'event-feedback-widget/dist' {
  import type { ComponentType } from 'react';
  const Widget: ComponentType<Record<string, unknown>>;
  export default Widget;
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
