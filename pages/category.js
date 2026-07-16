import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Header from '../components/Header';
import Footer from '../components/Footer';

const ICONS = ['file-alt', 'gavel', 'book', 'file-invoice', 'exchange-alt', 'percent', 'file-contract', 'envelope', 'chart-line', 'hand-holding-heart', 'star', 'calculator'];

const TAG_MAP = {
  vat: 'thue-gtgt', tncn: 'thue-tncn',
  tndn: 'thue-tndn', bhxh: 'bhxh',
};

const CATEGORY_INFO = {
  vat: {
    title: 'Thuế Giá Trị Gia Tăng', short: 'Thuế VAT',
    description: 'Tổng hợp các văn bản pháp luật về thuế giá trị gia tăng (VAT), bao gồm Luật, Nghị định, Thông tư hướng dẫn và các tài liệu liên quan.',
    overview: [
      'Thuế giá trị gia tăng (VAT) là thuế tính trên giá trị tăng thêm của hàng hóa, dịch vụ.',
      'Đối tượng chịu thuế: hàng hóa, dịch vụ sản xuất, kinh doanh và nhập khẩu.',
      'Các mức thuế suất: 0%, 5%, 10% (thuế suất cơ bản).',
      'Phương pháp tính: khấu trừ thuế và tính trực tiếp.',
      'Đối tượng không chịu thuế: 26 nhóm hàng hóa, dịch vụ theo quy định.',
      'Văn bản hiện hành: Luật số 13/2008/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'building', title: 'Doanh nghiệp sản xuất, kinh doanh', desc: 'Áp dụng cho tất cả doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế GTGT.' },
      { icon: 'user-tie', title: 'Hộ kinh doanh cá thể', desc: 'Hộ kinh doanh có doanh thu từ 100 triệu đồng/năm trở lên phải nộp thuế GTGT.' },
      { icon: 'ship', title: 'Tổ chức, cá nhân nhập khẩu', desc: 'Tổ chức, cá nhân nhập khẩu hàng hóa chịu thuế GTGT phải kê khai và nộp thuế GTGT hàng nhập khẩu.' },
    ],
  },
  tncn: {
    title: 'Thuế Thu Nhập Cá Nhân', short: 'Thuế TNCN',
    description: 'Tổng hợp các văn bản pháp luật về thuế thu nhập cá nhân (TNCN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.',
    overview: [
      'Thuế thu nhập cá nhân là thuế đánh vào thu nhập của cá nhân phát sinh trong kỳ tính thuế.',
      'Đối tượng nộp thuế: cá nhân cư trú và cá nhân không cư trú có thu nhập chịu thuế.',
      'Biểu thuế lũy tiến từng phần: 7 bậc thuế từ 5% đến 35%.',
      'Mức giảm trừ gia cảnh: 11 triệu đồng/tháng đối với người nộp thuế.',
      'Các khoản thu nhập được miễn thuế theo quy định của pháp luật.',
      'Văn bản hiện hành: Luật số 04/2007/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'user-tie', title: 'Người lao động làm công hưởng lương', desc: 'Thu nhập từ tiền lương, tiền công và các khoản thu nhập tương tự phải kê khai và nộp thuế TNCN.' },
      { icon: 'chart-pie', title: 'Cá nhân kinh doanh', desc: 'Cá nhân sản xuất, kinh doanh hàng hóa, dịch vụ thuộc đối tượng nộp thuế TNCN theo quy định.' },
      { icon: 'home', title: 'Cá nhân có thu nhập từ đầu tư vốn, chuyển nhượng', desc: 'Thu nhập từ đầu tư vốn, chuyển nhượng bất động sản, chuyển nhượng vốn và các khoản thu nhập khác.' },
    ],
  },
  tndn: {
    title: 'Thuế Thu Nhập Doanh Nghiệp', short: 'Thuế TNDN',
    description: 'Tổng hợp các văn bản pháp luật về thuế thu nhập doanh nghiệp (TNDN), bao gồm Luật, Nghị định, Thông tư và các hướng dẫn liên quan.',
    overview: [
      'Thuế thu nhập doanh nghiệp là thuế đánh trên thu nhập chịu thuế của doanh nghiệp.',
      'Thu nhập chịu thuế bao gồm thu nhập từ hoạt động sản xuất, kinh doanh và thu nhập khác.',
      'Thuế suất phổ thông: 20% (áp dụng cho hầu hết doanh nghiệp).',
      'Ưu đãi thuế TNDN cho doanh nghiệp trong các lĩnh vực, địa bàn ưu đãi đầu tư.',
      'Các khoản chi phí được trừ và không được trừ khi tính thuế.',
      'Văn bản hiện hành: Luật số 14/2008/QH12 và các văn bản sửa đổi, bổ sung.',
    ],
    audience: [
      { icon: 'building', title: 'Doanh nghiệp trong nước', desc: 'Mọi doanh nghiệp Việt Nam thuộc mọi thành phần kinh tế đều thuộc đối tượng nộp thuế TNDN.' },
      { icon: 'globe', title: 'Doanh nghiệp có vốn đầu tư nước ngoài', desc: 'Doanh nghiệp FDI hoạt động tại Việt Nam chịu thuế TNDN theo quy định, bao gồm cả các ưu đãi đầu tư.' },
      { icon: 'landmark', title: 'Tổ chức khác có hoạt động sản xuất, kinh doanh', desc: 'Các tổ chức khác ngoài doanh nghiệp có hoạt động sản xuất, kinh doanh hàng hóa, dịch vụ chịu thuế TNDN.' },
    ],
  },
  bhxh: {
    title: 'Bảo Hiểm Xã Hội', short: 'BHXH',
    description: 'Tổng hợp các văn bản pháp luật về bảo hiểm xã hội (BHXH), bảo hiểm y tế (BHYT) và bảo hiểm thất nghiệp (BHTN).',
    overview: [
      'Bảo hiểm xã hội là sự bảo đảm thay thế hoặc bù đắp một phần thu nhập cho người lao động.',
      'Các chế độ BHXH bắt buộc: ốm đau, thai sản, tai nạn lao động, hưu trí, tử tuất.',
      'Mức đóng BHXH bắt buộc: 32% (21.5% từ người sử dụng lao động, 10.5% từ người lao động).',
      'Bảo hiểm y tế: mức đóng 4.5% (3% từ người sử dụng lao động, 1.5% từ người lao động).',
      'Bảo hiểm thất nghiệp: mức đóng 2% (1% từ người sử dụng lao động, 1% từ người lao động).',
      'Văn bản hiện hành: Luật BHXH số 58/2014/QH13 và Luật sửa đổi số 28/2024/QH15.',
    ],
    audience: [
      { icon: 'users', title: 'Người lao động', desc: 'Người lao động làm việc theo hợp đồng lao động từ đủ 01 tháng trở lên thuộc đối tượng tham gia BHXH bắt buộc.' },
      { icon: 'building', title: 'Người sử dụng lao động', desc: 'Doanh nghiệp, cơ quan, tổ chức, hợp tác xã, hộ kinh doanh có thuê mướn lao động.' },
      { icon: 'hand-holding-heart', title: 'Người tham gia BHXH tự nguyện', desc: 'Công dân Việt Nam từ đủ 15 tuổi trở lên không thuộc đối tượng tham gia BHXH bắt buộc có thể tham gia BHXH tự nguyện.' },
    ],
  },
};

export default function Category() {
  const router = useRouter();
  const { cat } = router.query;
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const info = CATEGORY_INFO[cat];

  useEffect(() => {
    if (!cat) return;
    if (!info) { router.replace('/'); return; }

    (async () => {
      try {
        const envRes = await fetch('/api/env');
        const { url: supabaseUrl, key: supabaseKey } = await envRes.json();

        if (!supabaseUrl || !supabaseKey) {
          setError('SUPABASE_URL hoặc SUPABASE_ANON_KEY chưa được cấu hình.');
          return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const tagName = TAG_MAP[cat];
        const { data: tag } = await supabase.from('document_tags').select('id').eq('name', tagName).single();

        if (!tag) { setDocs([]); setLoading(false); return; }

        const { data: mapping } = await supabase.from('document_tag_map').select('document_id').eq('tag_id', tag.id);
        if (!mapping || !mapping.length) { setDocs([]); setLoading(false); return; }

        const ids = mapping.map(m => m.document_id);
        const { data: docsData } = await supabase.from('documents').select('id, code, title').in('id', ids);
        setDocs(docsData || []);
      } catch (err) {
        setError('Không thể kết nối Supabase.');
      } finally {
        setLoading(false);
      }
    })();
  }, [cat]);

  if (!cat || loading) {
    return (
      <>
        <Header />
        <div className="loading text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">Đang tải...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <section className="hero-section">
          <div className="container">
            <div className="row">
              <div className="col-12 error-msg text-center py-5">
                <i className="fas fa-exclamation-triangle" style={{ fontSize: '2rem', color: '#dc3545' }} />
                <p className="mt-2">{error}</p>
                <a className="btn btn-primary" href="/">Về trang chủ</a>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  const sidebarDocs = docs.slice(0, 6);

  return (
    <>
      <Header />

      <section className="hero-section">
        <div className="container">
          <div className="row">
            <div className="col-12 col-md-7 pt-5 mb-5 align-self-center">
              <div className="promo pe-md-3 pe-lg-5">
                <h1 className="headline mb-3">{info.title}</h1>
                <div className="subheadline mb-4">{info.description}</div>
                <div className="cta-holder row gx-md-3 gy-3 gy-md-0">
                  <div className="col-12 col-md-auto">
                    <a className="btn btn-primary w-100 scrollto" href="#documents-section">Danh sách văn bản</a>
                  </div>
                  <div className="col-12 col-md-auto">
                    <a className="btn btn-secondary scrollto w-100" href="#info-section">Tổng quan</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-5 mb-5 align-self-center">
              <div className="doc-list-wrapper" style={{ background: '#fff', borderRadius: '0.5rem', boxShadow: '0 5px 20px -4px rgba(0,0,0,0.08)', padding: '1rem' }}>
                <div className="list-title" style={{ fontSize: '0.95rem', fontWeight: 'bold', fontFamily: "'Quicksand',sans-serif", color: '#ed6524', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #ed6524' }}>
                  <i className="fas fa-file-alt me-2" />Văn bản mới nhất
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {sidebarDocs.map((d, i) => (
                    <li key={i} style={{ padding: '0.625rem 1rem', borderBottom: '1px solid #e9ecef', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <i className="fas fa-file-alt me-2" style={{ color: '#ed6524', fontSize: '0.75rem' }} />
                      <span style={{ fontWeight: 700, fontFamily: "'Quicksand',sans-serif", color: '#1c1e2e', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>{d.code}</span>
                      <span style={{ color: '#4c527d', fontSize: '0.85rem', lineHeight: 1.4 }}>{d.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="info-section" className="content-section">
        <div className="container">
          <div className="single-col-max mx-auto">
            <h2 className="section-heading text-center mb-5">Tổng quan về {info.title}</h2>
            <div className="row">
              <div className="col-12 mb-5">
                <div className="key-points mb-4 text-center">
                  <ul className="key-points-list list-unstyled mb-4 mx-auto d-inline-block text-start">
                    {info.overview.map((p, i) => (
                      <li key={i}><i className="fas fa-check-circle me-2" />{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="documents-section" className="benefits-section theme-bg-light-gradient py-5">
        <div className="container py-5">
          <h2 className="section-heading text-center mb-3">VĂN BẢN {info.short.toUpperCase()}</h2>
          <div className="section-intro single-col-max mx-auto text-center mb-5">
            Danh sách văn bản được cập nhật theo thời gian.
          </div>
          <div className="row text-center">
            {docs.length === 0 ? (
              <div className="col-12"><p className="text-muted">Chưa có văn bản nào.</p></div>
            ) : docs.map((d, i) => (
              <div key={d.id} className="item col-12 col-md-6 col-lg-4">
                <div className="item-inner p-3 p-lg-4">
                  <div className="item-header mb-3">
                    <div className="item-icon"><i className={`fas fa-${ICONS[i % ICONS.length]}`} /></div>
                    <h3 className="item-heading">{d.code}</h3>
                  </div>
                  <div className="item-desc">{d.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="audience-section" className="audience-section py-5">
        <div className="container">
          <h2 className="section-heading text-center mb-4">Đối tượng áp dụng</h2>
          <div className="section-intro single-col-max mx-auto text-center mb-5">
            {info.title} áp dụng cho các đối tượng theo quy định của pháp luật.
          </div>
          <div className="audience mx-auto">
            {info.audience.map((a, i) => (
              <div key={i} className="item row gx-3">
                <div className="col-auto item-icon"><i className={`fas fa-${a.icon}`} /></div>
                <div className="col">
                  <h4 className="item-title">{a.title}</h4>
                  <div className="item-desc">{a.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
