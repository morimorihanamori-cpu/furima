document.addEventListener('DOMContentLoaded', () => {
  // DOM要素の取得
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const uploadPlaceholder = document.getElementById('upload-placeholder');
  const previewContainer = document.getElementById('preview-container');
  const imagePreview = document.getElementById('image-preview');
  const changeImageBtn = document.getElementById('change-image-btn');
  const generateBtn = document.getElementById('generate-btn');

  // 入力項目の取得
  const brandInput = document.getElementById('brand');
  const categoryInput = document.getElementById('category');
  const sizeInput = document.getElementById('size');
  const purchaseTimeInput = document.getElementById('purchase-time');
  const conditionInput = document.getElementById('condition');
  const shippingInput = document.getElementById('shipping');
  const hashtagsInput = document.getElementById('hashtags');
  const notesInput = document.getElementById('notes');

  // 画面セクションの取得
  const inputSection = document.getElementById('input-section');
  const loadingSection = document.getElementById('loading-section');
  const resultSection = document.getElementById('result-section');

  // 結果表示用要素
  const resultTitle = document.getElementById('result-title');
  const resultDescription = document.getElementById('result-description');
  const resultCategory = document.getElementById('result-category');
  const resultFeatures = document.getElementById('result-features');
  const resultKeywords = document.getElementById('result-keywords');
  const resultHashtags = document.getElementById('result-hashtags');

  // ボタン類
  const copyAllBtn = document.getElementById('copy-all-btn');
  const resetBtn = document.getElementById('reset-btn');
  const toast = document.getElementById('toast');

  let base64Image = null;

  // --- 画像アップロード関連処理 ---
  dropZone.addEventListener('click', (e) => {
    if (e.target !== changeImageBtn) {
      fileInput.click();
    }
  });

  changeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      base64Image = e.target.result;
      imagePreview.src = base64Image;
      uploadPlaceholder.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      generateBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  // --- AI生成処理 ---
  generateBtn.addEventListener('click', async () => {
    if (!base64Image) return;

    // 画面切り替え
    inputSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 入力データの集約
    const inputData = {
      brand: brandInput.value.trim(),
      category: categoryInput.value.trim(),
      size: sizeInput.value.trim(),
      purchaseTime: purchaseTimeInput.value.trim(),
      condition: conditionInput.value.trim(),
      shipping: shippingInput.value.trim(),
      hashtags: hashtagsInput.value.trim(),
      notes: notesInput.value.trim()
    };

    try {
      // Cloudflare Worker (バックエンド) へリクエスト送信
      const response = await fetch('https://furima-backend.mori-2121k.workers.dev/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          info: inputData
        })
      });

      if (!response.ok) {
        throw new Error('生成に失敗しました');
      }

      const data = await response.json();
      displayResult(data);

    } catch (error) {
      alert('エラーが発生しました。もう一度お試しください。');
      console.error(error);
      loadingSection.classList.add('hidden');
      inputSection.classList.remove('hidden');
    }
  });

  // --- 結果表示処理 ---
  function displayResult(data) {
    loadingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

    resultTitle.textContent = data.title || 'タイトルなし';
    resultDescription.textContent = data.description || '';
    resultCategory.textContent = data.category || '指定なし';

    // 特徴リスト
    resultFeatures.innerHTML = '';
    if (data.features && Array.isArray(data.features)) {
      data.features.forEach(feat => {
        const li = document.createElement('li');
        li.textContent = feat;
        resultFeatures.appendChild(li);
      });
    }

    // 検索キーワード
    resultKeywords.innerHTML = '';
    if (data.keywords && Array.isArray(data.keywords)) {
      data.keywords.forEach(kw => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = kw;
        resultKeywords.appendChild(span);
      });
    }

    // ハッシュタグ
    resultHashtags.innerHTML = '';
    if (data.hashtags && Array.isArray(data.hashtags)) {
      data.hashtags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag.startsWith('#') ? tag : `#${tag}`;
        resultHashtags.appendChild(span);
      });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- コピー機能 ---
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        copyToClipboard(targetEl.textContent);
      }
    });
  });

  copyAllBtn.addEventListener('click', () => {
    const fullText = `【商品名】\n${resultTitle.textContent}\n\n【商品説明】\n${resultDescription.textContent}\n\n【ハッシュタグ】\n${Array.from(resultHashtags.children).map(c => c.textContent).join(' ')}`;
    copyToClipboard(fullText);
  });

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast();
    });
  }

  function showToast() {
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.classList.add('hidden');
    }, 2000);
  }

  // リセットボタン
  resetBtn.addEventListener('click', () => {
    resultSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
