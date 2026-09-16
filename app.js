let selectedBase64Image = null;
let selectedMimeType = null;
let generatedData = null;

// HTML要素の取得
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadPlaceholder = document.getElementById('upload-placeholder');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const changeImageBtn = document.getElementById('change-image-btn');
const generateBtn = document.getElementById('generate-btn');

const inputSection = document.getElementById('input-section');
const loadingSection = document.getElementById('loading-section');
const resultSection = document.getElementById('result-section');
const resetBtn = document.getElementById('reset-btn');
const copyAllBtn = document.getElementById('copy-all-btn');
const toast = document.getElementById('toast');

// ドラッグ＆ドロップ処理
dropZone.addEventListener('click', (e) => {
  if (e.target !== changeImageBtn) fileInput.click();
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
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length) {
    handleFile(e.target.files[0]);
  }
});

changeImageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// ファイルを読み込んでBase64形式に変換
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください。');
    return;
  }

  selectedMimeType = file.type;
  const reader = new FileReader();

  reader.onload = (e) => {
    const fullBase64 = e.target.result;
    selectedBase64Image = fullBase64.split(',')[1];
    imagePreview.src = fullBase64;
    uploadPlaceholder.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    generateBtn.disabled = false;
  };

  reader.readAsDataURL(file);
}

// AI生成リクエスト
generateBtn.addEventListener('click', async () => {
  if (!selectedBase64Image) return;

  // 画面表示の切り替え
  inputSection.classList.add('hidden');
  loadingSection.classList.remove('hidden');

  // 入力された補足情報を取得
  const userInput = {
    brand: document.getElementById('brand').value.trim(),
    size: document.getElementById('size').value.trim(),
    purchaseTime: document.getElementById('purchase-time').value.trim(),
    condition: document.getElementById('condition').value.trim(),
    notes: document.getElementById('notes').value.trim(),
  };

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: selectedBase64Image,
        mimeType: selectedMimeType,
        userInput: userInput
      })
    });

    if (!response.ok) {
      throw new Error('AIの処理中にエラーが発生しました。');
    }

    generatedData = await response.json();
    renderResult(generatedData);

    loadingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');

  } catch (error) {
    alert(error.message);
    loadingSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
  }
});

// 生成結果を画面に描画
function renderResult(data) {
  document.getElementById('result-title').textContent = data.title || '';
  document.getElementById('result-description').textContent = data.description || '';
  document.getElementById('result-category').textContent = data.category || '';

  const featuresList = document.getElementById('result-features');
  featuresList.innerHTML = '';
  (data.features || []).forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    featuresList.appendChild(li);
  });

  const keywordsContainer = document.getElementById('result-keywords');
  keywordsContainer.innerHTML = '';
  (data.keywords || []).forEach(word => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = word;
    keywordsContainer.appendChild(span);
  });

  const hashtagsContainer = document.getElementById('result-hashtags');
  hashtagsContainer.innerHTML = '';
  (data.hashtags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    hashtagsContainer.appendChild(span);
  });
}

// 個別コピー機能
document.querySelectorAll('.copy-btn').forEach(button => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    let textToCopy = '';

    if (targetId === 'result-keywords') {
      textToCopy = (generatedData?.keywords || []).join(' ');
    } else if (targetId === 'result-hashtags') {
      textToCopy = (generatedData?.hashtags || []).join(' ');
    } else {
      textToCopy = document.getElementById(targetId).textContent;
    }

    copyToClipboard(textToCopy);
  });
});

// 全文コピー機能
copyAllBtn.addEventListener('click', () => {
  if (!generatedData) return;
  const fullText = `${generatedData.title}

${generatedData.description}

【検索キーワード】
${(generatedData.keywords || []).join(' ')}

${(generatedData.hashtags || []).join(' ')}`;

  copyToClipboard(fullText);
});

// もう一度生成
resetBtn.addEventListener('click', () => {
  resultSection.classList.add('hidden');
  inputSection.classList.remove('hidden');
});

// クリップボードへコピー＆通知表示
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
  });
}