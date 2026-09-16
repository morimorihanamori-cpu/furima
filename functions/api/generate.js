export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { image, mimeType, userInput } = body;

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "APIキーが設定されていません。" }), { status: 500 });
    }

    // AIへの安全かつ厳格な指示文
    const prompt = `
あなたはフリマアプリ（メルカリ・ラクマ・Yahoo!フリマなど）のプロ出品者です。
添付された商品写真と出品者からの追加情報をもとに、出品用のタイトル・商品説明文・カテゴリ・特徴・検索キーワード・ハッシュタグを作成してください。

【出品者からの追加情報】
・ブランド: ${userInput.brand || "指定なし"}
・サイズ: ${userInput.size || "指定なし"}
・購入時期: ${userInput.purchaseTime || "指定なし"}
・商品の状態: ${userInput.condition || "指定なし"}
・その他メモ: ${userInput.notes || "特になし"}

【厳格な遵守ルール】
1. 写真および出品者情報から確実に確認できる事実のみに基づいて記述してください。
2. 写真だけでは判断できない情報（新品か中古か、着用回数、購入価格、傷汚れの有無など）は絶対に捏造しないでください。
3. 判断できない項目は「商品の状態については写真をご確認ください」等の安全な表現にしてください。
4. 自然で丁寧な日本語（「ご覧いただきありがとうございます」等）で記述してください。

必ず以下の構成のJSONフォーマットのみを返してください（Markdownの記法や装飾コードブロックは含めないでください）。

{
  "title": "ブランド名・アイテム名・特徴を含む魅力的な商品タイトル",
  "description": "そのままフリマアプリに貼り付けられる丁寧な商品説明文",
  "category": "大カテゴリ > 中カテゴリ > 小カテゴリ",
  "features": ["特徴1", "特徴2", "特徴3"],
  "keywords": ["キーワード1", "キーワード2", "キーワード3"],
  "hashtags": ["#タグ1", "#タグ2", "#タグ3"]
}
`;

    // Gemini APIリクエストの作成
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
    const apiPayload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: image } }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json"
      }
    };

    const apiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiPayload)
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return new Response(JSON.stringify({ error: "Gemini API Error: " + errText }), { status: 500 });
    }

    const responseData = await apiResponse.json();
    const resultText = responseData.candidates[0].content.parts[0].text;

    return new Response(resultText, {
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
