// TM 모델 URL
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/SDZpnWgTQ/";

let model, maxPredictions, uploadedImage;

// 모델 로드
async function loadModel() {
    const modelURL = MODEL_URL + "model.json";
    const metadataURL = MODEL_URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();
}
loadModel();

// ---------------------------
// 📌 이미지 업로드 처리 (표시만)
// ---------------------------
const imageUpload = document.getElementById("imageUpload");
const imageContainer = document.getElementById("image-container");

function displayImage(file) {
    const img = document.createElement("img");
    img.src = window.URL.createObjectURL(file);
    uploadedImage = img;

    imageContainer.innerHTML = "";
    imageContainer.appendChild(img);

    document.getElementById("top-prediction").textContent =
        "검색하기 버튼을 눌러 예측하세요.";
}

// input 파일 업로드
imageUpload.addEventListener("change", function () {
    const file = this.files[0];
    if (file) displayImage(file);
});

// ---------------------------
// 📌 드래그 & 드랍 업로드
// ---------------------------
const uploadBox = document.getElementById("uploadBox");

uploadBox.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadBox.classList.add("dragover");
});

uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("dragover");
});

uploadBox.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadBox.classList.remove("dragover");

    const file = e.dataTransfer.files[0];
    if (file) displayImage(file);
});

// ---------------------------
// 📌 검색 버튼 클릭 시 예측 실행
// ---------------------------
document.getElementById("predictBtn").addEventListener("click", async () => {
    if (!uploadedImage) {
        alert("먼저 사진을 업로드하세요.");
        return;
    }
    predictImage(uploadedImage);
});

// ---------------------------
// 📌 이미지 예측 함수
// ---------------------------
async function predictImage(imageElement) {
    if (!model) return;

    const prediction = await model.predict(imageElement);

    let bestClass = "";
    let bestProb = -1;

    for (let i = 0; i < maxPredictions; i++) {
        const p = prediction[i];
        if (p.probability > bestProb) {
            bestProb = p.probability;
            bestClass = p.className;
        }
    }

    // 결과만 출력 (확률 제거)
    document.getElementById("top-prediction").textContent =
        `예측 결과: ${bestClass}`;
}
