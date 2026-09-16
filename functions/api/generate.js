export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 1. APIキーの設定チェック
    if (!env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY が設定されていません。Pagesの設定画面を確認してください。" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const { image, info } = await request.json();

    if (!image) {
      return new Response(
        JSON.stringify({ error: "画像データが送信されていません。" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompt = `
あなたはフリマアプリ（メルカリ・ラクマ・Yahoo!フリマ等）の優秀な出品サポートAIです。
画像と以下の入力情報を分析し、購入意欲を高める魅力的な出品データを作成してください。

【ユーザー入力情報】
- ブランド/メーカー: ${info?.brand || "画像から判断"}
- カテゴリ: ${info?.category || "画像から判断"}
- サイズ: ${info?.size || "不明"}
- 購入時期: ${info?.purchaseTime || "不明"}
- 商品の状態: ${info?.condition || "目立った傷や汚れなし"}
- 発送方法: ${info?.shipping || "未定（迅速・丁寧に梱包して発送します）"}
- SEO・ハッシュタグ要望: ${info?.hashtags || "指定なし"}
- その他備考: ${info?.notes || "なし"}

【出力フォーマット】
必ず以下のJSON形式のみで出力してください（Markdownのコードブロックを含めないでください）。

{
  "title": "40文字以内の検索されやすい商品タイトル",
  "description": "商品説明文（状態、サイズ、発送方法、注意事項などを丁寧かつ読みやすくまとめた文章）",
  "category": "推定されるカテゴリ名",
  "features": ["特徴1", "特徴2", "特徴3"],
  "keywords": ["検索用キーワード1", "キーワード2", "キーワード3"],
  "hashtags": ["#ハッシュタグ1", "#ハッシュタグ2", "#ハッシュタグ3"]
}
`;

    // 2. Gemini API リクエスト（指定された gemini-3.6-flash を使用）
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: image.split(",")[1],
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json",
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API エラーが発生しました。");
    }

    const resultText = data.candidates[0].content.parts[0].text;

    return new Response(resultText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
