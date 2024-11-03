import { useEffect, useState } from "react";
import {
  checkPermissions,
  requestPermissions,
  watchPosition,
} from "@tauri-apps/plugin-geolocation";
import { info } from "@tauri-apps/plugin-log";
import {
  readTextFile,
  writeTextFile,
  BaseDirectory,
  exists,
  create,
} from "@tauri-apps/plugin-fs";
import Switch from "react-switch";
import { CopyBlock, github } from "react-code-blocks";
import { differenceInSeconds } from "date-fns";
import distance from "@turf/distance";
import { point } from "@turf/helpers";
import L, { Map } from "leaflet";
import {
  MapContainer,
  TileLayer,
  useMap,
  Polyline,
  Circle,
  Popup,
} from "react-leaflet";
import "leaflet.offline";
import "leaflet/dist/leaflet.css";
import "./App.css";

// 異動の集合としての旅行
type travel = {
  // uuid
  id: string;
  name: string;
  description: string;
  move_id_list: string[];
};

// 位置の集合としての移動
type move = {
  id: string;
  start: Date;
  end: Date;
};

type nowRecordingMoveInfo = {
  id: string;
  start: Date;
};

// 位置
type geolocation = {
  timestamp: Date;
  // 緯度
  latitude: number;
  // 経度
  longitude: number;
  // 高度
  altitude: number | null;
  // 高精度な高度
  altitudeAccuracy: number | null;
  // 速度
  speed: number | null;
  // ユーザーが向いている向き
  heading: number | null;
};

type allDataType = {
  version: string;
  nowRecordingMoveInfo: nowRecordingMoveInfo | null;
  travel: travel[];
  move: move[];
  geolocation: geolocation[];
};

// 地図に表示する移動の情報
type mapMoveInfo = {
  moveInfo: move;
  geolocationList: geolocation[];
  maxSpeed: number | null;
  averageSpeed: number | null;
  distanceSumMeters: number;
  moveSeconds: number;
};

// モード選択
type mode = "recordMove" | "createTravel" | "showMap" | "fetchData";

function App() {
  const version = "0.1.0";

  const [nowMode, setNowMode] = useState<mode>("recordMove");

  const [travelList, setTravelList] = useState<travel[]>([]);
  const [moveList, setMoveList] = useState<move[]>([]);
  const [geolocationList, setGeolocationList] = useState<geolocation[]>([]);

  // 移動を開始した時の情報の記録
  const [recordingMoveInfo, setRecordingMoveInfo] =
    useState<nowRecordingMoveInfo | null>(null);

  const [allData, setAllData] = useState<allDataType>({
    version,
    nowRecordingMoveInfo: null,
    travel: [],
    move: [],
    geolocation: [],
  });

  // 記録の開始に関わる変数
  const [nowTravelId, setNowTravelId] = useState<string | null>(null);
  const [isRecordMove, setIsRecordMove] = useState<boolean>(false);

  const [isDataFetch, setIsDataFetch] = useState<"import" | "export" | "hide">(
    "hide",
  );
  const [importDataText, setImportDataText] = useState("");

  const travelListFilePath = "travelList.json";
  const moveListFilePath = "moveList.json";
  const geolocationListFilePath = "geolocationList.json";
  const recordingMoveInfoFilePath = "recordingMoveInfo.json";

  useEffect(() => {
    (async () => {
      const existsTravelListFile = await exists(travelListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      if (existsTravelListFile) {
        info(`exists: travelListFilePath`);
        const travelListFileText = await readTextFile(travelListFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        setTravelList(JSON.parse(travelListFileText));
        info("read travelList");
      } else {
        info("not exists: travelListFilePath");
        const file = await create(travelListFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create travelList");
      }

      const existsMoveListFile = await exists(moveListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      if (existsMoveListFile) {
        info(`exists: moveListFilePath`);
        const moveListFileText = await readTextFile(moveListFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        setMoveList(JSON.parse(moveListFileText));
        info("read moveList");
      } else {
        info(`not exists: moveListFilePath`);
        const file = await create(moveListFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create moveList");
      }

      const existsGeolocationListFile = await exists(geolocationListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      if (existsGeolocationListFile) {
        info(`exists: geolocationListFilePath`);
        const geolocationListFileText = await readTextFile(
          geolocationListFilePath,
          { baseDir: BaseDirectory.AppLocalData },
        );
        setGeolocationList(JSON.parse(geolocationListFileText));
      } else {
        info(`not exists: geolocationListFilePath`);
        const file = await create(geolocationListFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create geolocationList");
      }

      const existsRecordingMoveInfoFile = await exists(
        recordingMoveInfoFilePath,
        { baseDir: BaseDirectory.AppLocalData },
      );
      if (existsRecordingMoveInfoFile) {
        info(`exists: recordingMoveInfoFilePath`);
        const recordingMoveInfoFileText = await readTextFile(
          recordingMoveInfoFilePath,
          { baseDir: BaseDirectory.AppLocalData },
        );
        setRecordingMoveInfo(JSON.parse(recordingMoveInfoFileText));
        if (recordingMoveInfo) {
          setIsRecordMove(true);
        }
      } else {
        info(`not exists: recordingMoveInfoFilePath`);
        const file = await create(recordingMoveInfoFilePath, {
          baseDir: BaseDirectory.AppLocalData,
        });
        await file.write(new TextEncoder().encode("null"));
        await file.close();
        info("create recordingMoveInfo");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const isTravelListFileOnAppLocalDataDir = await exists(
        travelListFilePath,
        { baseDir: BaseDirectory.AppLocalData },
      );
      info(
        `isTravelListFileOnAppLocalDataDir: ${isTravelListFileOnAppLocalDataDir}`,
      );

      const nowText = await readTextFile(travelListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      const data: travel[] = JSON.parse(nowText);
      if (data.length < travelList.length) {
        await writeTextFile(travelListFilePath, JSON.stringify(travelList), {
          baseDir: BaseDirectory.AppLocalData,
        });
        info("write travelList");
      }
    })();
  }, [travelList]);

  useEffect(() => {
    (async () => {
      const isMoveListFileOnAppLocalDataDir = await exists(moveListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      info(
        `isMoveListFileOnAppLocalDataDir: ${isMoveListFileOnAppLocalDataDir}`,
      );

      const nowText = await readTextFile(moveListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      const data: move[] = JSON.parse(nowText);
      if (data.length < moveList.length) {
        await writeTextFile(moveListFilePath, JSON.stringify(moveList), {
          baseDir: BaseDirectory.AppLocalData,
        });
        info("write moveList");
      }
    })();
  }, [moveList]);

  useEffect(() => {
    (async () => {
      const isGeolocationListFileOnAppLocalDataDir = await exists(
        geolocationListFilePath,
        { baseDir: BaseDirectory.AppLocalData },
      );
      info(
        `isGelocationListFileOnAppLocalDataDir: ${isGeolocationListFileOnAppLocalDataDir}`,
      );

      const nowText = await readTextFile(geolocationListFilePath, {
        baseDir: BaseDirectory.AppLocalData,
      });
      const data: move[] = JSON.parse(nowText);
      if (data.length < geolocationList.length) {
        await writeTextFile(
          geolocationListFilePath,
          JSON.stringify(geolocationList),
          { baseDir: BaseDirectory.AppLocalData },
        );
        info("write geolocationList");
      }
    })();
  }, [geolocationList]);

  useEffect(() => {
    (async () => {
      const isrecordingMoveInfoFileOnAppLocalDataDir = await exists(
        recordingMoveInfoFilePath,
        { baseDir: BaseDirectory.AppLocalData },
      );
      info(
        `recordingMoveInfoFileOnAppLocalDataDir: ${isrecordingMoveInfoFileOnAppLocalDataDir}`,
      );

      if (isrecordingMoveInfoFileOnAppLocalDataDir) {
        await writeTextFile(
          recordingMoveInfoFilePath,
          JSON.stringify(recordingMoveInfo),
          { baseDir: BaseDirectory.AppLocalData },
        );
        info("write recordingMoveInfo");
      }
    })();
  }, [recordingMoveInfo]);

  useEffect(() => {
    setAllData({
      version,
      nowRecordingMoveInfo: recordingMoveInfo,
      travel: travelList,
      move: moveList,
      geolocation: geolocationList,
    });
  }, [travelList, moveList, geolocationList, recordingMoveInfo]);

  const [inputNewTravelName, setInputNewTravelName] = useState("");
  const [inputNewTravelDescription, setInputNewTravelDescription] =
    useState("");

  async function createNewTravel() {
    if (inputNewTravelName != "") {
      const id = self.crypto.randomUUID().toString();
      const newTravel = {
        id,
        name: inputNewTravelName,
        description: inputNewTravelDescription,
        move_id_list: [],
      };
      setTravelList([newTravel, ...travelList]);
      setInputNewTravelName("");
      setInputNewTravelDescription("");
    }
  }

  useEffect(() => {
    const now = new Date();
    if (isRecordMove && nowTravelId) {
      // 移動の記録の開始
      const newMoveId = crypto.randomUUID().toString();
      setRecordingMoveInfo({ start: now, id: newMoveId });
    }
    if (!isRecordMove && nowTravelId && recordingMoveInfo) {
      // 移動の記録の終了
      const move: move = {
        id: recordingMoveInfo.id,
        start: recordingMoveInfo.start,
        end: now,
      };
      setMoveList([...moveList, move]);
      setTravelList(
        travelList.map((value) =>
          value.id == nowTravelId
            ? {
                ...value,
                move_id_list: [...value.move_id_list, recordingMoveInfo.id],
              }
            : value,
        ),
      );
      setRecordingMoveInfo(null);
    }
  }, [isRecordMove]);

  const [nowGeolocation, setNowGeolocation] = useState<geolocation | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      let permissions = await checkPermissions();
      if (
        permissions.location === "prompt" ||
        permissions.location === "prompt-with-rationale"
      ) {
        permissions = await requestPermissions(["location"]);
      }

      if (permissions.location === "granted") {
        await watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (pos) => {
            if (pos) {
              info("watchPosition success");
              const geo: geolocation = {
                timestamp: new Date(pos.timestamp),
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
              };
              setNowGeolocation(geo);
            } else {
              info("error: watchPosition failed");
            }
          },
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (nowGeolocation && isRecordMove) {
      setGeolocationList([...geolocationList, nowGeolocation]);
    }
  }, [nowGeolocation]);

  const [map, _setMap] = useState<Map | undefined>();
  const defaultPosX = 35.68815;
  const defaultPoxY = 139.699892;

  const [showMapId, setShowMapId] = useState("here");
  const [mapMoveList, setMapMoveList] = useState<mapMoveInfo[]>([]);

  const [isSetMapCenter, setIsSetMapCenter] = useState<boolean>(false);

  // 移動の記録を再生するかどうかのフラグ
  const [isPlayMove, setIsPlayMove] = useState<boolean>(false);

  // 現在位置に移動速度などを表示するかどうかのフラグ
  const [isNowPosPopup, setIsNowPosPopup] = useState(false);

  // m/s -> km/h
  function convertSpeed(speed: number): number {
    return speed * 3.6;
  }

  // 方角の値から向きを出す関数
  function headingValueToDirection(heading: number): string {
    if ((0 <= heading && heading < 22.5) || 337.5 <= heading) {
      return "北";
    } else if (22.5 <= heading && heading < 67.5) {
      return "北東";
    } else if (67.5 <= heading && heading < 112.5) {
      return "東";
    } else if (112.5 <= heading && heading < 157.5) {
      return "南東";
    } else if (157.5 <= heading && heading < 202.5) {
      return "南";
    } else if (202.5 <= heading && heading < 247.5) {
      return "南西";
    } else if (247.5 <= heading && heading < 292.5) {
      return "西";
    } else if (292.5 <= heading && heading < 337.5) {
      return "北西";
    } else {
      return "";
    }
  }

  // 選択された旅行に含まれる移動のリストを作成する
  useEffect(() => {
    const targetTravelId = showMapId == "here" ? nowTravelId : showMapId;
    const travelInfo = travelList.find((value) => value.id == targetTravelId);
    if (travelInfo) {
      const targetMoveList = moveList.filter((value) =>
        travelInfo.move_id_list.includes(value.id),
      );
      const targetGeoList = targetMoveList.map((moveInfo) => {
        const lst = geolocationList.filter(
          (geo) =>
            moveInfo.start <= geo.timestamp && geo.timestamp <= moveInfo.end,
        );
        let maxSpeed: number | null = null;
        let tempX = 0;
        let tempY = 0;
        let distanceSumMeters = 0;
        for (let i = 0; i < lst.length; i++) {
          const value = lst[i];
          if (value.speed) {
            if (maxSpeed) {
              if (maxSpeed < value.speed) {
                maxSpeed = value.speed;
              }
            } else {
              maxSpeed = value.speed;
            }
          }

          if (i == 0) {
            tempX = value.latitude;
            tempY = value.longitude;
          }
          if (i != 0) {
            const x = value.latitude;
            const y = value.longitude;
            const d = distance(point([y, x]), point([tempY, tempX]), {
              units: "meters",
            });
            distanceSumMeters += d;
            tempX = x;
            tempY = y;
          }
        }
        info(`distnceSum: ${distanceSumMeters}`);
        const data: mapMoveInfo = {
          moveInfo,
          geolocationList: lst,
          maxSpeed,
          averageSpeed: null,
          distanceSumMeters,
          moveSeconds: differenceInSeconds(moveInfo.end, moveInfo.start),
        };
        return data;
      });
      setMapMoveList(targetGeoList);
    } else {
      setMapMoveList([]);
    }
  }, [showMapId]);

  // 情報を見たい移動のIDとクリックした位置
  const [showMoveInfo, setShowMoveInfo] = useState<mapMoveInfo | null>(null);
  const [showMoveInfoClickPosX, setShowMoveInfoClickPosX] = useState(0);
  const [showMoveInfoClickPosY, setShowMoveInfoClickPosY] = useState(0);

  useEffect(() => {
    if (map) {
      // @ts-ignore
      const tileLayerOffline = L.tileLayer.offline(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        },
      );

      tileLayerOffline.addTo(map);

      // @ts-ignore
      const controlSaveTiles = L.control.savetiles(tileLayerOffline);

      controlSaveTiles.addTo(map!);
    }
  }, [map]);

  function ChangeView() {
    if (isSetMapCenter) {
      const nowMap = useMap();
      if (nowGeolocation) {
        nowMap.setView([nowGeolocation.latitude, nowGeolocation.longitude]);
        nowMap.setZoom(14);
      } else {
        nowMap.setView([defaultPosX, defaultPoxY]);
        nowMap.setZoom(14);
      }
      setIsSetMapCenter(false);
    }
    if (isPlayMove) {
      const nowMap = useMap();
      if (showMapId != "here" && moveList.length > 0) {
        if (mapMoveList[0].geolocationList.length > 0) {
          nowMap.setView([
            mapMoveList[0].geolocationList[0].latitude,
            mapMoveList[0].geolocationList[0].longitude,
          ]);
          nowMap.setZoom(14);
        } else {
          nowMap.setView([defaultPosX, defaultPoxY]);
          nowMap.setZoom(14);
        }
      } else {
        nowMap.setView([defaultPosX, defaultPoxY]);
        nowMap.setZoom(14);
      }
      setIsPlayMove(false);
    }
    return null;
  }

  return (
    <div className="container">
      <p>
        <button onClick={() => setNowMode("recordMove")}>記録</button>
        <button onClick={() => setNowMode("showMap")}>地図</button>
        <button onClick={() => setNowMode("createTravel")}>作成</button>
        <button onClick={() => setNowMode("fetchData")}>DB</button>
      </p>
      {nowMode == "createTravel" ? (
        <>
          <h3>旅行名</h3>
          <p>
            <input
              value={inputNewTravelName}
              name="createTravelName"
              onChange={(event) => setInputNewTravelName(event.target.value)}
            />
          </p>
          <p>説明</p>
          <textarea
            value={inputNewTravelDescription}
            name="createTravelDescription"
            onChange={(event) =>
              setInputNewTravelDescription(event.target.value)
            }
          />
          <div>
            <button onClick={createNewTravel}>作成</button>
          </div>
        </>
      ) : nowMode == "fetchData" ? (
        <>
          <p>
            移動の記録中はデータベースの更新はできません。
            <Switch
              onChange={(checked) => {
                setIsRecordMove(checked);
              }}
              disabled={!isRecordMove}
              checked={isRecordMove}
            />
          </p>
          <div>
            <button
              onClick={() => setIsDataFetch("export")}
              disabled={isRecordMove}
            >
              現在のデータを表示する
            </button>
            <button
              onClick={() => setIsDataFetch("import")}
              disabled={isRecordMove}
            >
              データを取り込む
            </button>
            <button onClick={() => setIsDataFetch("hide")}>隠す</button>
          </div>
          {isDataFetch == "export" ? (
            <CopyBlock
              text={JSON.stringify(allData, null, 2)}
              language="json"
              theme={github}
              showLineNumbers={false}
            />
          ) : isDataFetch == "import" ? (
            <div>
              <div>
                <button
                  onClick={async () => {
                    const importData: allDataType = JSON.parse(importDataText);
                    if (importData) {
                      setTravelList(importData.travel);
                      await writeTextFile(
                        travelListFilePath,
                        JSON.stringify(importData.travel),
                        { baseDir: BaseDirectory.AppLocalData },
                      );
                      info("write travelList");
                      setMoveList(importData.move);
                      await writeTextFile(
                        moveListFilePath,
                        JSON.stringify(importData.move),
                        { baseDir: BaseDirectory.AppLocalData },
                      );
                      info("write moveList");
                      setGeolocationList(importData.geolocation);
                      await writeTextFile(
                        geolocationListFilePath,
                        JSON.stringify(importData.geolocation),
                        { baseDir: BaseDirectory.AppLocalData },
                      );
                      info("write geolocationList");
                    }
                  }}
                  disabled={isRecordMove}
                >
                  取り込む
                </button>
              </div>
              <textarea
                value={importDataText}
                name="importDataTextEdit"
                id="importDataTextEdit"
                onChange={(event) => setImportDataText(event.target.value)}
              />
            </div>
          ) : null}
        </>
      ) : nowMode == "showMap" ? (
        <>
          {isRecordMove ? <p>移動中は現在位置の表示のみできます。</p> : null}
          <select
            name="showMapId"
            id="showMapId"
            value={showMapId}
            onChange={(event) => {
              setShowMoveInfo(null);
              setShowMapId(event.target.value);
            }}
            disabled={isRecordMove}
          >
            <option value="here" key="showMap-Here">
              現在位置
            </option>
            {travelList.map((value) => {
              return (
                <option value={value.id} key={"showMap-" + value.id}>
                  {value.name}
                </option>
              );
            })}
          </select>
          <p>map id: {showMapId}</p>
          <p>
            {showMapId != "here"
              ? travelList.find((value) => value.id == showMapId)?.description
              : null}
          </p>
          {showMapId != "here" ? (
            <p>
              総移動距離:{" "}
              {Math.round(
                mapMoveList.reduce(function (sum, value) {
                  return sum + value.distanceSumMeters;
                }, 0) / 100,
              ) / 10}
              km <br />
              総移動時間:
              {Math.round(
                mapMoveList.reduce(function (sum, value) {
                  return sum + value.moveSeconds;
                }, 0) / 3600,
              )}
              時間
              {Math.round(
                mapMoveList.reduce(function (sum, value) {
                  return sum + value.moveSeconds;
                }, 0) / 60,
              ) % 60}
              分
              {mapMoveList.reduce(function (sum, value) {
                return sum + value.moveSeconds;
              }, 0) % 60}
              秒
            </p>
          ) : null}
          <p>
            現在位置：
            {nowGeolocation
              ? `(${nowGeolocation.latitude}, ${nowGeolocation.longitude})`
              : "null"}
          </p>
          <div>
            {showMapId == "here" ? (
              <button
                onClick={() => {
                  setIsSetMapCenter(true);
                }}
              >
                現在位置に戻る
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsPlayMove(true);
                }}
              >
                移動の記録を再生する
              </button>
            )}
          </div>
          <p></p>
          <MapContainer
            style={{ width: "75vw", height: "60vh" }}
            center={
              nowGeolocation
                ? [nowGeolocation.latitude, nowGeolocation.longitude]
                : [defaultPosX, defaultPoxY]
            }
            zoom={14}
            minZoom={5}
            maxZoom={18}
            scrollWheelZoom={true}
          >
            <ChangeView />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapMoveList.map((moveInfo) => {
              return (
                <Polyline
                  pathOptions={{
                    fillColor: "red",
                    weight: 10,
                  }}
                  positions={moveInfo.geolocationList.map((value) => [
                    value.latitude,
                    value.longitude,
                  ])}
                  eventHandlers={{
                    click: (event) => {
                      setShowMoveInfo(moveInfo);
                      setShowMoveInfoClickPosX(event.latlng.lat);
                      setShowMoveInfoClickPosY(event.latlng.lng);
                    },
                  }}
                />
              );
            })}
            {showMoveInfo ? (
              <Popup position={[showMoveInfoClickPosX, showMoveInfoClickPosY]}>
                <>
                  {showMoveInfo.moveInfo.start.toLocaleString()} から{" "}
                  {showMoveInfo.moveInfo.end}まで
                  <br />
                </>
                <>
                  移動時間：
                  {Math.round(showMoveInfo.moveSeconds / 3600)}時間
                  {Math.round(showMoveInfo.moveSeconds / 60) % 60}分
                  {showMoveInfo.moveSeconds % 60}秒<br />
                </>
                <>
                  移動距離：
                  {Math.round(showMoveInfo.distanceSumMeters / 100) / 10}km
                  <br />
                </>
                <>
                  平均速度：
                  {Math.round(
                    (showMoveInfo.distanceSumMeters /
                      showMoveInfo.moveSeconds) *
                      36,
                  ) / 10}
                  km/h
                </>
              </Popup>
            ) : null}
            {nowGeolocation ? (
              <Circle
                center={[nowGeolocation.latitude, nowGeolocation.longitude]}
                pathOptions={{ fillColor: "blue" }}
                radius={40}
                eventHandlers={{
                  click: () => {
                    setIsNowPosPopup(!isNowPosPopup);
                  },
                }}
              />
            ) : null}
            {nowGeolocation && isNowPosPopup ? (
              <Popup
                position={[nowGeolocation.latitude, nowGeolocation.longitude]}
                eventHandlers={{
                  click: () => {
                    setIsNowPosPopup(false);
                  },
                }}
              >
                {nowGeolocation.speed ? (
                  <>
                    速度：{convertSpeed(nowGeolocation.speed)}km/h
                    <br />
                  </>
                ) : null}
                {nowGeolocation.altitude ? (
                  <>
                    高度：{nowGeolocation.altitude}
                    <br />
                  </>
                ) : null}
                {nowGeolocation.heading ? (
                  <>方角：{headingValueToDirection(nowGeolocation.heading)}</>
                ) : null}
              </Popup>
            ) : null}
          </MapContainer>
        </>
      ) : (
        <>
          <h3>旅行を選択する</h3>
          <select
            name="selectTravel"
            id="selectTravel"
            value={nowTravelId ? nowTravelId : "null"}
            onChange={(event) => {
              // 旅行記録を変えるときには一旦位置記録を停止する
              const now = new Date();
              if (recordingMoveInfo && nowTravelId) {
                const move: move = {
                  id: recordingMoveInfo.id,
                  start: recordingMoveInfo.start,
                  end: now,
                };
                setMoveList([...moveList, move]);
                setTravelList(
                  travelList.map((value) =>
                    value.id == nowTravelId
                      ? {
                          ...value,
                          move_id_list: [
                            ...value.move_id_list,
                            recordingMoveInfo.id,
                          ],
                        }
                      : value,
                  ),
                );
                setRecordingMoveInfo(null);
              }
              setIsRecordMove(false);

              event.target.value == "null"
                ? setNowTravelId(null)
                : setNowTravelId(event.target.value);
            }}
          >
            <option value="null" key="selectTravel-Null">
              -
            </option>
            {travelList.map((value) => {
              return (
                <option value={value.id} key={"selectTravel-" + value.id}>
                  {value.name}
                </option>
              );
            })}
          </select>

          <p>travel id: {nowTravelId ? nowTravelId : "null"}</p>
          <p></p>
          <span>
            記録を開始する
            <Switch
              onChange={(checked) => {
                setIsRecordMove(checked);
              }}
              disabled={nowTravelId == null}
              checked={isRecordMove}
            />
          </span>
        </>
      )}
    </div>
  );
}

export default App;
