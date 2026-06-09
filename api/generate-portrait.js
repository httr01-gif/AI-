module.exports = async function handler(req, res) {
  // GitHub Pages 또는 Vercel 웹앱에서 호출할 수 있도록 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 브라우저에서 API 주소를 열었을 때 확인용
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "AI 초상화 API가 준비되었습니다."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Vercel 환경 변수 OPENAI_API_KEY가 설정되지 않았습니다."
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { imageBase64, prompt } = body || {};

    if (!imageBase64 || !prompt) {
      return res.status(400).json({
        error: "imageBase64와 prompt가 필요합니다."
      });
    }

    // data:image/jpeg;base64,... 형태에서 실제 base64만 분리
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = match ? match[1] : "image/jpeg";
    const base64Data = match ? match[2] : imageBase64;

    const imageBuffer = Buffer.from(base64Data, "base64");

    const formData = new FormData();
    formData.append("model", "gpt-image-2");
    formData.append("prompt", prompt);
    formData.append("size", "1024x1536");
    formData.append("quality", "low");
    formData.append("output_format", "jpeg");

    const imageBlob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image[]", imageBlob, "student.jpg");

    const openaiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return res.status(openaiResponse.status).json({
        error: "OpenAI 이미지 생성 실패",
        detail: data
      });
    }

    const resultImage = data?.data?.[0]?.b64_json;

    if (!resultImage) {
      return res.status(500).json({
        error: "생성된 이미지 데이터가 없습니다.",
        detail: data
      });
    }

    return res.status(200).json({
      imageBase64: resultImage,
      mimeType: "image/jpeg"
    });
  } catch (error) {
    return res.status(500).json({
      error: "서버 처리 중 오류가 발생했습니다.",
      detail: error.message
    });
  }
};
