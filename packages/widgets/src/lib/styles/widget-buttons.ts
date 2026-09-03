/**
 * Baseline styling for the unhashed `.button` class rendered by widgets
 * that expect a host-supplied button style (e.g. summit-registration-lite's
 * cookie-consent Accept button). The widget's own CSS only styles hashed
 * `.button___xxx` variants; the plain `.button` class ships bare, and
 * relies on ambient host styles.
 *
 * Colors reference the shadow-host CSS variables so marketing-driven
 * palettes flow through. Fallbacks are neutral defaults.
 */

export const css: string = `
.button {
  align-items: center;
  appearance: none;
  border: 1px solid var(--color_input_border_color, #dbdbdb);
  border-radius: 4px;
  box-shadow: none;
  display: inline-flex;
  font-size: 1rem;
  height: 2.5em;
  justify-content: center;
  line-height: 1.5;
  padding: calc(0.5em - 1px) 1em;
  position: relative;
  vertical-align: top;
  background-color: var(--color_input_background_color, #ffffff);
  color: var(--color_input_text_color, #363636);
  cursor: pointer;
  text-align: center;
  white-space: nowrap;
  font-family: inherit;
}
.button:hover {
  border-color: var(--color_gray_dark, #999999);
  color: var(--color_input_text_color, #363636);
}
.button:focus,
.button.is-focused {
  border-color: var(--color_primary, #6d6e71);
  color: var(--color_input_text_color, #363636);
  outline: none;
}
.button:active,
.button.is-active {
  border-color: var(--color_gray_darker, #4a4a4a);
  color: var(--color_input_text_color, #363636);
}
.button[disabled],
.button.is-disabled {
  background-color: var(--color_input_background_color, #ffffff);
  border-color: var(--color_input_border_color, #dbdbdb);
  box-shadow: none;
  opacity: 0.5;
  cursor: not-allowed;
}
`;
