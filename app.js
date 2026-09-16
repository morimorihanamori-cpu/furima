document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const generateForm = document.getElementById("generateForm");
  const imageInput = document.getElementById("imageInput");
  const brandInput = document.getElementById("brandInput");
  const sizeInput = document.getElementById("sizeInput");
  const conditionInput = document.getElementById("conditionInput");
  const submitBtn = document.getElementById("submitBtn");
  const remainingCountEl = document.getElementById("remainingCount");
  const errorContainer = document.getElementById("errorContainer");
  const resultContainer = document.getElementById("resultContainer");

  // 利用制限の設定（1日または全体で5回）
  const MAX_FREE_USAGE = 5;

  // --- 1. 残り利用回数の管理 ---
  function getUsageCount() {
    return parseInt(localStorage.getItem("fleamarket_ai_usage_count") || "0", 10);
  }

  function updateUsageDisplay() {
    const count = getUsageCount();
    const remaining = Math.max(0, MAX_FREE_USAGE - count);
    if (remainingCountEl) {
      remainingCountEl.textContent = remaining;
    }
    if (remaining <= 0 && submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "無料上限に達しました（PROプランへ）";
    }
  }
  updateUsageDisplay();

  // --- 2. フォーム送信 ＆ AI生成APIリクエスト ---
  if (generateForm) {
    generateForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideError();

      const file = imageInput?.files[0];
      if (!file) {
        showError("商品写真を選択してください。");
        return;
      }

      if (getUsageCount() >= MAX_FREE_USAGE) {
        window.openProModal();
        return;
      }

      // ローディング表示設定
      setLoading(true);

      try {
        // 画像をBase64文字列に変換
        const base64Image = await convertFileToBase64(file);

        // 補足情報の収集
        const info = {
          brand: brandInput?.value.trim() || "",
          size: sizeInput?.value.trim() || "",
          condition: conditionInput?.value.trim() || ""
        };

        // Cloudflare Function (API) へ送信
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64Image, info })
        });

        const resData = await response.json();

        if (!response.ok || !resData.success) {
          throw new Error(resData.error || "AIの処理中にエラーが発生しました。");
        }

        // 使用回数を更新
        const newCount = getUsageCount() + 1;
        localStorage.setItem("fleamarket_ai_usage_count", newCount.toString());
        updateUsageDisplay();

        // 結果画面の描画
        renderResults(resData.data);
        if (resultContainer) {
          resultContainer.classList.remove("hidden");
          resultContainer.scrollIntoView({ behavior: "smooth" });
        }

      } catch (err) {
        showError(err.message || "通信エラーが発生しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    });
  }

  // --- 3. 生成結果の表示処理 ---
  function renderResults(data) {
    // 1. 推定価格
    if (data.estimatedPrice) {
      setText("priceRecommended", data.estimatedPrice.recommended ? data.estimatedPrice.recommended.toLocaleString() : "0");
      setText("priceRange", data.estimatedPrice.range || "-");
      setText("priceQuick", data.estimatedPrice.quickSell ? data.estimatedPrice.quickSell.toLocaleString() : "0");
      setText("priceStandard", data.estimatedPrice.standard ? data.estimatedPrice.standard.toLocaleString() : "0");
      setText("priceHigh", data.estimatedPrice.high ? data.estimatedPrice.high.toLocaleString() : "0");
    }

    // 2. タイトル3案
    if (data.titles) {
      setText("titleSearch", data.titles.search || "");
      setText("titleClick", data.titles.click || "");
      setText("titleSimple", data.titles.simple || "");
    }

    // 3. 写真チェック
    const photoCheckList = document.getElementById("photoCheckList");
    if (photoCheckList && data.photoCheck?.checks) {
      photoCheckList.innerHTML = data.photoCheck.checks.map(c => `
        <div class="check-item">
          <span>${escapeHtml(c.item)}</span>
          <span class="${c.status === "OK" ? "status-ok" : "status-warn"}">${escapeHtml(c.status)}</span>
        </div>
      `).join("");
    }

    const photoSuggestions = document.getElementById("photoSuggestions");
    if (photoSuggestions && data.photoCheck?.suggestions) {
      photoSuggestions.innerHTML = data.photoCheck.suggestions
        .map(s => `<li>${escapeHtml(s)}</li>`)
        .join("");
    }

    // 4. 商品説明文
    setText("descriptionText", data.description || "");

    // 5. ハッシュタグ
    if (data.hashtags && Array.isArray(data.hashtags)) {
      setText("hashtagText", data.hashtags.join(" "));
    }

    // 6. 梱包方法 ＆ アフィリエイト枠
    if (data.packing) {
      setText("packingMethod", data.packing.method || "");
      renderAffiliateLinks(data.packing.type);
    }
  }

  // --- 4. アフィリエイトおすすめ資材の描画 ---
  function renderAffiliateLinks(packingType) {
    const affiliateList = document.getElementById("affiliateList");
    if (!affiliateList) return;

    // タイプ別のおすすめ梱包資材定義（Amazon/楽天などのアフィリエイトURLに差し替え可能）
    const itemsMap = {
      clothes: [
        { name: "OPP袋 A4サイズ（衣類用防水袋）", link: "#", btnText: "Amazonで探す" },
        { name: "宅配袋 破れにくい強粘着テープ付", link: "#", btnText: "楽天で探す" }
      ],
      fragile: [
        { name: "エアクッション（プチプチロール）", link: "#", btnText: "Amazonで探す" },
        { name: "ダンボール箱 60サイズ（強化タイプ）", link: "#", btnText: "楽天で探す" }
      ],
      book: [
        { name: "クッション封筒 ネコポス/ゆうパケット対応", link: "#", btnText: "Amazonで探す" }
      ],
      default: [
        { name: "フリマ用 梱包資材スターターセット", link: "#", btnText: "Amazonで探す" },
        { name: "厚さ測定定規（メルカリ・ラクマ対応）", link: "#", btnText: "楽天で探す" }
      ]
    };

    const items = itemsMap[packingType] || itemsMap.default;
    affiliateList.innerHTML = items.map(item => `
      <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="affiliate-card-item">
        <span>📦 ${escapeHtml(item.name)}</span>
        <span class="affiliate-btn">${escapeHtml(item.btnText)} ➔</span>
      </a>
    `).join("");
  }

  // --- 5. ユーティリティ関数 ---
  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function setLoading(isLoading) {
    if (!submitBtn) return;
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.textContent = "🤖 AIが分析中...";
    } else {
      submitBtn.disabled = getUsageCount() >= MAX_FREE_USAGE;
      submitBtn.textContent = getUsageCount() >= MAX_FREE_USAGE 
        ? "無料上限に達しました（PROプランへ）" 
        : "AIで出品情報をつくる";
    }
  }

  function showError(msg) {
    if (!errorContainer) return;
    errorContainer.textContent = msg;
    errorContainer.classList.remove("hidden");
  }

  function hideError() {
    if (!errorContainer) return;
    errorContainer.textContent = "";
    errorContainer.classList.add("hidden");
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});

// --- 6. HTMLの onclick 属性から呼び出されるグローバル関数 ---
window.copyText = function (elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const text = el.value || el.innerText || el.textContent;
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    showToast("コピーしました！");
  }).catch(() => {
    showToast("コピーに失敗しました。");
  });
};

window.openProModal = function () {
  const modal = document.getElementById("proModal");
  if (modal) modal.classList.remove("hidden");
};

window.closeProModal = function () {
  const modal = document.getElementById("proModal");
  if (modal) modal.classList.add("hidden");
};

// トースト通知の作成・表示
function showToast(message) {
  let toast = document.getElementById("toastContainer");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toastContainer";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove("hidden");
  
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 2500);
}
