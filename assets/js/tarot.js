// Tarot Major Arcana - 22 lá bài
const TAROT_CARDS = [
  { name: 'The Fool', vi: 'Kẻ Khờ', meaning: 'Khởi đầu mới, tự do, phiêu lưu. Hãy tin vào bản thân và bước về phía trước mà không sợ hãi.' },
  { name: 'The Magician', vi: 'Ảo Thuật Gia', meaning: 'Sáng tạo, ý chí, tài năng. Bạn có đầy đủ nguồn lực để biến ước mơ thành hiện thực.' },
  { name: 'The High Priestess', vi: 'Nữ Tư Tế', meaning: 'Trực giác, bí ẩn, tiềm thức. Hãy lắng nghe giọng nói bên trong bạn.' },
  { name: 'The Empress', vi: 'Nữ Hoàng', meaning: 'Sáng tạo, phong phú, nuôi dưỡng. Năng lượng nữ tính và sự tăng trưởng đang đến.' },
  { name: 'The Emperor', vi: 'Hoàng Đế', meaning: 'Quyền lực, cấu trúc, ổn định. Hãy thiết lập trật tự và kiểm soát tình huống.' },
  { name: 'The Hierophant', vi: 'Giáo Hoàng', meaning: 'Truyền thống, niềm tin, hướng dẫn. Hãy tìm kiếm lời khuyên từ người có kinh nghiệm.' },
  { name: 'The Lovers', vi: 'Những Người Yêu', meaning: 'Tình yêu, lựa chọn, sự hài hòa. Một quyết định quan trọng đang chờ bạn.' },
  { name: 'The Chariot', vi: 'Xe Ngựa', meaning: 'Chiến thắng, quyết tâm, kiểm soát. Hãy tập trung và tiến về phía trước.' },
  { name: 'Strength', vi: 'Sức Mạnh', meaning: 'Can đảm, kiên nhẫn, sức mạnh nội tâm. Bạn mạnh hơn những gì bạn nghĩ.' },
  { name: 'The Hermit', vi: 'Ẩn Sĩ', meaning: 'Chiêm nghiệm, cô độc, tìm kiếm. Hãy dành thời gian cho bản thân và suy ngẫm.' },
  { name: 'Wheel of Fortune', vi: 'Bánh Xe Vận Mệnh', meaning: 'Thay đổi, chu kỳ, vận may. Một bước ngoặt đang đến.' },
  { name: 'Justice', vi: 'Công Lý', meaning: 'Công bằng, sự thật, trách nhiệm. Hãy hành động với chính trực.' },
  { name: 'The Hanged Man', vi: 'Người Bị Treo', meaning: 'Tạm dừng, buông bỏ, góc nhìn mới. Đôi khi cần nhìn từ một góc khác.' },
  { name: 'Death', vi: 'Cái Chết', meaning: 'Kết thúc, chuyển đổi, tái sinh. Một chương cũ đang khép lại để mở ra chương mới.' },
  { name: 'Temperance', vi: 'Điều Độ', meaning: 'Cân bằng, điều hòa, kiên nhẫn. Hãy tìm sự cân bằng trong cuộc sống.' },
  { name: 'The Devil', vi: 'Ác Quỷ', meaning: 'Ràng buộc, cám dỗ, vật chất. Hãy nhận ra những xích xiềng tự đặt ra.' },
  { name: 'The Tower', vi: 'Tháp', meaning: 'Biến động, thức tỉnh, giải phóng. Một sự thay đổi đột ngột nhưng cần thiết.' },
  { name: 'The Star', vi: 'Ngôi Sao', meaning: 'Hy vọng, cảm hứng, chữa lành. Ánh sáng đang dẫn đường cho bạn.' },
  { name: 'The Moon', vi: 'Mặt Trăng', meaning: 'Ảo giác, sợ hãi, tiềm thức. Hãy cẩn thận với những gì bạn không thấy rõ.' },
  { name: 'The Sun', vi: 'Mặt Trời', meaning: 'Thành công, niềm vui, sự sống. Năng lượng tích cực đang bao quanh bạn.' },
  { name: 'Judgement', vi: 'Phán Xét', meaning: 'Thức tỉnh, đánh giá, tái sinh. Hãy lắng nghe tiếng gọi của bản thân.' },
  { name: 'The World', vi: 'Thế Giới', meaning: 'Hoàn thành, thành tựu, tổng kết. Bạn đã hoàn thành một chu kỳ quan trọng.' },
];

function drawTarot() {
  const card = TAROT_CARDS[Math.floor(Math.random() * TAROT_CARDS.length)];
  const isReversed = Math.random() < 0.5;
  const nameEl = document.getElementById('tarot-name');
  const meaningEl = document.getElementById('tarot-meaning');
  const hintEl = document.getElementById('tarot-hint');
  const cardEl = document.getElementById('tarot-card');

  if (nameEl) nameEl.textContent = `${card.vi} (${card.name})${isReversed ? ' — Ngược' : ''}`;
  if (meaningEl) meaningEl.textContent = card.meaning + (isReversed ? ' (Ngược: ý nghĩa bị đảo ngược hoặc bị chặn lại.)' : '');
  if (hintEl) hintEl.textContent = isReversed ? 'Lá bài ngược' : 'Lá bài xuôi';
  if (cardEl) {
    cardEl.classList.add('nd-tarot-flip');
    setTimeout(() => cardEl.classList.remove('nd-tarot-flip'), 600);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('tarot-draw');
  if (btn) btn.addEventListener('click', drawTarot);
  const card = document.getElementById('tarot-card');
  if (card) card.addEventListener('click', drawTarot);
});