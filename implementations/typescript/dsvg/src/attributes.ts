import { DSVG_ATTR_PREFIX } from './types.js';

/** Canonical container layout attribute names. */
export const CONTAINER_LAYOUT_ATTRS = {
  layout: `${DSVG_ATTR_PREFIX}layout`,
  flexDirection: `${DSVG_ATTR_PREFIX}flex-direction`,
  flexWrap: `${DSVG_ATTR_PREFIX}flex-wrap`,
  justifyContent: `${DSVG_ATTR_PREFIX}justify-content`,
  alignItems: `${DSVG_ATTR_PREFIX}align-items`,
  alignContent: `${DSVG_ATTR_PREFIX}align-content`,
  gap: `${DSVG_ATTR_PREFIX}gap`,
  rowGap: `${DSVG_ATTR_PREFIX}row-gap`,
  columnGap: `${DSVG_ATTR_PREFIX}column-gap`,
  padding: `${DSVG_ATTR_PREFIX}padding`,
  paddingTop: `${DSVG_ATTR_PREFIX}padding-top`,
  paddingRight: `${DSVG_ATTR_PREFIX}padding-right`,
  paddingBottom: `${DSVG_ATTR_PREFIX}padding-bottom`,
  paddingLeft: `${DSVG_ATTR_PREFIX}padding-left`,
  width: `${DSVG_ATTR_PREFIX}width`,
  height: `${DSVG_ATTR_PREFIX}height`,
} as const;

/** Canonical child layout attribute names. */
export const CHILD_LAYOUT_ATTRS = {
  flexGrow: `${DSVG_ATTR_PREFIX}flex-grow`,
  flexShrink: `${DSVG_ATTR_PREFIX}flex-shrink`,
  flexBasis: `${DSVG_ATTR_PREFIX}flex-basis`,
  alignSelf: `${DSVG_ATTR_PREFIX}align-self`,
  width: `${DSVG_ATTR_PREFIX}width`,
  height: `${DSVG_ATTR_PREFIX}height`,
} as const;

/** Allowed `data-dsvg-flex-direction` values. */
export const FLEX_DIRECTION_VALUES = ['row', 'column', 'row-reverse', 'column-reverse'] as const;

/** Allowed `data-dsvg-flex-wrap` values. */
export const FLEX_WRAP_VALUES = ['nowrap', 'wrap', 'wrap-reverse'] as const;

/** Allowed `data-dsvg-justify-content` values. */
export const JUSTIFY_CONTENT_VALUES = [
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
  'space-evenly',
] as const;

/** Allowed `data-dsvg-align-items` values. */
export const ALIGN_ITEMS_VALUES = [
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline',
] as const;

/** Allowed `data-dsvg-align-content` values. */
export const ALIGN_CONTENT_VALUES = [
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'space-between',
  'space-around',
] as const;

/** Allowed `data-dsvg-align-self` values. */
export const ALIGN_SELF_VALUES = [
  'auto',
  'flex-start',
  'center',
  'flex-end',
  'stretch',
  'baseline',
] as const;

export type FlexDirection = (typeof FLEX_DIRECTION_VALUES)[number];
export type FlexWrap = (typeof FLEX_WRAP_VALUES)[number];
export type JustifyContent = (typeof JUSTIFY_CONTENT_VALUES)[number];
export type AlignItems = (typeof ALIGN_ITEMS_VALUES)[number];
export type AlignContent = (typeof ALIGN_CONTENT_VALUES)[number];
export type AlignSelf = (typeof ALIGN_SELF_VALUES)[number];

/**
 * Returns whether a string parses as a finite number.
 * @param value - Raw attribute string.
 * @returns True when the value is a finite number.
 */
export const isFiniteNumberString = (value: string): boolean => {
  if (value.trim() === '') {
    return false;
  }
  const number = Number(value);
  return Number.isFinite(number);
};

/**
 * Parses a finite number from an attribute string.
 * @param value - Raw attribute string.
 * @returns Parsed number, or undefined when invalid.
 */
export const parseFiniteNumber = (value: string): number | undefined => {
  if (!isFiniteNumberString(value)) {
    return undefined;
  }
  return Number(value);
};

/**
 * Type-guard helper for closed keyword sets.
 * @param value - Candidate keyword.
 * @param allowed - Allowed keyword list.
 * @returns True when value is one of the allowed keywords.
 */
export const isOneOf = <T extends string>(value: string, allowed: readonly T[]): value is T => {
  return (allowed as readonly string[]).includes(value);
};
