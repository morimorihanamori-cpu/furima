// ==========================================
// アフィリエイトURL設定
// 後からURLを変更する場合は、以下の文字列を編集してください。
// URLが未設定（""）の場合は「リンク未設定」と表示されます。
// ==========================================
const AFFILIATE_LINKS = {
  packing_opp: "", // ① 梱包用OPP袋 のアフィリエイトURL
  packing_bag: "", // ② 宅配ビニール袋 のアフィリエイトURL
  photo_box: ""    // ③ 商品撮影ボックス のアフィリエイトURL
};

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const uploadPlaceholder = document.getElementById('upload-placeholder');
  const previewContainer = document.getElementById('preview-container');
  const imagePreview = document.getElementById('image-preview');
  const changeImageBtn = document.getElementById('change-image-btn');
  const generateBtn = document.getElementById('generate-btn');

  const inputSection = document.getElementById('input-section');
  const loadingSection = document.getElementById('loading-section');
  const resultSection = document.getElementById('result-section');

  let base64Image = '';

  // アフィリエイトリンクの動的反映処理
  function setupAffiliateLinks() {
    const items = [
      { id: 'affiliate-btn-1', url: AFFILIATE_LINKS.packing_opp },
      { id: 'affiliate-btn-2', url: AFFILIATE_LINKS.packing_bag },
      { id: 'affiliate-btn-3', url: AFFILIATE_LINKS.photo_box }
    ];

    items.forEach(item => {
      const btnEl = document.getElementById(item.id);
      if (!btnEl) return;

      if (item.url && item.url.trim() !== '') {
        btnEl.href = item.url;
        btnEl.textContent = '詳しく見る';
        btnEl.classList.remove('disabled');
        btnEl.removeAttribute('tabindex');
        btnEl.removeAttribute('aria-disabled');
      } else {
        btnEl.href = 'javascript:void(0);';
        btnEl.textContent = 'リンク未設定';
        btnEl.classList.add('disabled');
        btnEl.setAttribute('tabindex', '-1');
        btnEl.setAttribute('aria-disabled', 'true');
      }
    });
  }

  // 初期ロード時にアフィリエイトリンクを設定
  setupAffiliateLinks();

  // ドラッグ＆ドロップ関連イベント
  dropZone.addEventListener('click', () => fileInput.click());

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

  changeImageBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
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

  // AI生成リクエスト処理
  generateBtn.addEventListener('click', async () => {
    if (!base64Image) return;

    inputSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    const info = {
      brand: document.getElementById('brand').value,
      category: document.getElementById('category').value,
      size: document.getElementById('size').value,
      purchaseTime: document.getElementById('purchase-time').value,
      condition: document.getElementById('condition').value,
      shipping: document.getElementById('shipping').value,
      hashtags: document.getElementById('hashtags').value,
      notes: document.getElementById('notes').value
    };

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: base64Image, info })
      });

      if (!response.ok) {
        throw new Error('生成に失敗しました。');
      }

      const data = await response.json();
      displayResult(data);

      loadingSection.classList.add('hidden');
      resultSection.classList.remove('hidden');

    } catch (error) {
      alert(error.message || 'エラーが発生しました。もう一度お試しください。');
      loadingSection.classList.add('hidden');
      inputSection.classList.remove('hidden');
    }
  });

  // 生成結果の表示処理
  function displayResult(data) {
    // 1. AI推定価格の表示処理（エラーハンドリング込み）
    const contentEl = document.getElementById('price-estimate-content');
    const errorEl = document.getElementById('price-estimate-error');

    if (data && data.priceEstimate && (data.priceEstimate.recommended || data.priceEstimate.standard)) {
      const formatPrice = (val) => val ? `${Number(val).toLocaleString()}円` : '-';

      document.getElementById('price-quicksell-val').textContent = formatPrice(data.priceEstimate.quickSell);
      document.getElementById('price-standard-val').textContent = formatPrice(data.priceEstimate.standard);
      document.getElementById('price-high-val').textContent = formatPrice(data.priceEstimate.high);
      document.getElementById('price-recommended-val').textContent = formatPrice(data.priceEstimate.recommended || data.priceEstimate.standard);

      contentEl.classList.remove('hidden');
      errorEl.classList.add('hidden');
    } else {
      contentEl.classList.add('hidden');
      errorEl.classList.remove('hidden');
    }

    // 2. 既存アイテムの表示
    document.getElementById('result-title').textContent = data.title || '';
    document.getElementById('result-description').textContent = data.description || '';
    document.getElementById('result-category').textContent = data.category || '未設定';

    const featuresList = document.getElementById('result-features');
    featuresList.innerHTML = '';
    (data.features || []).forEach(feat => {
      const li = document.createElement('li');
      li.textContent = feat;
      featuresList.appendChild(li);
    });

    const renderTags = (elementId, tags) => {
      const container = document.getElementById(elementId);
      container.innerHTML = '';
      (tags || []).forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        container.appendChild(span);
      });
    };

    renderTags('result-keywords', data.keywords);
    renderTags('result-hashtags', data.hashtags);
  }

  // もう一度生成するボタン
  document.getElementById('reset-btn').addEventListener('click', () => {
    resultSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
  });

  // クリップボードコピー処理
  const toast = document.getElementById('toast');
  function showToast(message = 'コピーしました！') {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        navigator.clipboard.writeText(targetEl.textContent);
        showToast();
      }
    });
  });

  document.getElementById('copy-all-btn').addEventListener('click', () => {
    const title = document.getElementById('result-title').textContent;
    const desc = document.getElementById('result-description').textContent;
    const hashtags = Array.from(document.querySelectorAll('#result-hashtags .tag')).map(t => t.textContent).join(' ');

    const fullText = `${title}\n\n${desc}\n\n${hashtags}`;
    navigator.clipboard.writeText(fullText);
    showToast('全文をコピーしました！');
  });
});
