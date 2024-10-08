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
import Database from '@tauri-apps/plugin-sql';
import L, {Map} from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet.offline";
import "leaflet/dist/leaflet.css";
import "./App.css";


type travel = {
  // uuid
  id: string,
  name: string,
  description: string,
}

function App() {

  const [overmoveDb, setOvermoveDb] = useState<Database | undefined>();

  useEffect(() => {
    (async() => {
      const db = await Database.load('sqlite:overmoveTest.db');
      setOvermoveDb(db);
    })()
  }, [])

  const [travelList, setTravelList] = useState<travel[]>([]);
  const [inputNewTravelName, setInputNewTravelName] = useState("");
  const [inputNewTravelDescription, setInputNewTravelDescription] = useState("");

  async function createNewTravel() {
    if (overmoveDb && inputNewTravelName != "") {
      const id = self.crypto.randomUUID().toString();
      setTravelList([{id, name: inputNewTravelName, description: inputNewTravelDescription}, ... travelList]);
      await overmoveDb.execute('INSERT into travel (id, name, description) VALUES ($1, $2, $3)', [id, inputNewTravelName, inputNewTravelDescription]);
      setInputNewTravelName("");
      setInputNewTravelDescription("");
    }
  }

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
