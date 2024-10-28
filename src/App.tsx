import { useEffect, useState } from "react";
import {
  checkPermissions,
  requestPermissions,
  getCurrentPosition,
  watchPosition,
  Position
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
  pos: Position
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

  const [isRecordMove, setIsRecordMove] = useState<boolean>(false);

  useEffect(() => {
    const now = Date();
  }, [nowTravelId, isRecordMove])

  const [phonePos, setPhonePos] = useState<Position | null>(null);
  const [posList, setPosList] = useState<Position[]>([]);
  const [posLen, setPosLen] = useState<number>(0);
  
  async function getPhonePos() {
    let permissions = await checkPermissions()
    info("[INFO] permissions 1: " + permissions.location)
    if (
      permissions.location === 'prompt' ||
      permissions.location === 'prompt-with-rationale'
    ) {
      permissions = await requestPermissions(['location'])
    }
  
    info("[INFO] permissions 2: " + permissions.location)
  
    if (permissions.location === 'granted') {
        info("[START] get pos")
        const pos = await getCurrentPosition();
        info("[END] get pos")
        setPhonePos(pos);
        setPosLen(posLen + 1);
        setPosList([pos,...posList]);
    }
  }
  
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
            info("watch pos");
            if (pos) {
              setPhonePos(pos);
            } else {
              info("null position");
            }
          }
        )
      }
    })()
  }, [])


  const [map, _setMap] = useState<Map | undefined>();
  const defaultPosX = 35.688150;
  const defaultPoxY = 139.699892;
  const [posX, setPosX] = useState<number>(defaultPosX);
  const [posY, setPosY] = useState<number>(defaultPoxY);
  const [mapZoom, setMapZoom] = useState<number>(14);
  const [nowTime, setNowTime] = useState<number>(Date.now());


  function setMapCenter() {
    info("click setMapCenter()");
    if (map) {
      const nowCenter = map.getCenter();
      setPosX(nowCenter.lat);
      setPosX(nowCenter.lng);
    }
    info(`now pos: (${posX}, ${posY})`)
    if (phonePos) {
      setPosX(phonePos.coords.latitude);
      setPosY(phonePos.coords.longitude);
      setMapZoom(14);
    } else {
      setPosX(defaultPosX);
      setPosY(defaultPoxY);
    }
    setNowTime(Date.now())
    info(`now pos: (${posX}, ${posY})`)
  }

  useEffect(() => {
    if (phonePos) {
      setPosLen(posLen + 1);
      setPosList([phonePos,...posList]);
    }
  }, [phonePos])
  

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

      setMapZoom(map.getZoom());
      setPosX(map.getCenter().lat);
      setPosX(map.getCenter().lng);
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
        const now = Date();
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

    <button onClick={getPhonePos}>位置情報を取得</button>
    <p>{phonePos ? <>{phonePos.timestamp} : ({phonePos.coords.latitude}, {phonePos.coords.longitude})</>: null}</p>

    <p>pos list length</p>
    <p>manual: {posLen}</p>


    <button onClick={setMapCenter}>現在位置に戻る</button>
    <p>現在位置：({posX}, {posY})</p>
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
