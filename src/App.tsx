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
import Modal from "react-modal";
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

function App() {



  const savedTravelList = localStorage.getItem('travelList');
  const [travelList, setTravelList] = useState<travel[]>(savedTravelList ? JSON.parse(savedTravelList) : []);
  const savedMoveList = localStorage.getItem('moveList');
  const [moveList, setMoveList] = useState<move[]>(savedMoveList ? JSON.parse(savedMoveList) : []);
  const savedGeolocationList = localStorage.getItem('geolocationList');
  const [geolocationList, setGeolocationList] = useState<geolocation[]>(savedGeolocationList ? JSON.parse(savedGeolocationList) : []);

  useEffect(() => {
    localStorage.setItem("travelList", JSON.stringify(travelList));
  }, [travelList]);

  useEffect(() => {
    localStorage.setItem("moveList", JSON.stringify(moveList));
  }, [moveList]);

  useEffect(() => {
    localStorage.setItem("geolocationList", JSON.stringify(geolocationList));
  }, [geolocationList]);


  const [isOpenCreateTravelModal, setIsOpenCreateTravelModal] = useState(false);
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
      setIsOpenCreateTravelModal(false);
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
      <button onClick={() => setIsOpenCreateTravelModal(true)}>新しい旅行記録を作成する</button>
      <Modal
        isOpen={isOpenCreateTravelModal}
        shouldCloseOnOverlayClick={true}
      >
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
          <button onClick={() => setIsOpenCreateTravelModal(false)}>キャンセル</button>
        </div>
      </Modal>

    <p></p>

    <h3>旅行を選択する</h3>
    <select
      name="selectTravel"
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

    <p></p>
    <span>
      記録を開始する
      <Switch onChange={(checked) => {setIsRecordMove(checked)}} checked={isRecordMove}/>
    </span>
    <p></p>

    <p>
      現在位置：{ nowGeolocation ? `(${nowGeolocation.latitude}, ${nowGeolocation.longitude})` : "null"}
    </p>

    <div>
      <button onClick={() => setMapCenter()}>現在位置に戻る</button>
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
    </div>
  );
}

export default App;
