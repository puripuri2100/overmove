import { allDataType, move, geolocation } from "./App";

export function v010Tov020(dataText: string): allDataType {
  // 異動の集合としての旅行
  type travel_010 = {
    // uuid
    id: string;
    name: string;
    description: string;
    move_id_list: string[];
  };

  // 位置の集合としての移動
  type move_010 = {
    id: string;
    start: Date;
    end: Date;
  };

  // 位置
  type geolocation_010 = {
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

  type allDataType_010 = {
    version: string;
    travel: travel_010[];
    move: move_010[];
    geolocation: geolocation_010[];
  };

  const data_010: allDataType_010 = JSON.parse(dataText);

  const newTravelList = data_010.travel.map((value) => {
    const newTravel = {
      id: value.id,
      name: value.name,
      description: value.description,
    };
    return newTravel;
  });

  let newMoveList: move[] = [];
  for (let i = 0; i < data_010.move.length; i++) {
    const moveValue = data_010.move[i];
    const travel_data = data_010.travel.find((travelValue) =>
      travelValue.move_id_list.includes(moveValue.id),
    );
    if (travel_data) {
      const newMove = { id: moveValue.id, travel_id: travel_data.id };
      newMoveList = [...newMoveList, newMove];
    }
  }

  let newGeolocationList: geolocation[] = [];
  for (let i = 0; i < data_010.geolocation.length; i++) {
    const geolocationValue = data_010.geolocation[i];
    const move_data = data_010.move.find(
      (moveValue) =>
        moveValue.start <= geolocationValue.timestamp &&
        geolocationValue.timestamp <= moveValue.end,
    );
    if (move_data) {
      const newGeolocation = {
        move_id: move_data.id,
        timestamp: geolocationValue.timestamp,
        latitude: geolocationValue.latitude,
        longitude: geolocationValue.longitude,
        altitude: geolocationValue.altitude,
        altitudeAccuracy: geolocationValue.altitudeAccuracy,
        speed: geolocationValue.speed,
        heading: geolocationValue.heading,
      };
      newGeolocationList = [...newGeolocationList, newGeolocation];
    }
  }

  return {
    version: "0.2.0",
    travel: newTravelList,
    move: newMoveList,
    geolocation: newGeolocationList,
  };
}
