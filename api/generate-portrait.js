module.exports = async function handler(req, res) {
  // CORS 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // API 상태 확인용
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "AI 초상화 API가 준비되었습니다. (premium v2)"
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

    // data:image/jpeg;base64,... 에서 실제 base64만 분리
    const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (!match) {
      return res.status(400).json({
        error: "올바른 base64 이미지 형식이 아닙니다."
      });
    }

    const mimeType = match[1];
    const base64Data = match[2];
    const imageBuffer = Buffer.from(base64Data, "base64");

    // 프롬프트 보강
    const enhancedPrompt = `
${prompt}

추가 생성 지침:
- 단순한 얼굴 필터가 아니라, 완성도 높은 프리미엄 세로형 AI 초상화 포스터로 제작한다.
- 업로드된 학생 사진의 얼굴 특징, 헤어스타일, 안경 여부, 피부 톤, 표정의 기본 인상은 최대한 존중하여 유지한다.
- 좋아하는 인물 정보는 분위기 참고용으로만 사용하고, 특정 인물의 얼굴을 복제하거나 닮게 만들지 않는다.
- 희망진로와 선택 단어가 배경, 색감, 소품, 구도에 분명하게 드러나도록 시각적으로 표현한다.
- 결과물은 학생용 행사 기념 카드처럼 따뜻하고 세련되며 인쇄 품질이 좋게 만든다.
- 배경은 풍부하고 완성도 있게 구성하되, 인물은 화면의 중심에서 돋보이게 한다.
- 얼굴만 크게 잘린 이미지가 아니라, 상반신 중심의 세로형 포스터 느낌으로 제작한다.
- 이미지 안에는 글자, 워터마크, 로고를 넣지 않는다.
- 전체적으로 ChatGPT 이미지 생성처럼 부드럽고 고급스러운 일러스트 퀄리티를 지향한다.
`.trim();

    const formData = new FormData();
    formData.append("model", "gpt-image-1.5");
    formData.append("prompt", enhancedPrompt);
    formData.append("size", "1024x1536");
    formData.append("quality", "medium");
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
      ok: true,
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
