import { useAtomValue, useSetAtom } from "jotai";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { resetTileset, resetCzmlAsDatasource, resetGeojson } from "./ar";
import { layerSelectionAtom, LayersRenderer, useAddLayer } from "./components/prototypes/layers";
import { arStartedAtom, selectedTilesetsOrDatasourcesAtom } from "./components/prototypes/view/states/ar";
import { useDatasetsByIds } from "./components/shared/graphql";
import { Dataset, GenericDataset, PlateauDataset, PlateauDatasetItem } from "./components/shared/graphql/types/catalog";
import { rootLayersAtom } from "./components/shared/states/rootLayer";
import { settingsAtom } from "./components/shared/states/setting";
import { templatesAtom } from "./components/shared/states/template";
import { createRootLayerAtom } from "./components/shared/view-layers";
import { layerComponents } from "./components/shared/view-layers/layerComponents";
import { LoadedTileset } from "./components/shared/types";
import { CzmlDataSource, GeoJsonDataSource } from "cesium";

// クエパラとデータセットパネルの間の双方向同期ならびにタイルセット描画更新を行うためのヘッドレス(非表示)コンポーネント
export default function DatasetSyncer({...props}) {
  // クエパラ監視フック
  const [searchParams, setSearchParams] = useSearchParams();
  // クエパラで指定されたデータセットID群をStateで持ってuseDatasetsByIdsをトリガーする↓
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  // データセットID群をもとにカタログからデータセット群を取得 (↑datasetIdsが更新されればトリガー)
  const { data } = useDatasetsByIds(datasetIds);
  // useDatasetsByIdsから抽出したデータセット群
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  // ARで使用不可能なデータセットを弾いたデータセット群
  // クエパラを反映した初期化が完了するまではrootLayersによるフックを作動させないためのフラグとしても使用する
  // そのため敢えて配列で初期化せずにudefinedとなるようにしていることに注意
  const [filteredDatasets, setFilteredDatasets] = useState<Dataset[]>();
  // データセットパネルと同期されるレイヤー群とその関連フック
  const rootLayers = useAtomValue(rootLayersAtom);
  const addLayer = useAddLayer();
  const settings = useAtomValue(settingsAtom);
  const templates = useAtomValue(templatesAtom);
  // ARロジックが開始・準備完了しているか
  const arStarted = useAtomValue(arStartedAtom);

  const [tilesets, setTilesets] = useState<LoadedTileset[]>([]);

  type LoadedDatasourceInfo = {
      url: string;
      datasource: CzmlDataSource | GeoJsonDataSource;
  }
  const [loadedDatasourceInfos, setLoadedDatasourceInfos] = useState<LoadedDatasourceInfo[]>([]);

  const layersSelection = useAtomValue(layerSelectionAtom);
  const setSelectedTilesetsOrDatasources = useSetAtom(selectedTilesetsOrDatasourcesAtom);

  // authトークンをクエパラに付けて叩いていた場合はそれを保持
  const auth = searchParams.get("auth");

  // クエパラが変化したらデータセットID群を取得・保存して本コンポーネントを再レンダリング
  useEffect(() => {
    // クエパラはこんな感じで来る ?dataList=[{"datasetId":"d_13101_bldg","dataId":"di_13101_bldg_LOD1"}]
    // データセットIDのみ使用する。複数来る場合はこんな感じ ?dataList=[{"datasetId":"d_14136_bldg"},{"datasetId":"d_14135_bldg"}]
    const dataList = searchParams.get("dataList");
    try {
      if (!dataList) { throw "クエリパラメータが空です" }
      if (typeof dataList === 'string') {
        const evaled: any[] = eval(dataList);
        if (evaled) {
          const datasetIds = evaled.map(x => x.datasetId);
          console.log("New Dataset Ids: ", datasetIds);
          setDatasetIds(datasetIds);
        } else {
          throw "単一のパラメータが評価できません";
        }
      } else {
        throw "指定のキーを持つ単一のパラメータではありません";
      }
    } catch(e) {
      console.log("クエリパラメータが取得できません");
      console.log(e);
      setDatasetIds([]);
    }

    return () => {
      // setDatasetIds([]);
    };
  }, [searchParams]);

  // データセットID群が変化したらuseDatasetsByIdsを用いてカタログからデータセット群を取得・保存して本コンポーネントを再レンダリング
  useEffect(() => {
    // カタログからデータセット群を取得できていない間も何度かコールされるのでその間は何もしない
    if (!data || !data.nodes || !data.nodes.length) { return; }

    // データセット群を抽出
    // GenericDatasetでもPlateauDatasetでも通す
    const typedDatasets = data.nodes as Dataset[];
    console.log("New Datasets: ", typedDatasets);
    setDatasets(typedDatasets);
  
    return () => {
      // setDatasets([]);
    };
  }, [data]);

  // データセット群が変化したらARで使用可能なデータセットだけにフィルタ・保存して本コンポーネントを再レンダリング
  useEffect(() => {
    // TODO: ここでdatasetのTypeが対応していないものであればアラートポップアップを出し除外する
    const removedDatasets = datasets.filter(dataset => dataset.type.code !== 'bldg' && dataset.type.code !== 'usecase');
    const filteredDatasets = datasets.filter(dataset => dataset.type.code === 'bldg' || dataset.type.code === 'usecase');
  
    if (removedDatasets.length > 0) {
      const removedNames = removedDatasets.map(item => item.name).join(', ');
      console.log(`${removedNames} はAR非対応のため非表示になります。`); // 一旦ログでは出しておく
    }

    console.log("New Filterd Datasets: ", filteredDatasets);
    setFilteredDatasets(filteredDatasets);
  
    return () => {
      // setFilteredDatasets([]);
    };
  }, [datasets]);

  // フィルタ済データセット群が変化したらデータセットパネルに同期して本コンポーネントを再レンダリング
  useEffect(() => {
    // クエパラからのデータセット変換が完了するまではスルー
    if (!filteredDatasets) { return; }

    // 既にデータセットパネルで選択されているレイヤーは追加対象から除外
    const rootLayersDatasetIds = rootLayers.map(rootLayer => rootLayer.rawDataset.id);
    const uniqueDatasets = filteredDatasets.filter(dataset => !rootLayersDatasetIds.includes(dataset.id));

    uniqueDatasets.map(dataset => {
      const filteredSettings = settings.filter(s => s.datasetId === dataset.id);
      addLayer(
        // BuildingLayerやGeneralDatasetLayerを作成してレイヤー一覧に追加
        createRootLayerAtom({
          dataset,
          settings: filteredSettings,
          templates,
          areaCode: dataset.wardCode,
        }),
        { autoSelect: false },
      );
    });
  
    return () => {
      // setFilteredDatasets([]);
    };
  }, [filteredDatasets]);

  // フィルタ済データセット群が変化したらタイルセット描画をリセットして本コンポーネントを再レンダリング
  useEffect(() => {
    // クエパラからのデータセット変換が完了するまではスルー
    if (!filteredDatasets) { return; }

    const renderTilesets = async () => {
      // データセット群をタイルセットURL群に変換
      const resourceUrls: ({url: string, id: string, type: string} | {url: string, id: string, type: string}[])[] = await Promise.all(filteredDatasets.map(async plateauDataset => {
        const plateauDatasetItems = plateauDataset.items as PlateauDatasetItem[];
        // CESIUM3DTILESかどうかチェックしLOD2(テクスチャあり)->LOD2(テクスチャなし)->LOD1->テクスチャ・LODを持たないcsecase用3DTilesの順でフォールバック
        const cesium3dtilesItems = plateauDatasetItems.filter(item => item.format === "CESIUM3DTILES");
        console.log("Cesium3DTiles Items: ", cesium3dtilesItems);
        if (cesium3dtilesItems.length != 0) {
          const cesium3dtilesLod2TexItem = cesium3dtilesItems.find(({ lod, texture }) => lod == 2 && texture == "TEXTURE");
          if (cesium3dtilesLod2TexItem && cesium3dtilesLod2TexItem.url) {
            return {url: cesium3dtilesLod2TexItem.url, id: plateauDataset.id, type:"3dtiles"};
          } else {
            const cesium3dtilesLod2NoneTexItem = cesium3dtilesItems.find(({ lod, texture }) => lod == 2 && texture == "NONE");
            if (cesium3dtilesLod2NoneTexItem && cesium3dtilesLod2NoneTexItem.url) {
              return {url: cesium3dtilesLod2NoneTexItem.url, id: plateauDataset.id, type:"3dtiles"};
            } else {
              const cesium3dtilesLod1Item = cesium3dtilesItems.find(({ lod }) => lod == 1);
              if (cesium3dtilesLod1Item && cesium3dtilesLod1Item.url) {
                return {url: cesium3dtilesLod1Item.url, id: plateauDataset.id, type:"3dtiles"};
              } else {
                return cesium3dtilesItems.map(item => {
                  return {url: item.url, id: plateauDataset.id, type:"3dtiles"};
                });
              }
            }
          }
        } else {
          const czmlItems = plateauDatasetItems.filter(item => item.format === "CZML");
          // 一旦CZMLの場合はユースケースであると限定してitem数は1であるとする
          if (czmlItems.length == 1 && czmlItems[0]) {
            const czmlItem = czmlItems[0];
            // czmlからtilesetを取り出し
            const request = new Request(czmlItem.url);
            const response = await fetch(request);
            const czmlJson = await response.json();
            const tilesetPackets = czmlJson.map(packet => packet.tileset).filter(Boolean);
            const tilesetUrls = tilesetPackets.map(tilesetPacket => tilesetPacket.uri);
            // 便宜的に配列にしているのであとでflatしている
            tilesetUrls.map(tilesetUrl => {
              return {url: tilesetUrl, id: plateauDataset.id, type:"3dtiles"};
            });
          } else {
            return null;
          }
        }
      }).flat());

      var flattenedResourceUrls: {url: string, id: string, type: string}[];
      const nestedResourceUrls = resourceUrls as {url: string, id: string, type: string}[][];
      if (nestedResourceUrls.length) {
        flattenedResourceUrls = nestedResourceUrls.flat();
      } else {
        flattenedResourceUrls = resourceUrls as {url: string, id: string, type: string}[];
      }
      flattenedResourceUrls = flattenedResourceUrls.filter(x => x);
      console.log("tileset Resource URLs: ", flattenedResourceUrls);

      if (!resourceUrls || !arStarted) { return; }

      // tilesetをリセット
      const tilesetUrls = flattenedResourceUrls.filter(x => x.type == "3dtiles");
      resetTileset(tilesetUrls.map(t => t.url)).then((tilesets: LoadedTileset[]) => {
        setTilesets((prevTilesets) => {
          // 前回のtilesetsから今回removeされたtilesetsを除去して今回残ったtilesetだけを取り出す
          const filteredPrevTilesets = prevTilesets.filter(t => tilesetUrls.find(c => c.id === t.id));
          // 新規追加されたtilesetにidも付ける
          const nextTilesets = tilesets.map(t => ({ ...t, id: tilesetUrls.find(c => c.url === t.url).id }));
          // CZMLの場合もその内部から予めtileset群を取得してresetTilesetに渡してレンダリングする実装にしたので、LayersRendererに登録されるようになった。
          // 加えて、データセットパネルでユースケースのスタイルを操作した際に、それがLayersRendererに反応するようにするためにARではユースケースの場合もGeneralLayseではなくBuildingLayerにしている。
          const tilesetsForLayersRenderer = [...filteredPrevTilesets, ...nextTilesets];
          console.log("Tilesets for LayersRenderer: ", tilesetsForLayersRenderer);
          return tilesetsForLayersRenderer;
        });
      });
    }
    renderTilesets();

    // tilesetを持たないCZMLの場合はDataSourceとしてレンダリングする
    const renderCzmlAsDatasource = async () => {
      var resourceInfos = await Promise.all(filteredDatasets.map(async plateauDataset => {
        const plateauDatasetItems = plateauDataset.items as PlateauDatasetItem[];
        const czmlItems = plateauDatasetItems.filter(item => item.format === "CZML");
        // 一旦CZMLの場合はユースケースであると限定してitem数は1であるとする
        if (czmlItems.length == 1 && czmlItems[0]) {
          const czmlItem = czmlItems[0];
          const request = new Request(czmlItem.url);
          const response = await fetch(request);
          const czmlJson = await response.json();
          const tilesetPackets = czmlJson.map(packet => packet.tileset).filter(Boolean);
          // czmlがtilesetを持たなければそのままczmlとして保持
          if (!tilesetPackets.length) {
            return {url: czmlItem.url, id: plateauDataset.id, type:"czml"};
          } else {
            return null;
          }
        } else {
          return null;
        }
      }));
      resourceInfos = resourceInfos.filter(x => x);

      if (!resourceInfos || !arStarted) { return; }

      // czmlをリセット
      const czmlUrls = resourceInfos.filter(x => x.type == "czml").map(t => t.url);
      resetCzmlAsDatasource(czmlUrls).then((datasources: LoadedDatasourceInfo[]) => {
        setLoadedDatasourceInfos((prevDatasources) => {
          // 前回のdatasourcesから今回removeされたdatasourcesを除去して今回残ったdatasourceだけを取り出す
          const filteredPrevDatasources = prevDatasources.filter(d => czmlUrls.find(c => c === d.url));
          // 新規追加されたdatasourceにidも付ける
          const nextDatasources = datasources.map(d => ({ ...d, id: czmlUrls.find(c => c === d.url) }));
          const finalDatasources = [...filteredPrevDatasources, ...nextDatasources];
          // console.log("Final Datasources: ", finalDatasources);
          return finalDatasources;
        });
      });
    }
    renderCzmlAsDatasource();

    const renderGeojsons = async () => {
      // データセット群をGEOJSON URL群に変換
      var resourceInfos = await Promise.all(filteredDatasets.map(async plateauDataset => {
        const plateauDatasetItems = plateauDataset.items as PlateauDatasetItem[];
        const geojsonItems = plateauDatasetItems.filter(item => item.format === "GEOJSON");
        // 一旦GEOJSONの場合はユースケースであると限定してitem数は1であるとする
        if (geojsonItems.length == 1 && geojsonItems[0]) {
          const geojsonItem = geojsonItems[0];
          // GEOJSONのユースケースはitemのurlに直接.geojsonファイルが指定されているのでそのまま使う
          return {url: geojsonItem.url, id: plateauDataset.id, type:"geojson"};
        } else {
          return null;
        }
      }));
      resourceInfos = resourceInfos.filter(x => x);

      if (!resourceInfos || !arStarted) { return; }

      // geojsonをリセット
      const geojsonUrls = resourceInfos.filter(x => x.type == "geojson").map(t => t.url);
      resetGeojson(geojsonUrls).then((datasources: LoadedDatasourceInfo[]) => {
        setLoadedDatasourceInfos((prevDatasources) => {
          // 前回のdatasourcesから今回removeされたdatasourcesを除去して今回残ったdatasourceだけを取り出す
          const filteredPrevDatasources = prevDatasources.filter(d => geojsonUrls.find(c => c === d.url));
          // 新規追加されたdatasourceにidも付ける
          const nextDatasources = datasources.map(d => ({ ...d, id: geojsonUrls.find(c => c === d.url) }));
          return [...filteredPrevDatasources, ...nextDatasources];
        });
      });
    }
    renderGeojsons();

    return () => {
      // resetTileset([]);
    };
  }, [filteredDatasets]);

  // データセットパネルのレイヤー群が変化したらクエパラを更新して本コンポーネントを再レンダリング
  useEffect(() => {
    // クエパラからデータセット変換を行いデータセットパネル(rootLayers)へ反映するまでは、rootLayersに反応させたクエパラ変更を行わない
    // この回避を入れておかないと、クエパラ付きでアクセスしても初めはrootLayersが空であることから本後続処理にてクエパラがクリアされてしまう
    if (!filteredDatasets) { return; }

    // データセットパネルで何も選択されていない場合はクエパラをクリア
    if (!rootLayers.length) {
      setSearchParams(auth ? {auth: auth} : {});
      return;
    }

    // データセットパネルで何かしら選択されている場合はクエパラに反映
    const datasetIds = rootLayers.map(rootLayer => rootLayer.rawDataset.id);
    const objs = datasetIds.map(id => {
      const mapped = new Map([["datasetId", id]]);
      const obj = Object.fromEntries(mapped);
      return obj;
    });
    const datasetIdsObjsStr = JSON.stringify(objs);
    // authトークンをクエパラに付けて叩いていた場合はそれを保存しておいてこちらで再レンダリング時にも付け直す
    setSearchParams(auth ? {dataList: datasetIdsObjsStr, auth: auth} : {dataList: datasetIdsObjsStr});

    return () => {
      // setSearchParams({});
    };
  }, [rootLayers]);

  // データセットパネルで選択されたレイヤーに対応するタイルセットを取得して本コンポーネントを再レンダリング (レイヤーコンテンツパネルの移動ボタンで使用)
  useEffect(() => {
    console.log("Layers Selection: ", layersSelection);
    const seleectedRootLayers = rootLayers.filter(rootLayer => layersSelection.map(layer => layer.id).includes(rootLayer.id));
    console.log("Selected Root Layers: ", seleectedRootLayers);
    // const selectedDatasetItemIds = seleectedRootLayers?.map(rootLayer => rootLayer.rawDataset.items.map(item => item.id)).flat();
    // console.log("Selected Dataset Item Ids: ", selectedDatasetItemIds);
    // const selectedDatasetIds = seleectedRootLayers?.map(rootLayer => rootLayer.rawDataset.id);
    // console.log("Selected Dataset Ids: ", selectedDatasetIds);
    const selectedDatasetItemUrls = seleectedRootLayers?.map(rootLayer => rootLayer.rawDataset.items.map(item => item.url)).flat();
    console.log("Selected Dataset Item Urls: ", selectedDatasetItemUrls);
  
    const selectedTilesets = tilesets.filter(tileset => selectedDatasetItemUrls.includes(tileset.url));
    console.log("Loaded Tileset Urls: ", tilesets.map(tileset => tileset.url));
    console.log("Selected Tilesets: ", selectedTilesets);
    const selectedDatasourceInfos = loadedDatasourceInfos.filter(datasource => selectedDatasetItemUrls.includes(datasource.url));
    console.log("Loaded Datasource Urls: ", loadedDatasourceInfos.map(datasource => datasource.url));
    console.log("Selected Datasource Infos: ", selectedDatasourceInfos);

    if (!selectedTilesets.length && !selectedDatasourceInfos.length) { return; }
    const primitives = selectedTilesets.map(tileset => tileset.primitive);
    console.log("Selected Tileset Primitives: ", primitives);
    const datasources = selectedDatasourceInfos.map(datasource => datasource.datasource);
    console.log("Selected Datasources: ", datasources);
    setSelectedTilesetsOrDatasources([...primitives, ...datasources]);

    return () => {};
  }, [layersSelection]);

  return (
    <div id="dataset_syncer" {...props}>
      <LayersRenderer tilesets={tilesets} components={layerComponents} />
    </div>
  )
}