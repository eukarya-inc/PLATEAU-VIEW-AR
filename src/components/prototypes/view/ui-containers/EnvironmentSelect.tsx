import { alpha, Button, Popover, styled } from "@mui/material";
import { useAtom, useAtomValue } from "jotai";
import { bindPopover, bindTrigger, usePopupState } from "material-ui-popup-state/hooks";
import { useCallback, useId, type FC } from "react";

import darkMapImage from "../../../prototypes/view/assets/dark_map.webp";
import elevationImage from "../../../prototypes/view/assets/elevation.webp";
import lightMapImage from "../../../prototypes/view/assets/light_map.webp";
import satelliteImage from "../../../prototypes/view/assets/satellite.webp";
import { shareableEnvironmentTypeAtom } from "../../../shared/states/scene";
import { colorMapTurbo } from "../../color-maps";
import { colorModeAtom } from "../../shared-states";
import {
  AppIconButton,
  FloatingPanel,
  MapIcon,
  OverlayPopper,
  ParameterList,
  QuantitativeColorLegend,
  SelectItem,
  SliderParameterItem,
  SwitchParameterItem,
  type SelectItemProps,
} from "../../ui-components";
import { logarithmicTerrainElevationAtom, terrainElevationHeightRangeAtom } from "../states/app";

const LegendButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 0,
  height: theme.spacing(5),
  padding: theme.spacing(2),
  paddingTop: theme.spacing(0.5),
  paddingBottom: 0,
}));

const StyledSelectItem = styled(SelectItem)(({ theme }) => ({
  padding: theme.spacing(1),
  "&:first-of-type": {
    marginTop: theme.spacing(1),
  },
  "&:last-of-type": {
    marginBottom: theme.spacing(1),
  },
})) as typeof SelectItem; // For generics

const Image = styled("div")(({ theme }) => ({
  overflow: "hidden",
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  "& img": {
    display: "block",
    width: theme.spacing(5),
    height: theme.spacing(5),
  },
  "&:after": {
    content: '""',
    display: "block",
    position: "absolute",
    inset: 0,
    boxShadow: `inset 0 0 0 1px ${alpha("#808080", 0.1)}`,
    borderRadius: theme.shape.borderRadius,
  },
}));

const Label = styled("div")(({ theme }) => ({
  ...theme.typography.body1,
  marginRight: theme.spacing(1),
  marginLeft: theme.spacing(1),
}));

const environmentItems = {
  "light-map": {
    image: lightMapImage,
    label: "白地図",
  },
  "dark-map": {
    image: darkMapImage,
    label: "黒地図",
  },
  satellite: {
    image: satelliteImage,
    label: "衛星写真",
  },
  elevation: {
    image: elevationImage,
    label: "標高",
  },
};

const Item: FC<
  SelectItemProps & {
    item: keyof typeof environmentItems;
    selectedItem?: keyof typeof environmentItems;
  }
> = ({ item, selectedItem, ...props }) => (
  <StyledSelectItem {...props} selected={item === selectedItem}>
    <Image>
      <img 
        src={environmentItems[item].image}
        alt={environmentItems[item].label}
        width="100%"
        height="100%"
      />
    </Image>
    <Label>{environmentItems[item].label}</Label>
  </StyledSelectItem>
);

const ElevationLegendButton: FC = () => {
  const elevationRange = useAtomValue(terrainElevationHeightRangeAtom);

  const id = useId();
  const popupState = usePopupState({
    variant: "popover",
    popupId: id,
  });

  return (
    <>
      <LegendButton variant="text" {...bindTrigger(popupState)}>
        <QuantitativeColorLegend
          min={elevationRange[0]}
          max={elevationRange[1]}
          colorMap={colorMapTurbo}
          unit="m"
          sx={{ width: 200 }}
        />
      </LegendButton>
      <Popover
        {...bindPopover(popupState)}
        anchorOrigin={{
          horizontal: "center",
          vertical: "bottom",
        }}
        transformOrigin={{
          horizontal: "center",
          vertical: "top",
        }}>
        <FloatingPanel>
          <ParameterList sx={{ width: 240, marginX: 2, marginY: 1 }}>
            <SliderParameterItem
              label="標高範囲"
              min={-10}
              max={4000}
              step={1}
              range
              unit="m"
              logarithmic
              atom={terrainElevationHeightRangeAtom}
            />
            <SwitchParameterItem label="対数スケール" atom={logarithmicTerrainElevationAtom} />
          </ParameterList>
        </FloatingPanel>
      </Popover>
    </>
  );
};

export const EnvironmentSelect: FC = () => {
  // FIXME
  const [environmentType, setEnvironmentType] = useAtom(shareableEnvironmentTypeAtom);
  const [colorMode, setColorMode] = useAtom(colorModeAtom);

  const id = useId();
  const popupState = usePopupState({
    variant: "popover",
    popupId: `${id}:menu`,
  });
  const popoverProps = bindPopover(popupState);
  const close = popupState.close;

  const handleLightMap = useCallback(() => {
    setEnvironmentType("map");
    setColorMode("light");
    close();
  }, [setEnvironmentType, setColorMode, close]);

  const handleDarkMap = useCallback(() => {
    setEnvironmentType("map");
    setColorMode("dark");
    close();
  }, [setEnvironmentType, setColorMode, close]);

  const handleSatellite = useCallback(() => {
    setEnvironmentType("satellite");
    setColorMode("light");
    close();
  }, [setEnvironmentType, setColorMode, close]);

  const handleElevation = useCallback(() => {
    setEnvironmentType("elevation");
    setColorMode("light");
    close();
  }, [setEnvironmentType, setColorMode, close]);

  const selectedItem =
    environmentType === "map" && colorMode === "light"
      ? "light-map"
      : environmentType === "map" && colorMode === "dark"
      ? "dark-map"
      : environmentType === "satellite"
      ? "satellite"
      : environmentType === "elevation"
      ? "elevation"
      : undefined;

  return (
    <>
      <AppIconButton
        title="地図"
        selected={popoverProps.open}
        disableTooltip={popoverProps.open}
        {...bindTrigger(popupState)}>
        <MapIcon />
      </AppIconButton>
      {selectedItem === "elevation" && <ElevationLegendButton />}
      <OverlayPopper {...popoverProps} inset={1.5}>
        <FloatingPanel>
          <Item item="light-map" selectedItem={selectedItem} onClick={handleLightMap} />
          <Item item="dark-map" selectedItem={selectedItem} onClick={handleDarkMap} />
          <Item item="satellite" selectedItem={selectedItem} onClick={handleSatellite} />
          <Item item="elevation" selectedItem={selectedItem} onClick={handleElevation} />
        </FloatingPanel>
      </OverlayPopper>
    </>
  );
};
