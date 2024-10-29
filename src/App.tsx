import { useEffect, useState } from "react";
import {
  checkPermissions,
  requestPermissions,
  watchPosition,
} from '@tauri-apps/plugin-geolocation';
import {
  //trace,
  info,
  //error
} from '@tauri-apps/plugin-log';
import {
  readTextFile, 
  writeTextFile,
  BaseDirectory,
  exists,
  create
} from '@tauri-apps/plugin-fs';
import Switch from "react-switch";
import L, {Map} from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
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

// モード選択
type mode = "recordMove" | "createTravel" | "showMap" | "fetchData";

function App() {

  const [nowMode, setNowMode] = useState<mode>("recordMove");



  const [travelList, setTravelList] = useState<travel[]>([]);
  const [moveList, setMoveList] = useState<move[]>([]);
  const [geolocationList, setGeolocationList] = useState<geolocation[]>([]);


  const travelListFilePath = "travelList.json";
  const moveListFilePath = "moveList.json";
  const geolocationListFilePath = "geolocationList.json";

  useEffect(() => {
    (async() => {
      const existsTravelListFile = await exists(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsTravelListFile) {
        const travelListFileText = await readTextFile(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setTravelList(JSON.parse(travelListFileText));
      } else {
        create(travelListFilePath, {baseDir: BaseDirectory.AppLocalData});
      }

      const existsMoveListFile = await exists(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsMoveListFile) {
        const moveListFileText = await readTextFile(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setMoveList(JSON.parse(moveListFileText));
      } else {
        create(moveListFilePath, {baseDir: BaseDirectory.AppLocalData});
      }

      const existsGeolocationListFile = await exists(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
      if (existsGeolocationListFile) {
        const geolocationListFileText = await readTextFile(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
        setGeolocationList(JSON.parse(geolocationListFileText));
      } else {
        create(geolocationListFilePath, {baseDir: BaseDirectory.AppLocalData});
      }
    })();
  }, [])


  useEffect(() => {
    (async() => {
      await writeTextFile(travelListFilePath, JSON.stringify(travelList), {baseDir: BaseDirectory.AppLocalData});
    })()
  }, [travelList]);

  useEffect(() => {
    (async() => {
      await writeTextFile(moveListFilePath, JSON.stringify(moveList), {baseDir: BaseDirectory.AppLocalData});
    })()
  }, [moveList]);

  useEffect(() => {
    (async() => {
      await writeTextFile(geolocationListFilePath, JSON.stringify(geolocationList), {baseDir: BaseDirectory.AppLocalData});
    })()
  }, [geolocationList]);


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
            const isRecord = (() => {return isRecordMove})();
            if (isRecord) {
              if (pos) {
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
              }
            } else {
              setNowGeolocation(null);
            }
          }
        )
      }
    })()
  }, [])

  useEffect(() => {
    if (nowGeolocation) {
      setGeolocationList([...geolocationList, nowGeolocation]);
    }
  }, [nowGeolocation])


  const [map, _setMap] = useState<Map | undefined>();
  const defaultPosX = 35.688150;
  const defaultPoxY = 139.699892;
  const [posX, setPosX] = useState<number>(defaultPosX);
  const [posY, setPosY] = useState<number>(defaultPoxY);
  const [_nowTime, setNowTime] = useState<number>(Date.now());

  const [showMapId, setShowMapId] = useState("here");

  function setMapCenter() {
    info("click setMapCenter()");
    if (map) {
      const nowCenter = map.getCenter();
      setPosX(nowCenter.lat);
      setPosX(nowCenter.lng);
    }
    info(`now pos: (${posX}, ${posY})`)
    if (nowGeolocation) {
      setPosX(nowGeolocation.latitude);
      setPosY(nowGeolocation.longitude);
    } else {
      setPosX(defaultPosX);
      setPosY(defaultPoxY);
    }
    setNowTime(Date.now())
    info(`now pos: (${posX}, ${posY})`)
  }

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

      setPosX(map.getCenter().lat);
      setPosY(map.getCenter().lng);
    }
  }, [map]);

  type ChangeViewProps = {
    center: [number, number]
  }

  function ChangeView(props: ChangeViewProps) {
    const nowMap = useMap();
    nowMap.setView(props.center);
    nowMap.setZoom(14);
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
            <p>まだ動かない</p>
            <p>
              移動の記録中はデータベースの更新はできません。
              <Switch onChange={(checked) => {setIsRecordMove(checked)}} disabled={!isRecordMove} checked={isRecordMove}/>
            </p>
            <div>
              <button>データを上書きダウンロードする</button>
            </div>
            <div>
              <button>データをサーバーに送信する</button>
            </div>
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
              <option value="here">現在位置</option>
              {travelList.map((value) => {return <option value={value.id}>{value.name}</option>})}
            </select>
            <p>map id: {showMapId}</p>
            <p>
              現在位置：{ nowGeolocation ? `(${nowGeolocation.latitude}, ${nowGeolocation.longitude})` : "null"}
            </p>
            <div>
              <button onClick={() => setMapCenter()}>{showMapId == "here" ? "現在位置に戻る" : "移動の記録を再生する"}</button>
            </div>
            <p></p>
            <MapContainer
              style={{ width: "75vw", height: "60vh" }}
              center={[posX, posY]}
              zoom={14}
              minZoom={5}
              maxZoom={18}
              scrollWheelZoom={true}
            >
              <ChangeView center={[posX, posY]}/>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
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
            <option value="null">-</option>
            {travelList.map((value) => {return <option value={value.id}>{value.name}</option>})}
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
