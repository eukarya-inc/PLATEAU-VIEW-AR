import { atom } from "jotai";
import { groupBy } from "lodash";

import { rootLayersAtom, rootLayersLayersAtom } from "../../../shared/states/rootLayer";
import { layerSelectionAtom, type LayerModel, type LayerType } from "../../layers";
import {
  screenSpaceSelectionAtom,
  type ScreenSpaceSelectionEntry,
  type ScreenSpaceSelectionType,
} from "../../screen-space-selection";
import { isNotNullish } from "../../type-helpers";
import { colorSchemeSelectionAtom, imageSchemeSelectionAtom } from "../../view-layers";

// Layer selection
export const LAYER_SELECTION = "LAYER_SELECTION";
export const SCREEN_SPACE_SELECTION = "SCREEN_SPACE_SELECTION";
export const COLOR_SCHEME_SELECTION = "COLOR_SCHEME_SELECTION";
export const IMAGE_SCHEME_SELECTION = "IMAGE_SCHEME_SELECTION";

interface LayerSelection {
  type: typeof LAYER_SELECTION;
  value: LayerModel;
}

// TODO(ReEarth): Support selecting multiple features.
interface ScreenSpaceSelection {
  type: typeof SCREEN_SPACE_SELECTION;
  value: ScreenSpaceSelectionEntry;
}

interface ColorSchemeSelection {
  type: typeof COLOR_SCHEME_SELECTION;
  value: LayerModel;
}

interface ImageSchemeSelection {
  type: typeof IMAGE_SCHEME_SELECTION;
  value: LayerModel;
}

export type Selection =
  | LayerSelection
  | ScreenSpaceSelection
  | ColorSchemeSelection
  | ImageSchemeSelection;

export type SelectionType = Selection["type"];

// 選択中の対象を保持するAtom
// useSearchOptionsでセットされるscreenSpaceSelectionAtomを取得している。
// selectionGroupsAtomを経由して、SelectionPanelにおいて表示内容として使用されている
export const selectionAtom = atom((get): Selection[] => [
  ...get(layerSelectionAtom)
    .map(({ id }): LayerSelection | undefined => {
      const layer = get(rootLayersAtom).find(l => get(get(l.rootLayerAtom).layer).id === id);
      if (layer == null) {
        console.warn(`Layer does not exit: ${id}`);
      }
      return layer != null
        ? {
            type: LAYER_SELECTION,
            value: get(get(layer.rootLayerAtom).layer),
          }
        : undefined;
    })
    .filter(isNotNullish),
  ...get(screenSpaceSelectionAtom).map(
    (value): ScreenSpaceSelection => ({
      type: SCREEN_SPACE_SELECTION,
      value,
    }),
  ),
  ...get(colorSchemeSelectionAtom)
    .map((id): ColorSchemeSelection | undefined => {
      const layer = get(rootLayersLayersAtom).find(layer => layer.id === id);
      if (layer == null) {
        console.warn(`Layer does not exit: ${id}`);
      }
      return layer != null
        ? {
            type: COLOR_SCHEME_SELECTION,
            value: layer,
          }
        : undefined;
    })
    .filter(isNotNullish),
  ...get(imageSchemeSelectionAtom)
    .map((id): ImageSchemeSelection | undefined => {
      const layer = get(rootLayersLayersAtom).find(layer => layer.id === id);
      if (layer == null) {
        console.warn(`Layer does not exit: ${id}`);
      }
      return layer != null
        ? {
            type: IMAGE_SCHEME_SELECTION,
            value: layer,
          }
        : undefined;
    })
    .filter(isNotNullish),
]);

type LayerSelectionGroup = {
  type: typeof LAYER_SELECTION;
} & {
  [K in LayerType]: {
    subtype: K;
    values: Array<LayerModel<K>>;
  };
}[LayerType];

type ScreenSpaceSelectionGroup = {
  type: typeof SCREEN_SPACE_SELECTION;
} & {
  [K in ScreenSpaceSelectionType]: {
    subtype: K;
    values: Array<ScreenSpaceSelectionEntry<K>["value"]>;
  };
}[ScreenSpaceSelectionType];

type ColorSchemeSelectionGroup = {
  type: typeof COLOR_SCHEME_SELECTION;
} & {
  [K in LayerType]: {
    subtype: K;
    values: Array<LayerModel<K>>;
  };
}[LayerType];

type ImageSchemeSelectionGroup = {
  type: typeof IMAGE_SCHEME_SELECTION;
} & {
  [K in LayerType]: {
    subtype: K;
    values: Array<LayerModel<K>>;
  };
}[LayerType];

export type SelectionGroup =
  | LayerSelectionGroup
  | ScreenSpaceSelectionGroup
  | ColorSchemeSelectionGroup
  | ImageSchemeSelectionGroup;

// 選択中の対象をグループ分けして保持するAtom
// SelectionPanelで表示内容として使用される
export const selectionGroupsAtom = atom<SelectionGroup[]>(get => {
  const groups = Object.entries(groupBy(get(selectionAtom), "type")) as unknown as Array<
    {
      [K in SelectionType]: [K, Array<Selection & { type: K }>];
    }[SelectionType]
  >;
  return groups.flatMap(([type, values]) => {
    switch (type) {
      case LAYER_SELECTION:
        return Object.entries(
          groupBy(
            values.map(({ value }) => value),
            "type",
          ),
        ).map(([subtype, values]) => ({
          type,
          subtype,
          values,
        })) as unknown as SelectionGroup[];
      case SCREEN_SPACE_SELECTION: {
        return Object.entries(
          groupBy(
            values.map(({ value }) => value),
            "type",
          ),
        ).map(([subtype, values]) => ({
          type,
          subtype,
          values: values.map(({ value }) => value),
        })) as unknown as SelectionGroup[];
      }
      case COLOR_SCHEME_SELECTION: {
        return Object.entries(
          groupBy(
            values.map(({ value }) => value),
            "type",
          ),
        ).map(([subtype, values]) => ({
          type,
          subtype,
          values,
        })) as unknown as SelectionGroup[];
      }
      case IMAGE_SCHEME_SELECTION: {
        return Object.entries(
          groupBy(
            values.map(({ value }) => value),
            "type",
          ),
        ).map(([subtype, values]) => ({
          type,
          subtype,
          values,
        })) as unknown as SelectionGroup[];
      }
    }
    return [];
  });
});
