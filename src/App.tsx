import { useEffect, useState } from "react";
import {
  checkPermissions,
  requestPermissions,
  watchPosition,
} from '@tauri-apps/plugin-geolocation';
import {
  info
} from '@tauri-apps/plugin-log';
import {
  readTextFile, 
  writeTextFile,
  BaseDirectory,
  exists,
  create,
} from '@tauri-apps/plugin-fs';
import Switch from "react-switch";
import { CopyBlock, github } from "react-code-blocks";
import {
  format,
  differenceInSeconds
} from "date-fns";
import L, {Map} from "leaflet";
import {
  MapContainer,
  TileLayer,
  useMap,
  Polyline,
  Circle,
  Popup
} from "react-leaflet";
import "leaflet.offline";
import "leaflet/dist/leaflet.css";
import "./App.css";


// 異動の集合としての旅行
type travel = {
  // uuid
  id: string,
  name: string,
  description: string,
  move_id_list: string[]
}


// 位置の集合としての移動
type move = {
  id: string,
  start: Date,
  end: Date
}

// 位置
type geolocation = {
  timestamp: Date,
  // 緯度
  latitude: number,
  // 経度
  longitude: number,
  // 高度
  altitude: number | null,
  // 高精度な高度
  altitudeAccuracy : number | null,
  // 速度
  speed: number | null,
  // ユーザーが向いている向き
  heading: number | null,
}

type allDataType = {
  version: string,
  travel: travel[],
  move: move[]
  geolocation: geolocation[],
}

// 地図に表示する移動の情報
type mapMoveInfo = {
  moveInfo: move,
  geolocationList: geolocation[],
  maxSpeed: number | null,
  averageSpeed: number | null,
  distanceSum: number,
  moveSeconds: number,
}

// モード選択
type mode = "recordMove" | "createTravel" | "showMap" | "fetchData";

function App() {

  const version = "0.1.0"

  const [nowMode, setNowMode] = useState<mode>("recordMove");



  const [travelList, setTravelList] = useState<travel[]>([]);
  const [moveList, setMoveList] = useState<move[]>([]);
  const [geolocationList, setGeolocationList] = useState<geolocation[]>([]);

  const [allData, setAllData] = useState<allDataType>({
    version,
    travel: [],
    move: [],
    geolocation: []
  });

  const [isDataFetch, setIsDataFetch] = useState<"import" | "export" | "hide">("hide");
  const [importDataText, setImportDataText] = useState("");

  const travelListFilePath = "travelList.json";
  const moveListFilePath = "moveList.json";
  const geolocationListFilePath = "geolocationList.json";

  useEffect(() => {
    (async() => {
      const existsTravelListFile = await exists(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsTravelListFile) {
        info(`exists: travelListFilePath`);
        const travelListFileText = await readTextFile(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setTravelList(JSON.parse(travelListFileText));
        info("read travelList");
      } else {
        info("not exists: travelListFilePath");
        const file = await create(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create travelList");
      }

      const existsMoveListFile = await exists(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsMoveListFile) {
        info(`exists: moveListFilePath`);
        const moveListFileText = await readTextFile(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setMoveList(JSON.parse(moveListFileText));
        info("read moveList");
      } else {
        info(`not exists: moveListFilePath`);
        const file = await create(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create moveList");
      }

      const existsGeolocationListFile = await exists(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsGeolocationListFile) {
        info(`exists: geolocationListFilePath`);
        const geolocationListFileText = await readTextFile(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setGeolocationList(JSON.parse(geolocationListFileText));
      } else {
        info(`not exists: geolocationListFilePath`);
        const file = await create(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
        await file.write(new TextEncoder().encode("[]"));
        await file.close();
        info("create geolocationList");
      }
    })();
  }, [])


  useEffect(() => {
    (async() => {
      const isTravelListFileOnAppLocalDataDir = await exists(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      info(`isTravelListFileOnAppLocalDataDir: ${isTravelListFileOnAppLocalDataDir}`);

      const nowText = await readTextFile(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      const data: travel[] = JSON.parse(nowText);
      if (data.length < travelList.length) {
        await writeTextFile(travelListFilePath, JSON.stringify(travelList), {baseDir: BaseDirectory.AppLocalData});
        info("write travelList");
      }
    })()
  }, [travelList]);

  useEffect(() => {
    (async() => {
      const isTravelListFileOnAppLocalDataDir = await exists(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      info(`isTravelListFileOnAppLocalDataDir: ${isTravelListFileOnAppLocalDataDir}`);

      const nowText = await readTextFile(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
      const data: move[] = JSON.parse(nowText);
      if (data.length < moveList.length) {
        await writeTextFile(moveListFilePath, JSON.stringify(moveList), {baseDir: BaseDirectory.AppLocalData});
        info("write moveList");
      }
    })()
  }, [moveList]);

  useEffect(() => {
    (async() => {
      const isTravelListFileOnAppLocalDataDir = await exists(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      info(`isTravelListFileOnAppLocalDataDir: ${isTravelListFileOnAppLocalDataDir}`);

      const nowText = await readTextFile(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
      const data: move[] = JSON.parse(nowText);
      if (data.length < geolocationList.length) {
        await writeTextFile(geolocationListFilePath, JSON.stringify(geolocationList), {baseDir: BaseDirectory.AppLocalData});
        info("write geolocationList");
      }
    })()
  }, [geolocationList]);


  useEffect(() => {
    setAllData({
      version,
      travel: travelList,
      move: moveList,
      geolocation: geolocationList
    })
  }, [travelList, moveList, geolocationList])


  const [inputNewTravelName, setInputNewTravelName] = useState("");
  const [inputNewTravelDescription, setInputNewTravelDescription] = useState("");

  async function createNewTravel() {
    if (inputNewTravelName != "") {
      const id = self.crypto.randomUUID().toString();
      const newTravel = {
        id,
        name: inputNewTravelName,
        description: inputNewTravelDescription,
        move_id_list: []
      };
      setTravelList([newTravel, ... travelList]);
      setInputNewTravelName("");
      setInputNewTravelDescription("");
    }
  }

  const [nowTravelId, setNowTravelId] = useState<string | null>(null);
  const [nowMoveStartDate, setNowMoveStartDate] = useState<Date | null>(null);
  const [isRecordMove, setIsRecordMove] = useState<boolean>(false);

  useEffect(() => {
    const now = new Date();
    if (isRecordMove && nowTravelId) {
      // 移動の記録の開始
      setNowMoveStartDate(now);
    }
    if (!isRecordMove && nowTravelId && nowMoveStartDate) {
      // 移動の記録の終了
      const newMoveId = crypto.randomUUID().toString();
      const move: move = {
        id: newMoveId,
        start: nowMoveStartDate,
        end: now,
      }
      setMoveList([...moveList, move]);
      setTravelList(travelList.map((value) => value.id == nowTravelId ? {... value, move_id_list: [... value.move_id_list, newMoveId]} : value));
      setNowMoveStartDate(null);
    }
  }, [isRecordMove])

  const [nowGeolocation, setNowGeolocation] = useState<geolocation | null>(null);

  useEffect(() => {
    (async() => {
      let permissions = await checkPermissions()
      if (
        permissions.location === 'prompt' ||
        permissions.location === 'prompt-with-rationale'
      ) {
        permissions = await requestPermissions(['location'])
      }
  
      if (permissions.location === 'granted') {
        await watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (pos) => {
            if (pos) {
              info("watchPosition success")
              const geo: geolocation = {
                timestamp: new Date(pos.timestamp),
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                altitude: pos.coords.altitude,
                altitudeAccuracy: pos.coords.altitudeAccuracy,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
              }
              setNowGeolocation(geo);
            } else {
              info("error: watchPosition failed")
            }
          }
        )
      }
    })()
  }, [])

  useEffect(() => {
    if (nowGeolocation && isRecordMove) {
      setGeolocationList([...geolocationList, nowGeolocation]);
    }
  }, [nowGeolocation])


  const [map, _setMap] = useState<Map | undefined>();
  const defaultPosX = 35.688150;
  const defaultPoxY = 139.699892;

  const [showMapId, setShowMapId] = useState("here");
  const [mapMoveList, setMapMoveList] = useState<mapMoveInfo[]>([]);

  const [isSetMapCenter, setIsSetMapCenter] = useState<boolean>(false);

  // 現在位置に移動速度などを表示するかどうかのフラグ
  const [isNowPosPopup, setIsNowPosPopup] = useState(false);

  // m/s -> km/h
  function convertSpeed(speed: number): number {
    return speed * 3.6
  }

  // 方角の値から向きを出す関数
  function headingValueToDirection(heading: number): string {
    if ((0 <= heading && heading < 22.5) || 337.5 <= heading) {
      return "北"
    } else if (22.5 <= heading && heading < 67.5) {
      return "北東"
    } else if (67.5 <= heading && heading < 112.5) {
      return "東"
    } else if (112.5 <= heading && heading < 157.5) {
      return "南東"
    } else if (157.5 <= heading && heading < 202.5) {
      return "南"
    } else if (202.5 <= heading && heading < 247.5) {
      return "南西"
    } else if (247.5 <= heading && heading < 292.5) {
      return "西"
    } else if (292.5 <= heading && heading < 337.5) {
      return "北西"
    } else {
      return ""
    }
  }

  // 2地点間の緯度経度から間の距離を求める
  // Haversineの公式を用いる
  // 赤道半径R: 6378.137km
  // 緯度x1, 経度y1
  // 緯度y1, 経度y2
  // D = R * acos(sin(y1) * sin(y2) + cos(y1) * cos(y2) * cos(x2 - x1))
  function calDistance(x1: number, y1: number, x2: number, y2: number): number {
    const r = 6378.137;
    return r * Math.acos(Math.sin(y1) * Math.sin(y2) + Math.cos(y1) * Math.cos(y2) * Math.cos(x2 - x1));
  }

  // 選択された旅行に含まれる移動のリストを作成する
  useEffect(() => {
    const targetTravelId = showMapId == "here" ? nowTravelId : showMapId;
    const travelInfo = travelList.find((value) => value.id == targetTravelId);
    if (travelInfo) {
      const targetMoveList = moveList.filter((value) => travelInfo.move_id_list.includes(value.id));
      const targetGeoList = targetMoveList.map((moveInfo) => {
        const lst = geolocationList.filter((geo) => moveInfo.start <= geo.timestamp && geo.timestamp <= moveInfo.end);
        let maxSpeed: number | null = null;
        let tempX = 0;
        let tempY = 0;
        let distanceSum = 0;
        for (let i = 0; i < lst.length; i++) {
          const value = lst[i];
          if (value.speed) {
            if (maxSpeed) {
              if (maxSpeed < value.speed) {
                maxSpeed = value.speed;
              }
            } else {
              maxSpeed = value.speed
            }
          }

          if (i != 0) {
            const x = value.latitude;
            const y = value.longitude;
            const d = calDistance(x, y, tempX, tempY);
            distanceSum += d;
            tempX = x;
            tempY = y;
          }
        }
        const data: mapMoveInfo = {
          moveInfo,
          geolocationList: lst,
          maxSpeed,
          averageSpeed: null,
          distanceSum,
          moveSeconds: differenceInSeconds(moveInfo.end, moveInfo.start)
        };
        return data
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
    if(map){
  
      // @ts-ignore
      const tileLayerOffline = L.tileLayer.offline(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }
      );
  
      tileLayerOffline.addTo(map);
  
      // @ts-ignore
      const controlSaveTiles = L.control.savetiles(
        tileLayerOffline
      );
  
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
      {
        nowMode == "createTravel" ?
        <>
          <h3>旅行名</h3>
          <p>
            <input
              value={inputNewTravelName} name="createTravelName"
              onChange={(event) => setInputNewTravelName(event.target.value)}
            />
          </p>
          <p>説明</p>
          <textarea
            value={inputNewTravelDescription} name="createTravelDescription"
            onChange={(event) => setInputNewTravelDescription(event.target.value)}
          />
          <div>
            <button onClick={createNewTravel}>作成</button>
          </div>
        </>
        : nowMode == "fetchData" ?
          <>
            <p>
              移動の記録中はデータベースの更新はできません。
              <Switch onChange={(checked) => {setIsRecordMove(checked)}} disabled={!isRecordMove} checked={isRecordMove}/>
            </p>
            <div>
              <button onClick={() => setIsDataFetch("export")}>現在のデータを表示する</button>
              <button onClick={() => setIsDataFetch("import")}>データを取り込む</button>
              <button onClick={() => setIsDataFetch("hide")}>隠す</button>
            </div>
            {
              isDataFetch == "export" ?
                <CopyBlock
                  text={JSON.stringify(allData, null, 2)}
                  language="json"
                  theme={github}
                  showLineNumbers={false}
                />
              :
                isDataFetch == "import" ?
                  <div>
                    <div>
                      <button onClick={() => {
                        const importData: allDataType = JSON.parse(importDataText);
                        if (importData) {
                          setTravelList(importData.travel);
                          setMoveList(importData.move);
                          setGeolocationList(importData.geolocation);
                        }
                      }}>
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
                :
                  null
            }
          </>
        : nowMode == "showMap" ?
          <>
            {isRecordMove ? <p>移動中は現在位置の表示のみできます。</p> : null}
            <select
              name="showMapId"
              id="showMapId"
              value={showMapId}
              onChange={(event) => {
                setShowMapId(event.target.value);
              }}
              disabled={isRecordMove}
            >
              <option value="here" key="showMap-Here">現在位置</option>
              {travelList.map((value) => {return <option value={value.id} key={"showMap-"+value.id}>{value.name}</option>})}
            </select>
            <p>map id: {showMapId}</p>
            <p>{showMapId != "here" ? travelList.find((value) => value.id == showMapId)?.description : null}</p>
            <p>
              現在位置：{ nowGeolocation ? `(${nowGeolocation.latitude}, ${nowGeolocation.longitude})` : "null"}
            </p>
            <div>
              {showMapId == "here" ?
                <button
                  onClick={() => {
                    setIsSetMapCenter(true);
                  }}
                >
                  {showMapId == "here" ? "現在位置に戻る" : "移動の記録を再生する"}
                </button>
              :
                <button
                  onClick={() => {
                    setIsSetMapCenter(true);
                  }}
                >
                  移動の記録を再生する
                </button>
              }
            </div>
            <p></p>
            <MapContainer
              style={{ width: "75vw", height: "60vh" }}
              center={
                nowGeolocation ?
                  [nowGeolocation.latitude, nowGeolocation.longitude]
                : [defaultPosX, defaultPoxY]
              }
              zoom={14}
              minZoom={5}
              maxZoom={18}
              scrollWheelZoom={true}
            >
              <ChangeView/>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {
                mapMoveList.map((moveInfo) => {
                  return <Polyline
                    pathOptions={{
                      fillColor: 'red',
                      weight: 10
                    }}
                    positions={moveInfo.geolocationList.map((value) => [value.latitude, value.longitude])}
                    eventHandlers={{
                      click: (event) => {
                        setShowMoveInfo(moveInfo);
                        setShowMoveInfoClickPosX(event.latlng.lat);
                        setShowMoveInfoClickPosY(event.latlng.lng);
                      }
                    }}
                  />
                })
              }
              {
                showMoveInfo ?
                  <Popup position={[showMoveInfoClickPosX, showMoveInfoClickPosY]}>
                    <>{showMoveInfo.moveInfo.start.toLocaleString()} から {showMoveInfo.moveInfo.end}まで<br /></>
                    <>
                      移動時間：
                      {Math.round(showMoveInfo.moveSeconds / 3600)}時間
                      {Math.round(showMoveInfo.moveSeconds / 60) % 60}分
                      {(showMoveInfo.moveSeconds % 60)}秒<br />
                    </>
                    <>移動距離：{Math.round(showMoveInfo.distanceSum / 100) / 10}km<br /></>
                    <>平均速度：{Math.round((showMoveInfo.distanceSum / (showMoveInfo.moveSeconds / 3600)) / 100) / 10}km/h</>
                  </Popup>
                : null
              }
              {nowGeolocation ?
                <Circle
                  center={[nowGeolocation.latitude, nowGeolocation.longitude]}
                  pathOptions={{fillColor: "blue"}}
                  radius={40}
                  eventHandlers={{
                    click: () => {setIsNowPosPopup(!isNowPosPopup)}
                  }}
                />
              : null}
              {nowGeolocation && isNowPosPopup ?
                <Popup position={[nowGeolocation.latitude, nowGeolocation.longitude]}>
                  {nowGeolocation.speed ? <>速度：{convertSpeed(nowGeolocation.speed)}km/h<br/></> : null}
                  {nowGeolocation.altitude ? <>高度：{nowGeolocation.altitude}<br/></> : null}
                  {nowGeolocation.heading ? <>方角：{headingValueToDirection(nowGeolocation.heading)}</> : null}
                </Popup>
              : null}
            </MapContainer>
          </>
        :
        <>
          <h3>旅行を選択する</h3>
          <select
            name="selectTravel"
            id="selectTravel"
            value={nowTravelId ? nowTravelId : "null"}
            onChange={(event) => {
              // 旅行記録を変えるときには一旦位置記録を停止する
              const now = new Date();
              if (nowMoveStartDate && nowTravelId) {
                const newMoveId = crypto.randomUUID().toString();
                const move: move = {
                  id: newMoveId,
                  start: nowMoveStartDate,
                  end: now,
                }
                setMoveList([...moveList, move]);
                setTravelList(travelList.map((value) => value.id == nowTravelId ? {... value, move_id_list: [... value.move_id_list, newMoveId]} : value));
                setNowMoveStartDate(null);
              }
              setIsRecordMove(false);

              event.target.value == "null" ? setNowTravelId(null) : setNowTravelId(event.target.value)
            }}
          >
            <option value="null" key="selectTravel-Null">-</option>
            {travelList.map((value) => {return <option value={value.id} key={"selectTravel-"+value.id}>{value.name}</option>})}
          </select>

          <p>travel id: {nowTravelId ? nowTravelId : "null"}</p>
          <p></p>
          <span>
            記録を開始する
            <Switch onChange={(checked) => {setIsRecordMove(checked)}} disabled={nowTravelId == null} checked={isRecordMove}/>
          </span>
        </>
      }

    </div>
  );
}

export default App;
