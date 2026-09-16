document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const uploadArea = document.getElementById("upload-area");
  const imageInput = document.getElementById("image-input");
  const previewContainer = document.getElementById("preview-container");
  const imagePreview = document.getElementById("image-preview");
  const form = document.getElementById("generate-form");
  const submitBtn = document.getElementById("submit-btn");
  const loadingSection = document.getElementById("loading-section");
  const resultSection = document.getElementById("result-section");
  const usageBadge = document.getElementById("usage-badge");
  const toast = document.getElementById("toast");

  // PROモーダル関連
  const proModal = document.getElementById("pro-modal");
  const openProBtn = document.getElementById("open-pro-btn");
  const closeProBtn = document.getElementById("close-pro-btn");

  let currentBase64Image = null;

  // --- 1. 利用回数の管理 ---
  const MAX_FREE_USAGE = 5;
  function getUsageCount() {
    return parseInt(localStorage.getItem("fleamarket_ai_usage_count") || "0", 10);
  }

  function updateUsageDisplay() {
    const count = getUsageCount();
    const remaining = Math.max(0, MAX_FREE_USAGE - count);
    if (usageBadge) {
      usageBadge.textContent = `本日あと ${remaining} 回利用可能`;
    }
    if (remaining <= 0 && submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "本日の無料上限に達しました (PROプランへ)";
    }
  }
  updateUsageDisplay();

  // --- 2. 画像アップロード & プレビュー処理 (Nullガード付き) ---
  if (uploadArea && imageInput) {
    uploadArea.addEventListener("click", () => imageInput.click());

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    imageInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });
  }

  function handleFile(file) {
    if (!file.type.startsWith("image/")) {
      showToast("画像ファイルを選択してください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      currentBase64Image = e.target.result;
      if (imagePreview) imagePreview.src = currentBase64Image;
      if (previewContainer) previewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  // --- 3. フォーム送信 ＆ AI生成API呼び出し ---
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!currentBase64Image) {
        showToast("商品を撮影または画像を選択してください。");
        return;
      }

      if (getUsageCount() >= MAX_FREE_USAGE) {
        if (proModal) proModal.classList.remove("hidden");
        return;
      }

      const info = {
        brand: document.getElementById("brand")?.value || "",
        category: document.getElementById("category")?.value || "",
        size: document.getElementById("size")?.value || "",
        purchaseTime: document.getElementById("purchase-time")?.value || "",
        condition: document.getElementById("condition")?.value || "",
        shipping: document.getElementById("shipping")?.value || "",
        hashtags: document.getElementById("user-hashtags")?.value || "",
        notes: document.getElementById("notes")?.value || ""
      };

      if (submitBtn) submitBtn.disabled = true;
      if (loadingSection) loadingSection.classList.remove("hidden");
      if (resultSection) resultSection.classList.add("hidden");

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: currentBase64Image, info })
        });

        const resData = await response.json();

        if (!response.ok || !resData.success) {
          throw new Error(resData.error || "生成処理に失敗しました。");
        }

        const newCount = getUsageCount() + 1;
        localStorage.setItem("fleamarket_ai_usage_count", newCount.toString());
        updateUsageDisplay();

        renderResults(resData.data);
        if (resultSection) {
          resultSection.classList.remove("hidden");
          resultSection.scrollIntoView({ behavior: "smooth" });
        }

      } catch (err) {
        showToast(err.message || "通信エラーが発生しました。");
      } finally {
        if (loadingSection) loadingSection.classList.add("hidden");
        if (submitBtn && getUsageCount() < MAX_FREE_USAGE) {
          submitBtn.disabled = false;
        }
      }
    });
  }

  // --- 4. 生成結果のDOM描画 ---
  function renderResults(data) {
    setText("res-category", data.category || "未分類");
    setText("title-search", data.titles?.search || "");
    setText("title-click", data.titles?.click || "");
    setText("title-simple", data.titles?.simple || "");

    if (data.estimatedPrice) {
      setText("price-rec", data.estimatedPrice.recommended ? `${data.estimatedPrice.recommended.toLocaleString()} 円` : "---");
      setText("price-quick", data.estimatedPrice.quickSell ? `${data.estimatedPrice.quickSell.toLocaleString()}円` : "---");
      setText("price-std", data.estimatedPrice.standard ? `${data.estimatedPrice.standard.toLocaleString()}円` : "---");
      setText("price-high", data.estimatedPrice.high ? `${data.estimatedPrice.high.toLocaleString()}円` : "---");
      setText("price-disclaimer", data.estimatedPrice.disclaimer || "");
    }

    const photoCheckContainer = document.getElementById("photo-check-list");
    if (photoCheckContainer && data.photoCheck?.checks) {
      photoCheckContainer.innerHTML = data.photoCheck.checks.map(c => `
        <div class="check-item">
          <span>${escapeHtml(c.item)}</span>
          <span class="${c.status === "OK" ? "status-ok" : "status-warn"}">${escapeHtml(c.status)}</span>
        </div>
      `).join("");
    }

    const suggestionsBox = document.getElementById("photo-suggestions");
    if (suggestionsBox && data.photoCheck?.suggestions?.length > 0) {
      suggestionsBox.innerHTML = `<strong>💡 撮影のアドバイス:</strong><ul>${data.photoCheck.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
      suggestionsBox.classList.remove("hidden");
    } else if (suggestionsBox) {
      suggestionsBox.classList.add("hidden");
    }

    setText("res-description", data.description || "");
    if (data.hashtags && Array.isArray(data.hashtags)) {
      setText("res-hashtags", data.hashtags.join(" "));
    }

    if (data.packing) {
      setText("res-packing-method", data.packing.method || "");
    }
  }

  // --- 5. ユーティリティ ---
  window.copyText = function (elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.value || el.innerText;
    navigator.clipboard.writeText(text).then(() => {
      showToast("コピーしました！");
    }).catch(() => {
      showToast("コピーに失敗しました。");
    });
  };

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3000);
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

  // --- 6. モーダル表示イベント ---
  if (openProBtn && proModal) openProBtn.addEventListener("click", () => proModal.classList.remove("hidden"));
  if (closeProBtn && proModal) closeProBtn.addEventListener("click", () => proModal.classList.add("hidden"));
});
