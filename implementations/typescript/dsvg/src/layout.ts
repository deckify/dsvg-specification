import type { Node as YogaNode } from 'yoga-layout';
import Yoga from 'yoga-layout';

import {
  ALIGN_CONTENT_VALUES,
  ALIGN_ITEMS_VALUES,
  ALIGN_SELF_VALUES,
  type AlignContent,
  type AlignItems,
  type AlignSelf,
  CHILD_LAYOUT_ATTRS,
  CONTAINER_LAYOUT_ATTRS,
  FLEX_DIRECTION_VALUES,
  FLEX_WRAP_VALUES,
  type FlexDirection,
  type FlexWrap,
  JUSTIFY_CONTENT_VALUES,
  type JustifyContent,
  parseFiniteNumber,
} from './attributes.js';
import { cloneDocument } from './clone.js';
import { DsvgCompileError, createError } from './errors.js';
import {
  type BoxSize,
  type MeasureContext,
  applyLayoutToNode,
  getContainerSize,
  measureNode,
} from './geometry.js';
import {
  type TextMeasurer,
  type TextMetrics,
  createFontMeasurer,
  isTextElement,
  normalizeTextElementContent,
  shouldMeasureTextWithFonts,
} from './text-measurement.js';
import type { DsvgDocument, DsvgNode, LayoutOptions } from './types.js';

const flexDirectionMap: Record<FlexDirection, number> = {
  row: Yoga.FLEX_DIRECTION_ROW,
  column: Yoga.FLEX_DIRECTION_COLUMN,
  'row-reverse': Yoga.FLEX_DIRECTION_ROW_REVERSE,
  'column-reverse': Yoga.FLEX_DIRECTION_COLUMN_REVERSE,
};

const flexWrapMap: Record<FlexWrap, number> = {
  nowrap: Yoga.WRAP_NO_WRAP,
  wrap: Yoga.WRAP_WRAP,
  'wrap-reverse': Yoga.WRAP_WRAP_REVERSE,
};

const justifyMap: Record<JustifyContent, number> = {
  'flex-start': Yoga.JUSTIFY_FLEX_START,
  center: Yoga.JUSTIFY_CENTER,
  'flex-end': Yoga.JUSTIFY_FLEX_END,
  'space-between': Yoga.JUSTIFY_SPACE_BETWEEN,
  'space-around': Yoga.JUSTIFY_SPACE_AROUND,
  'space-evenly': Yoga.JUSTIFY_SPACE_EVENLY,
};

const alignMap: Record<AlignItems | AlignSelf | AlignContent, number | undefined> = {
  auto: Yoga.ALIGN_AUTO,
  'flex-start': Yoga.ALIGN_FLEX_START,
  center: Yoga.ALIGN_CENTER,
  'flex-end': Yoga.ALIGN_FLEX_END,
  stretch: Yoga.ALIGN_STRETCH,
  baseline: Yoga.ALIGN_BASELINE,
  'space-between': Yoga.ALIGN_SPACE_BETWEEN,
  'space-around': Yoga.ALIGN_SPACE_AROUND,
};

type LayoutRuntime = {
  measureContext: MeasureContext;
  textMetricsByNode: WeakMap<DsvgNode, TextMetrics>;
};

/**
 * Recursively frees a Yoga node tree.
 * @param node - Root Yoga node to free.
 * @returns Nothing.
 */
const freeTree = (node: YogaNode): void => {
  const childCount = node.getChildCount();
  for (let i = childCount - 1; i >= 0; i -= 1) {
    const child = node.getChild(i);
    node.removeChild(child);
    freeTree(child);
  }
  node.free();
};

/**
 * Returns whether a node is a flex-enabled `<g>`.
 * @param node - Candidate node.
 * @returns True when the node opts into flex layout.
 */
const isFlexGroup = (node: DsvgNode): boolean =>
  node.name === 'g' && node.attributes[CONTAINER_LAYOUT_ATTRS.layout] === 'flex';

/**
 * Returns whether a node is a layoutable element child.
 * @param node - Candidate node.
 * @returns True for element children including `<text>`.
 */
const isElementChild = (node: DsvgNode): boolean => node.type !== 'text' && node.name !== '';

/**
 * Configures Yoga flex properties for a child node.
 * @param yogaChild - Yoga child node.
 * @param child - Corresponding DSVG child.
 * @param measured - Measured child size.
 * @param runtime - Shared layout runtime state.
 * @returns Nothing.
 */
const configureChild = (
  yogaChild: YogaNode,
  child: DsvgNode,
  measured: BoxSize,
  runtime: LayoutRuntime,
): void => {
  const explicitWidth = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.width] ?? '');
  const explicitHeight = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.height] ?? '');
  const needsIntrinsicText =
    isTextElement(child) &&
    !runtime.measureContext.skipTextMeasurement &&
    (explicitWidth === undefined || explicitHeight === undefined);
  const useMeasureFunc = needsIntrinsicText && runtime.measureContext.textMeasurer !== undefined;

  if (useMeasureFunc) {
    yogaChild.setMeasureFunc((_width, _widthMode, _height, _heightMode) => {
      const metrics = runtime.measureContext.textMeasurer!.measure(child);
      runtime.textMetricsByNode.set(child, metrics);
      return {
        width: explicitWidth ?? metrics.width,
        height: explicitHeight ?? metrics.height,
      };
    });
  } else {
    yogaChild.setWidth(measured.width);
    yogaChild.setHeight(measured.height);
  }

  const grow = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.flexGrow] ?? '');
  if (grow !== undefined) {
    yogaChild.setFlexGrow(grow);
  }

  const shrink = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.flexShrink] ?? '');
  if (shrink !== undefined) {
    yogaChild.setFlexShrink(shrink);
  } else {
    yogaChild.setFlexShrink(1);
  }

  const basis = child.attributes[CHILD_LAYOUT_ATTRS.flexBasis];
  if (basis === 'auto' || basis === undefined) {
    yogaChild.setFlexBasisAuto();
  } else {
    const basisNumber = parseFiniteNumber(basis);
    if (basisNumber !== undefined) {
      yogaChild.setFlexBasis(basisNumber);
    }
  }

  const alignSelf = child.attributes[CHILD_LAYOUT_ATTRS.alignSelf] as AlignSelf | undefined;
  if (alignSelf && ALIGN_SELF_VALUES.includes(alignSelf)) {
    const mapped = alignMap[alignSelf];
    if (mapped !== undefined) {
      yogaChild.setAlignSelf(mapped);
    }
  }
};

/**
 * Applies Yoga flex layout to a single flex group in place.
 * @param group - Flex group node.
 * @param fallback - Fallback container size.
 * @param runtime - Shared layout runtime state.
 * @returns Nothing.
 */
const applyFlexToGroup = (group: DsvgNode, fallback: BoxSize, runtime: LayoutRuntime): void => {
  if (!isFlexGroup(group)) {
    return;
  }

  const elementChildren = group.children.filter(isElementChild);
  if (elementChildren.length === 0) {
    return;
  }

  const container = getContainerSize(group, fallback);
  const root = Yoga.Node.create();
  const yogaChildren: YogaNode[] = [];
  const measuredSizes: BoxSize[] = [];

  try {
    root.setWidth(container.width);
    root.setHeight(container.height);

    const direction = (group.attributes[CONTAINER_LAYOUT_ATTRS.flexDirection] ??
      'row') as FlexDirection;
    if (!FLEX_DIRECTION_VALUES.includes(direction)) {
      throw new DsvgCompileError([
        createError('INVALID_VALUE', `Invalid flex-direction "${direction}"`),
      ]);
    }
    root.setFlexDirection(flexDirectionMap[direction]);

    const wrap = (group.attributes[CONTAINER_LAYOUT_ATTRS.flexWrap] ?? 'nowrap') as FlexWrap;
    if (!FLEX_WRAP_VALUES.includes(wrap)) {
      throw new DsvgCompileError([createError('INVALID_VALUE', `Invalid flex-wrap "${wrap}"`)]);
    }
    root.setFlexWrap(flexWrapMap[wrap]);

    const justify = (group.attributes[CONTAINER_LAYOUT_ATTRS.justifyContent] ??
      'flex-start') as JustifyContent;
    if (!JUSTIFY_CONTENT_VALUES.includes(justify)) {
      throw new DsvgCompileError([
        createError('INVALID_VALUE', `Invalid justify-content "${justify}"`),
      ]);
    }
    root.setJustifyContent(justifyMap[justify]);

    const alignItems = (group.attributes[CONTAINER_LAYOUT_ATTRS.alignItems] ??
      'stretch') as AlignItems;
    if (!ALIGN_ITEMS_VALUES.includes(alignItems)) {
      throw new DsvgCompileError([
        createError('INVALID_VALUE', `Invalid align-items "${alignItems}"`),
      ]);
    }
    const alignItemsMapped = alignMap[alignItems];
    if (alignItemsMapped !== undefined) {
      root.setAlignItems(alignItemsMapped);
    }

    const alignContent = (group.attributes[CONTAINER_LAYOUT_ATTRS.alignContent] ??
      'flex-start') as AlignContent;
    if (!ALIGN_CONTENT_VALUES.includes(alignContent)) {
      throw new DsvgCompileError([
        createError('INVALID_VALUE', `Invalid align-content "${alignContent}"`),
      ]);
    }
    const alignContentMapped = alignMap[alignContent];
    if (alignContentMapped !== undefined) {
      root.setAlignContent(alignContentMapped);
    }

    const gap = parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.gap] ?? '') ?? 0;
    const rowGap = parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.rowGap] ?? '') ?? gap;
    const columnGap =
      parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.columnGap] ?? '') ?? gap;
    root.setGap(Yoga.GUTTER_ROW, rowGap);
    root.setGap(Yoga.GUTTER_COLUMN, columnGap);

    const padding = parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.padding] ?? '') ?? 0;
    root.setPadding(
      Yoga.EDGE_TOP,
      parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.paddingTop] ?? '') ?? padding,
    );
    root.setPadding(
      Yoga.EDGE_RIGHT,
      parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.paddingRight] ?? '') ?? padding,
    );
    root.setPadding(
      Yoga.EDGE_BOTTOM,
      parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.paddingBottom] ?? '') ?? padding,
    );
    root.setPadding(
      Yoga.EDGE_LEFT,
      parseFiniteNumber(group.attributes[CONTAINER_LAYOUT_ATTRS.paddingLeft] ?? '') ?? padding,
    );

    for (const child of elementChildren) {
      if (isTextElement(child) && !runtime.measureContext.skipTextMeasurement) {
        normalizeTextElementContent(child);
      }

      const explicitWidth = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.width] ?? '');
      const explicitHeight = parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.height] ?? '');
      const needsIntrinsicText =
        isTextElement(child) &&
        !runtime.measureContext.skipTextMeasurement &&
        (explicitWidth === undefined || explicitHeight === undefined);

      if (needsIntrinsicText && runtime.measureContext.textMeasurer) {
        runtime.textMetricsByNode.set(child, runtime.measureContext.textMeasurer.measure(child));
      }

      const measured = measureNode(child, {
        textMeasurer: needsIntrinsicText ? runtime.measureContext.textMeasurer : undefined,
        skipTextMeasurement:
          runtime.measureContext.skipTextMeasurement ||
          (isTextElement(child) && !needsIntrinsicText),
      });
      measuredSizes.push(measured);
      const yogaChild = Yoga.Node.create();
      configureChild(yogaChild, child, measured, runtime);
      root.insertChild(yogaChild, yogaChildren.length);
      yogaChildren.push(yogaChild);
    }

    root.calculateLayout(container.width, container.height, Yoga.DIRECTION_LTR);

    for (let i = 0; i < elementChildren.length; i += 1) {
      const child = elementChildren[i];
      const yogaChild = yogaChildren[i];
      const measured = measuredSizes[i];
      if (!child || !yogaChild || !measured) {
        continue;
      }
      const layout = yogaChild.getComputedLayout();
      const finalMeasured =
        isTextElement(child) && runtime.textMetricsByNode.has(child)
          ? {
              width:
                parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.width] ?? '') ??
                runtime.textMetricsByNode.get(child)!.width,
              height:
                parseFiniteNumber(child.attributes[CHILD_LAYOUT_ATTRS.height] ?? '') ??
                runtime.textMetricsByNode.get(child)!.height,
            }
          : measured;
      applyLayoutToNode(
        child,
        layout.left,
        layout.top,
        layout.width,
        layout.height,
        finalMeasured,
        runtime.textMetricsByNode.get(child),
      );
    }
  } catch (error) {
    freeTree(root);
    if (error instanceof DsvgCompileError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DsvgCompileError([createError('LAYOUT_ERROR', `Yoga layout failed: ${message}`)]);
  }

  freeTree(root);
};

/**
 * Walks a tree deepest-first and applies flex layout to flex groups.
 * @param node - Current node.
 * @param fallback - Fallback container size for this subtree.
 * @param runtime - Shared layout runtime state.
 * @returns Nothing.
 */
const walkDeepestFirst = (node: DsvgNode, fallback: BoxSize, runtime: LayoutRuntime): void => {
  // Container fallback sizing ignores intrinsic text; fonts are only required for flex children.
  const measured = measureNode(node, { skipTextMeasurement: true });
  const childFallback = measured.width > 0 || measured.height > 0 ? measured : fallback;

  for (const child of node.children) {
    if (isElementChild(child)) {
      walkDeepestFirst(child, childFallback, runtime);
    }
  }

  if (isFlexGroup(node)) {
    applyFlexToGroup(node, fallback, runtime);
  }
};

/**
 * Resolves a text measurer from layout options when measurement is enabled.
 * Creation is deferred until intrinsic `<text>` sizing is actually needed.
 * @param options - Layout options.
 * @returns Lazy measurer getter, or undefined when skipping measurement.
 */
const resolveTextMeasurerFactory = (options: LayoutOptions): (() => TextMeasurer) | undefined => {
  if (!shouldMeasureTextWithFonts(options.textMeasurement)) {
    return undefined;
  }
  let cached: TextMeasurer | undefined;
  return () => {
    if (!cached) {
      cached = createFontMeasurer(options.fonts ?? []);
    }
    return cached;
  };
};

/**
 * Builds measure context that materializes the font measurer on demand.
 * @param getMeasurer - Lazy measurer factory.
 * @param skipTextMeasurement - Whether text measurement is disabled.
 * @returns Measure context for geometry helpers.
 */
const createMeasureContext = (
  getMeasurer: (() => TextMeasurer) | undefined,
  skipTextMeasurement: boolean,
): MeasureContext => {
  if (skipTextMeasurement || !getMeasurer) {
    return { skipTextMeasurement: true };
  }
  return {
    /**
     * Lazily constructs the OpenType measurer on first access.
     * @returns Font measurer instance.
     */
    get textMeasurer() {
      return getMeasurer();
    },
    skipTextMeasurement: false,
  };
};

/**
 * Applies Yoga flex layout across a DSVG document without mutating the input.
 * @param document - Source document.
 * @param options - Layout options including fonts and text measurement mode.
 * @returns Cloned document with layout applied.
 */
export const applyYogaLayout = (
  document: DsvgDocument,
  options: LayoutOptions = {},
): DsvgDocument => {
  const cloned = cloneDocument(document);
  const getMeasurer = resolveTextMeasurerFactory(options);
  const skipTextMeasurement = !shouldMeasureTextWithFonts(options.textMeasurement);
  const runtime: LayoutRuntime = {
    measureContext: createMeasureContext(getMeasurer, skipTextMeasurement),
    textMetricsByNode: new WeakMap(),
  };
  const fallback: BoxSize = {
    width: parseFiniteNumber(cloned.attributes.width ?? '') ?? 0,
    height: parseFiniteNumber(cloned.attributes.height ?? '') ?? 0,
  };
  walkDeepestFirst(cloned, fallback, runtime);
  return cloned;
};
