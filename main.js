// TM 모델 URL
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/q2mlbzWga/";

let model;
let maxPredictions;
let uploadedImage;

// Kakao Map 관련
let map;
let destinationMarker; // 사진 속 호관 마커
let userMarker;        // 내 위치 마커
let routeLine;         // 현재 위치 ~ 목적지 직선 경로

let userPosition;        // kakao.maps.LatLng
let destinationPosition; // kakao.maps.LatLng

/* ============================
 * 1. Teachable Machine 모델 로드
 * ============================ */
async function loadModel() {
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
}
loadModel();

/* ============================
 * 2. 이미지 업로드 / 드래그앤드랍
 * ============================ */
const imageUpload = document.getElementById("imageUpload");
const imageContainer = document.getElementById("image-container");
const uploadBox = document.getElementById("uploadBox");

// 이미지 표시 공통 함수
function displayImage(file) {
    const img = document.createElement("img");
    img.src = window.URL.createObjectURL(file);
    uploadedImage = img;

    imageContainer.innerHTML = "";
    imageContainer.appendChild(img);

    document.getElementById("top-prediction").textContent =
        "검색하기 버튼을 눌러 예측하세요.";
}

// input 파일 선택
imageUpload.addEventListener("change", function () {
    const file = this.files[0];
    if (file) displayImage(file);
});

// 드래그 오버
uploadBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadBox.classList.add("dragover");
});

// 드래그 리브
uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("dragover");
});

// 드랍
uploadBox.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadBox.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (file) displayImage(file);
});

/* ============================
 * 3. 예측 실행 (사진으로 호관 찾기)
 * ============================ */
document.getElementById("predictBtn").addEventListener("click", async () => {
    if (!uploadedImage) {
        alert("먼저 이미지를 업로드하세요.");
        return;
    }
    if (!model) {
        alert("모델을 아직 불러오는 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
    }
    await predictImage(uploadedImage);
});

// 이미지 예측 함수
async function predictImage(imageElement) {
    const prediction = await model.predict(imageElement);

    let bestClass = "";
    let bestProb = -1;

    for (let i = 0; i < maxPredictions; i++) {
        const p = prediction[i];
        if (p.probability > bestProb) {
            bestProb = p.probability;
            bestClass = p.className; // 예: "9호관", "11호관", "9", "11" 등
        }
    }

    const resultEl = document.getElementById("top-prediction");
    if (bestClass) {
        resultEl.textContent = `예측 결과: ${bestClass}`;
    } else {
        resultEl.textContent = "예측 결과를 가져오지 못했습니다.";
    }

    // 카카오맵 업데이트 (사진으로 인식한 호관)
    if (bestClass) {
        updateMapWithBuilding(bestClass);
    }
}

/* ============================
 * 4. Kakao Map 초기화
 * ============================ */
function initKakaoMap() {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return;

    if (!window.kakao || !kakao.maps) {
        console.warn("Kakao map SDK not loaded.");
        return;
    }

    // 기본 중심: 창원대학교 근처(대략적인 좌표)
    const centerLatLng = new kakao.maps.LatLng(35.2459, 128.6946);

    const options = {
        center: centerLatLng,
        level: 4
    };

    map = new kakao.maps.Map(mapContainer, options);

    // 기본 목적지 마커(초기에는 캠퍼스 중심)
    destinationMarker = new kakao.maps.Marker({
        map: map,
        position: centerLatLng
    });
}

// DOM 로딩 후 지도 초기화
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKakaoMap);
} else {
    initKakaoMap();
}

/* ============================
 * 5. 예측 결과/입력값으로 건물 검색 & 마커 이동
 * ============================ */

// 예측된 className 또는 직접 입력 값을 이용해 검색 키워드 만들기
function buildSearchKeyword(rawName) {
    let name = (rawName || "").trim();

    // 숫자만 들어온 경우: "9" -> "9호관"
    if (/^\d+$/.test(name)) {
        name = name + "호관";
    }

    // "창원대학교"가 앞에 없으면 붙이기
    if (!name.includes("창원대학교")) {
        name = "창원대학교 " + name;
    }

    return name;
}

function updateMapWithBuilding(buildingName) {
    if (!map || !window.kakao || !kakao.maps.services) {
        console.warn("Map or Kakao services not ready.");
        return;
    }

    const keyword = buildSearchKeyword(buildingName);
    const places = new kakao.maps.services.Places();

    places.keywordSearch(keyword, function (data, status) {
        if (status !== kakao.maps.services.Status.OK || !data.length) {
            console.warn("검색 결과 없음:", keyword);
            alert(`"${buildingName}"에 해당하는 위치를 찾지 못했습니다.`);
            return;
        }

        // 가장 첫 번째 결과 사용
        const place = data[0];
        const position = new kakao.maps.LatLng(place.y, place.x);

        destinationPosition = position;

        if (!destinationMarker) {
            destinationMarker = new kakao.maps.Marker({
                map: map,
                position: position
            });
        } else {
            destinationMarker.setPosition(position);
        }

        map.setCenter(position);
        map.setLevel(3);

        // 내 위치가 이미 있으면 경로도 업데이트
        drawRoute();
    });
}

/* ============================
 * 6. 현재 위치 찾기 (Geolocation) + 호관 입력 검색
 * ============================ */

const locateMeBtn = document.getElementById("locateMeBtn");
const buildingInput = document.getElementById("buildingInput");
const buildingSearchBtn = document.getElementById("buildingSearchBtn");

locateMeBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("이 브라우저에서는 위치 정보를 사용할 수 없습니다.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            if (!window.kakao || !kakao.maps) {
                console.warn("Kakao map not ready.");
                return;
            }

            userPosition = new kakao.maps.LatLng(lat, lng);

            if (!userMarker) {
                userMarker = new kakao.maps.Marker({
                    map: map,
                    position: userPosition
                });
            } else {
                userMarker.setPosition(userPosition);
            }

            map.setCenter(userPosition);
            map.setLevel(4);

            // 목적지가 이미 있으면 경로 그리기
            drawRoute();
        },
        (err) => {
            console.error(err);
            alert(
                "현재 위치를 가져오지 못했습니다.\n" +
                "HTTPS(또는 localhost) 환경인지, 위치 권한이 허용되어 있는지 확인해 주세요."
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
        }
    );
});

// 호관을 직접 입력해서 검색
buildingSearchBtn.addEventListener("click", () => {
    const value = buildingInput.value.trim();
    if (!value) {
        alert("호관 번호를 입력하세요. (예: 9)");
        return;
    }
    updateMapWithBuilding(value);
});

buildingInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        buildingSearchBtn.click();
    }
});

/* ============================
 * 7. 현재 위치 ~ 목적지 경로(직선) 그리기 + 거리/시간 계산
 * ============================ */

function drawRoute() {
    if (!map || !userPosition || !destinationPosition) return;

    // 기존 경로 제거
    if (routeLine) {
        routeLine.setMap(null);
        routeLine = null;
    }

    // 두 지점을 잇는 직선 Polyline
    routeLine = new kakao.maps.Polyline({
        path: [userPosition, destinationPosition],
        strokeWeight: 4,
        strokeColor: "#38bdf8",
        strokeOpacity: 0.9,
        strokeStyle: "solid"
    });

    routeLine.setMap(map);

    // 두 지점이 모두 보이도록 bounds 조정
    const bounds = new kakao.maps.LatLngBounds();
    bounds.extend(userPosition);
    bounds.extend(destinationPosition);
    map.setBounds(bounds);

    // 거리 및 예상 도보 시간 업데이트
    updateRouteInfo(userPosition, destinationPosition);
}

// 두 좌표 사이 거리(m) 계산 (Haversine formula)
function computeDistanceMeters(pos1, pos2) {
    const R = 6371000; // 지구 반지름 (m)

    const lat1 = pos1.getLat() * Math.PI / 180;
    const lng1 = pos1.getLng() * Math.PI / 180;
    const lat2 = pos2.getLat() * Math.PI / 180;
    const lng2 = pos2.getLng() * Math.PI / 180;

    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

// 거리/시간 텍스트 업데이트
function updateRouteInfo(pos1, pos2) {
    const distanceEl = document.getElementById("route-distance");
    const timeEl = document.getElementById("route-time");
    if (!distanceEl || !timeEl) return;

    const distanceMeters = computeDistanceMeters(pos1, pos2);
    const distanceKm = distanceMeters / 1000;

    distanceEl.textContent = `거리: 약 ${distanceKm.toFixed(2)} km`;

    // 보통 도보 속도 4.5km/h ≒ 1.25m/s 정도로 가정
    const walkingSpeedMps = 1.25;
    const timeSeconds = distanceMeters / walkingSpeedMps;
    const timeText = formatWalkingTime(timeSeconds);

    timeEl.textContent = `예상 도보 시간: 약 ${timeText}`;
}

// 초 단위를 "X분", "X시간 Y분" 같은 형태로
function formatWalkingTime(seconds) {
    const totalMinutes = Math.round(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
        return `${minutes}분`;
    }
    if (minutes === 0) {
        return `${hours}시간`;
    }
    return `${hours}시간 ${minutes}분`;
}
