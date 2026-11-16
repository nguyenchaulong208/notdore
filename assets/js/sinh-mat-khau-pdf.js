const $ = (id) => document.getElementById(id);

  const CHARS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  function generatePassword(length, charset) {
    let pwd = '';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      pwd += charset[arr[i] % charset.length];
    }
    return pwd;
  }

  function getCharset() {
    let charset = '';
    if ($('pwd-upper').checked) charset += CHARS.upper;
    if ($('pwd-lower').checked) charset += CHARS.lower;
    if ($('pwd-numbers').checked) charset += CHARS.numbers;
    if ($('pwd-symbols').checked) charset += CHARS.symbols;
    return charset;
  }

  let generatedPasswords = [];

  $('generate-btn').addEventListener('click', () => {
    const length = parseInt($('pwd-length').value) || 12;
    const count = parseInt($('pwd-count').value) || 1;
    const charset = getCharset();

    if (!charset) {
      alert('Vui lòng chọn ít nhất một loại ký tự.');
      return;
    }
    if (length < 4 || length > 128) {
      alert('Độ dài phải từ 4 đến 128 ký tự.');
      return;
    }

    generatedPasswords = [];
    for (let i = 0; i < count; i++) {
      generatedPasswords.push(generatePassword(length, charset));
    }

    const list = $('password-list');
    list.innerHTML = generatedPasswords.map((p, i) => `
      <div class="nd-cell-flex">
        <span class="nd-index">${i + 1}.</span>
        <span class="nd-flex-1 nd-break">${p}</span>
        <button class="copy-one nd-btn-icon nd-btn-icon--accent" data-idx="${i}" title="Copy">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    `).join('');

    list.querySelectorAll('.copy-one').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        navigator.clipboard.writeText(generatedPasswords[idx]).then(() => {
          e.currentTarget.innerHTML = '<i class="fas fa-check nd-text-success"></i>';
          setTimeout(() => { e.currentTarget.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
        });
      });
    });

    $('results-wrap').style.display = 'block';
  });

  $('copy-all-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(generatedPasswords.join('\n')).then(() => {
      $('copy-all-btn').innerHTML = '<i class="fas fa-check me-1"></i> Đã copy';
      setTimeout(() => { $('copy-all-btn').innerHTML = '<i class="fas fa-copy me-1"></i> Copy tất cả'; }, 1500);
    });
  });

  $('export-txt-btn').addEventListener('click', () => {
    const content = generatedPasswords.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'passwords.txt';
    a.click();
    URL.revokeObjectURL(url);
  });