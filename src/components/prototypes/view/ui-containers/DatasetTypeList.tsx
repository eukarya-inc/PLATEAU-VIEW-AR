import { useAtom, useAtomValue } from "jotai";
import { atomWithReset } from "jotai/utils";
import { useCallback, type FC, useContext, useMemo } from "react";

import { useAreaDatasets, useAreas, useDatasets } from "../../../shared/graphql";
import { AreasQuery } from "../../../shared/graphql/types/catalog";
import { AppOverlayLayoutContext, DatasetTreeItem, DatasetTreeView } from "../../ui-components";
import { datasetTypeNames } from "../constants/datasetTypeNames";
import { datasetTypeOrder } from "../constants/datasetTypeOrder";
import { PlateauDatasetType } from "../constants/plateau";

import { DatasetListItem, joinPath } from "./DatasetListItem";

const expandedAtom = atomWithReset<string[]>([]);

const MunicipalityItem: FC<{
  datasetType: PlateauDatasetType;
  municipality: AreasQuery["areas"][number];
  parents?: string[];
}> = ({ datasetType, municipality, parents = [] }) => {
  const query = useAreaDatasets(municipality.code, {
    includeTypes: [datasetType],
  });
  if (query.data?.area?.datasets.length === 1) {
    return (
      <DatasetListItem
        dataset={query.data.area.datasets[0]}
        municipalityCode={municipality.code}
        label={joinPath([...parents, municipality.name])}
      />
    );
  }
  return (
    <DatasetTreeItem
      nodeId={`${datasetType}:${municipality.id}`}
      label={joinPath([...parents, municipality.name])}
      loading={query.loading}>
      {query.data?.area?.datasets?.map(dataset => (
        <DatasetListItem
          key={dataset.id}
          municipalityCode={municipality.code}
          dataset={dataset}
          label={dataset.name}
        />
      ))}
    </DatasetTreeItem>
  );
};

const GlobalItem: FC<{}> = () => {
  const query = useDatasets({
    includeTypes: ["global"],
  });
  return (
    <DatasetTreeItem nodeId="global" label={datasetTypeNames.global} loading={query.loading}>
      {query.data?.datasets?.map(dataset => (
        <DatasetListItem
          key={dataset.id}
          dataset={dataset}
          municipalityCode={dataset.wardCode ?? dataset.cityCode ?? dataset.prefectureCode}
          label={dataset.name}
        />
      ))}
    </DatasetTreeItem>
  );
};

const PrefectureItem: FC<{
  datasetType: PlateauDatasetType;
  prefecture: AreasQuery["areas"][number];
}> = ({ prefecture, datasetType }) => {
  const query = useAreas({
    parentCode: prefecture.code,
    datasetTypes: [datasetType],
  });
  const areas = useMemo(() => query.data?.areas.filter(a => a.code.length !== 2) ?? [], [query]);
  if (areas.length === 1) {
    return (
      <MunicipalityItem
        datasetType={datasetType}
        municipality={query.data.areas[0]}
        parents={[prefecture.name]}
      />
    );
  }
  return (
    <DatasetTreeItem
      nodeId={`${datasetType}:${prefecture.code}`}
      label={prefecture.name}
      loading={query.loading}>
      {areas.map(municipality => (
        <MunicipalityItem
          key={municipality.code}
          datasetType={datasetType}
          municipality={municipality}
        />
      ))}
    </DatasetTreeItem>
  );
};

const DatasetTypeItem: FC<{ datasetType: PlateauDatasetType }> = ({ datasetType }) => {
  const query = useAreas({
    datasetTypes: [datasetType],
  });
  // TODO: 対応地物が増えればここを増やして対応。なおなぜか今も建築物モデルはどの都道府県も表示されない
  // 現在は建築物とユースケースだけ表示を許可している
  if(datasetType !== PlateauDatasetType.Building && datasetType !== PlateauDatasetType.UseCase) return;
  return (
    <DatasetTreeItem
      nodeId={datasetType}
      label={datasetTypeNames[datasetType]}
      loading={query.loading}>
      {/* {datasetType === PlateauDatasetType.UseCase && <GlobalItem />} */}
      {query.data?.areas.map(
        prefecture =>
          prefecture.__typename === "Prefecture" && (
            <PrefectureItem
              key={prefecture.code}
              datasetType={datasetType}
              prefecture={prefecture}
            />
          ),
      )}
    </DatasetTreeItem>
  );
};

// カテゴリータブを選択した際のリスト
export const DatasetTypeList: FC = () => {
  const [expanded, setExpanded] = useAtom(expandedAtom);
  const handleNodeToggle = useCallback(
    (_event: unknown, nodeIds: string[]) => {
      setExpanded(nodeIds);
    },
    [setExpanded],
  );

  const { gridHeightAtom, searchHeaderHeight } = useContext(AppOverlayLayoutContext);
  const gridHeight = useAtomValue(gridHeightAtom);

  return (
    <DatasetTreeView
      expanded={expanded}
      onNodeToggle={handleNodeToggle}
      maxheight={gridHeight - searchHeaderHeight}>
      {datasetTypeOrder.map(datasetType => (
        <DatasetTypeItem key={datasetType} datasetType={datasetType} />
      ))}
    </DatasetTreeView>
  );
};
