import { type FC } from "react";

import { AppBar, AppIconButton, BuildingIcon, LayerIcon, Space } from "../../ui-components";
// import { hideAppOverlayAtom } from "../states/app";

import { MainMenuButton } from "./MainMenuButton";
import { DatasetButton } from "./DatasetButton";
import { CompassBiasButton } from "./CompassBiasButton";
import { FovButton } from "./FovButton";
import { AltitudeBiasButton } from "./AltitudeBiasButton";

export const AppHeader: FC = () => {
  // const hidden = useAtomValue(hideAppOverlayAtom);
  // if (hidden) {
  //   return null;
  // }
  return (
    <AppBar>
      <MainMenuButton />
      <Space flexible />
      <DatasetButton />
      <AltitudeBiasButton />
      <CompassBiasButton />
      <FovButton />
    </AppBar>
  );
};
