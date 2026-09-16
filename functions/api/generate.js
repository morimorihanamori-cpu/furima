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

    // 2. Base64データの整形
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const mimeTypeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

    // 3. AIプロンプトの構築（厳格なJSON指定）
    const systemPrompt = `
あなたはフリマアプリ（メルカリ・ラクマ・Yahoo!フリマ等）のプロ出品サポートAIです。
提供された商品画像とユーザー入力情報を分析し、以下の要件を満たす純粋なJSONオブジェクトのみを出力してください。Markdownの装飾（\`\`\`jsonなど）は一切含めないでください。

【ユーザー入力情報】
- ブランド/メーカー: ${info?.brand || "画像から判断"}
- カテゴリ: ${info?.category || "画像から自動判定"}
- サイズ: ${info?.size || "不明"}
- 購入時期: ${info?.purchaseTime || "不明"}
- 商品の状態: ${info?.condition || "画像から判断"}
- 発送方法: ${info?.shipping || "未定"}
- SEO・ハッシュタグ要望: ${info?.hashtags || "指定なし"}
- その他備考: ${info?.notes || "なし"}

【重要なルール】
- 写真や入力から確認できない情報（キズ・汚れ・状態など）は勝手に「美品」などと断定せず、「不明」または「要確認」としてください。
- タイトルは【検索重視】【クリック重視】【シンプル】の3パターン作成してください。
- カテゴリは「レディース/メンズ/キッズ/靴/バッグ/家電/ゲーム/本/おもちゃ/コスメ/その他」から選んでください。

【出力JSONフォーマット】
{
  "category": "判定されたカテゴリ",
  "titles": {
    "search": "検索重視タイトル",
    "click": "クリック重視タイトル",
    "simple": "シンプルタイトル"
  },
  "estimatedPrice": {
    "recommended": 3280,
    "quickSell": 2980,
    "standard": 3280,
    "high": 3580,
    "range": "2,800〜3,500円",
    "disclaimer": "※推定価格はAIによる参考値であり、実際の販売価格を保証するものではありません。"
  },
  "description": "整理された商品説明文",
  "hashtags": ["#タグ1", "#タグ2", "#タグ3"],
  "photoCheck": {
    "checks": [
      { "item": "商品全体", "status": "OK" },
      { "item": "ブランドタグ", "status": "追加推奨" },
      { "item": "サイズタグ", "status": "OK" },
      { "item": "傷・汚れ確認", "status": "要確認" }
    ],
    "suggestions": ["背面全体が写っている写真", "タグの拡大写真"]
  },
  "packing": {
    "method": "おすすめの梱包方法説明",
    "type": "clothes" // clothes, fragile, book, default のいずれか
  }
}
`;

    // 4. Gemini API REST呼び出し
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const apiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error("Gemini API Error:", errorText);
      return new Response(
        JSON.stringify({ error: "AIの処理中にエラーが発生しました。時間をおいて再試行してください。" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiResult = await apiResponse.json();
    const rawText = apiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsedData = JSON.parse(rawText);

    return new Response(JSON.stringify({ success: true, data: parsedData }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Server Error:", err);
    return new Response(
      JSON.stringify({ error: "サーバー内でエラーが発生しました。" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
