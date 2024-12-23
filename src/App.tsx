import { useEffect, useState } from "react";
import {
  checkPermissions,
  requestPermissions,
  watchPosition,
  Position,
} from "@tauri-apps/plugin-geolocation";
import { error, info } from "@tauri-apps/plugin-log";
import {
  readTextFile,
  writeTextFile,
  BaseDirectory,
  exists,
  create,
} from "@tauri-apps/plugin-fs";
import { save, open } from "@tauri-apps/plugin-dialog";
import { v010Tov020 } from "./convertVersionData";
import Switch from "react-switch";
import { differenceInSeconds } from "date-fns";
// @ts-ignore
import distance from "@turf/distance";
// @ts-ignore
import { point } from "@turf/helpers";
import { formatToTimeZone } from "date-fns-timezone";
import {
  MapContainer,
  TileLayer,
  useMap,
  Polyline,
  Circle,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

// 異動の集合としての旅行
export type travel = {
  // uuid
  id: string;
  name: string;
  description: string;
};

// 位置の集合としての移動
export type move = {
  id: string;
  travel_id: string;
};

// 位置
export type geolocation = {
  move_id: string;
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

export type allDataType = {
  version: string;
  travel: travel[];
  move: move[];
  geolocation: geolocation[];
};

// 地図に表示する移動の情報
export type mapMoveInfo = {
  moveInfo: move;
  geolocationList: geolocation[];
  maxSpeed: number | null;
  averageSpeed: number | null;
  distanceSumMeters: number;
  startDate: Date | null;
  endDate: Date | null;
  moveSeconds: number;
};

// モード選択
export type mode = "recordMove" | "createTravel" | "showMap" | "fetchData";

function App() {
  const version = "0.2.0";

  const datePrintFormat = "YYYY-MM-DD HH:mm:ss";
  const timeZoneTokyo = "Asia/Tokyo";

  const [nowMode, setNowMode] = useState<mode>("recordMove");

  const [travelList, setTravelList] = useState<travel[]>([]);
  const [moveList, setMoveList] = useState<move[]>([]);
  const [geolocationList, setGeolocationList] = useState<geolocation[]>([]);

  const [allData, setAllData] = useState<allDataType>({
    version,
    travel: [],
    move: [],
    geolocation: [],
  });

  // 記録の開始に関わる変数
  const [nowTravelId, setNowTravelId] = useState<string | null>(null);
  const [nowMoveId, setNowMoveId] = useState<string | null>(null);
  const [isRecordMove, setIsRecordMove] = useState<boolean>(false);

  const travelListFilePath = `travelList.${version}.json`;
  const moveListFilePath = `moveList.${version}.json`;
  const geolocationListFilePath = `geolocationList.${version}.json`;

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
    setAllData({
      version,
      travel: travelList,
      move: moveList,
      geolocation: geolocationList,
    });
  }, [travelList, moveList, geolocationList]);

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
    if (isRecordMove && nowTravelId) {
      // 移動の記録の開始
      const newMoveId = crypto.randomUUID().toString();
      setNowMoveId(newMoveId);
      const move = { id: newMoveId, travel_id: nowTravelId };
      setMoveList([...moveList, move]);
    }
    if (!isRecordMove && nowTravelId && nowMoveId) {
      // 移動の記録の終了
      setNowMoveId(null);
    }
  }, [isRecordMove]);

  const [nowPos, setNowPos] = useState<Position | null>(null);
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
              info(
                `watchPosition success: (${pos.coords.latitude}, ${pos.coords.longitude}) at ${pos.timestamp}`,
              );
              setNowPos(pos);
            } else {
              info("error: watchPosition failed");
            }
          },
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (nowPos) {
      info(`moveId: ${nowMoveId}`);
      const move_id = nowMoveId ? nowMoveId : "none";
      const geo: geolocation = {
        move_id,
        timestamp: new Date(nowPos.timestamp),
        latitude: nowPos.coords.latitude,
        longitude: nowPos.coords.longitude,
        altitude: nowPos.coords.altitude,
        altitudeAccuracy: nowPos.coords.altitudeAccuracy,
        speed: nowPos.coords.speed,
        heading: nowPos.coords.heading,
      };
      setNowGeolocation(geo);
    }
  }, [nowPos]);

  useEffect(() => {
    if (nowGeolocation && isRecordMove) {
      setGeolocationList([...geolocationList, nowGeolocation]);
    }
  }, [nowGeolocation]);

  const defaultPosX = 35.68815;
  const defaultPoxY = 139.699892;

  const [showMapId, setShowMapId] = useState("here");
  const [mapMoveList, setMapMoveList] = useState<mapMoveInfo[]>([]);

  const [isSetMapCenter, setIsSetMapCenter] = useState<boolean>(false);

  // 移動の記録を再生するかどうかのフラグ
  const [isPlayMove, setIsPlayMove] = useState<boolean>(false);

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
    const targetTravelId = isRecordMove ? nowTravelId : showMapId;
    const travelInfo = travelList.find((value) => value.id == targetTravelId);
    if (travelInfo) {
      const targetMoveList = moveList.filter(
        (value) => value.travel_id == targetTravelId,
      );
      const targetGeoList = targetMoveList.map((moveInfo) => {
        const lst = geolocationList.filter((geo) => geo.move_id == moveInfo.id);
        let maxSpeed: number | null = null;
        let tempX = 0;
        let tempY = 0;
        let distanceSumMeters = 0;
        let startDate: Date | null = null;
        let endDate: Date | null = null;
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

          if (startDate) {
            if (value.timestamp) {
              if (value.timestamp < startDate) {
                startDate = value.timestamp;
              }
            }
          } else {
            if (value.timestamp) {
              startDate = value.timestamp;
            }
          }

          if (endDate) {
            if (value.timestamp) {
              if (value.timestamp > endDate) {
                endDate = value.timestamp;
              }
            }
          } else {
            if (value.timestamp) {
              endDate = value.timestamp;
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
        const moveSeconds = startDate
          ? endDate
            ? differenceInSeconds(endDate, startDate)
            : 0
          : 0;
        const data: mapMoveInfo = {
          moveInfo,
          geolocationList: lst,
          maxSpeed,
          averageSpeed: null,
          distanceSumMeters,
          startDate,
          endDate,
          moveSeconds,
        };
        return data;
      });
      setMapMoveList(targetGeoList);
    } else {
      setMapMoveList([]);
    }
  }, [showMapId, isRecordMove, geolocationList]);

  // 情報を見たい移動のIDとクリックした位置
  const [showMoveInfo, setShowMoveInfo] = useState<mapMoveInfo | null>(null);
  const [showMoveInfoClickPosX, setShowMoveInfoClickPosX] = useState(0);
  const [showMoveInfoClickPosY, setShowMoveInfoClickPosY] = useState(0);

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
      if (showMapId != "here" && mapMoveList.length > 0) {
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

  async function saveData() {
    const path = await save();
    if (path) {
      const fileText = JSON.stringify(allData, null, 2);
      await writeTextFile(path, fileText);
      info(`data save: ${path}`);
    } else {
      error(`data save failed`);
    }
  }

  async function openData() {
    const path = await open({ multiple: false, directory: false });
    if (path) {
      const importDataText = await readTextFile(path);
      const data = JSON.parse(importDataText);
      const importData: allDataType =
        data.version == "0.2.0"
          ? JSON.parse(importDataText)
          : v010Tov020(importDataText);
      if (importData) {
        setTravelList(importData.travel);
        await writeTextFile(
          travelListFilePath,
          JSON.stringify(importData.travel),
          { baseDir: BaseDirectory.AppLocalData },
        );
        info("write travelList");
        setMoveList(importData.move);
        await writeTextFile(moveListFilePath, JSON.stringify(importData.move), {
          baseDir: BaseDirectory.AppLocalData,
        });
        info("write moveList");
        setGeolocationList(importData.geolocation);
        await writeTextFile(
          geolocationListFilePath,
          JSON.stringify(importData.geolocation),
          { baseDir: BaseDirectory.AppLocalData },
        );
        info("write geolocationList");
        info("data open success");
      }
    } else {
      error(`data open failed`);
    }
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
            <button onClick={saveData} disabled={isRecordMove}>
              現在のデータを保存する
            </button>
            <button onClick={openData} disabled={isRecordMove}>
              データを取り込む
            </button>
          </div>
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

          {isRecordMove && nowMoveId ? (
            <div>
              {mapMoveList.map((value) => {
                if (value.moveInfo.id == nowMoveId) {
                  <>
                    {value.startDate ? (
                      <p>
                        移動開始：
                        {formatToTimeZone(value.startDate, datePrintFormat, {
                          timeZone: timeZoneTokyo,
                        })}
                      </p>
                    ) : null}
                    <p>
                      移動時間：
                      {Math.round(value.moveSeconds / 3600)}時間
                      {Math.round(value.moveSeconds / 60) % 60}分
                      {value.moveSeconds % 60}秒<br />
                    </p>
                    <p>
                      移動距離：{Math.round(value.distanceSumMeters / 100) / 10}
                      km
                    </p>
                    <p>
                      平均速度：
                      {Math.round(
                        (value.distanceSumMeters / value.moveSeconds) * 36,
                      ) / 10}
                      km/h
                    </p>
                  </>;
                  return null;
                } else {
                  return null;
                }
              })}
            </div>
          ) : null}

          <div>
            <p>
              現在位置：
              {nowGeolocation
                ? `(${nowGeolocation.latitude}, ${nowGeolocation.longitude})`
                : "null"}
            </p>
            {nowGeolocation ? (
              <>
                {nowGeolocation.speed ? (
                  <p>
                    速度：
                    {Math.round(convertSpeed(nowGeolocation.speed) * 10) / 10}
                    km/h
                  </p>
                ) : null}
                {nowGeolocation.altitude ? (
                  <p>高度：{Math.round(nowGeolocation.altitude * 10) / 10}m</p>
                ) : null}
                {nowGeolocation.heading ? (
                  <p>方角：{headingValueToDirection(nowGeolocation.heading)}</p>
                ) : null}
              </>
            ) : null}
          </div>

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
                    color: "blue",
                    weight: 10,
                  }}
                  positions={moveInfo.geolocationList.map((value) => [
                    value.latitude,
                    value.longitude,
                  ])}
                  eventHandlers={{
                    click: (event) => {
                      info(
                        `Polyline click, pos: (${event.latlng.lat}, ${event.latlng.lng}), moveInfo value: ${moveInfo.moveInfo.id}}`,
                      );
                      setShowMoveInfo(moveInfo);
                      setShowMoveInfoClickPosX(event.latlng.lat);
                      setShowMoveInfoClickPosY(event.latlng.lng);
                    },
                  }}
                />
              );
            })}
            {showMoveInfo &&
            showMoveInfo.startDate &&
            showMoveInfo.endDate &&
            showMoveInfo.moveSeconds != 0 ? (
              <Popup position={[showMoveInfoClickPosX, showMoveInfoClickPosY]}>
                <>
                  {formatToTimeZone(showMoveInfo.startDate, datePrintFormat, {
                    timeZone: timeZoneTokyo,
                  })}
                  から
                  {formatToTimeZone(showMoveInfo.startDate, datePrintFormat, {
                    timeZone: timeZoneTokyo,
                  })}
                  まで
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
              />
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
              setNowMoveId(null);
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
