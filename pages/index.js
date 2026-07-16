import { useEffect } from 'react';
import Script from 'next/script';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Home() {
  useEffect(() => {
    const links = document.querySelectorAll('.scrollto');
    links.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = link.getAttribute('href').replace('#', '');
        const el = document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    });
  }, []);

  return (
    <>
      <Header />

      <section className="hero-section">
        <div className="container">
          <div className="row">
            <div className="col-12 col-md-7 pt-5 mb-5 align-self-center">
              <div className="promo pe-md-3 pe-lg-5">
                <h1 className="headline mb-3">Kho Tài Liệu & Công Cụ Cá Nhân</h1>
                <div className="subheadline mb-4">
                  Nơi lưu trữ văn bản luật, công cụ tính toán và tài nguyên phục vụ kế toán – thuế – nhân sự.
                </div>
                <div className="cta-holder row gx-md-3 gy-3 gy-md-0">
                  <div className="col-12 col-md-auto">
                    <a className="btn btn-primary w-100" href="/documents">Văn bản</a>
                  </div>
                  <div className="col-12 col-md-auto">
                    <a className="btn btn-secondary scrollto w-100" href="/tools">Công cụ làm việc</a>
                  </div>
                </div>

                <div className="hero-quotes mt-5">
                  <div id="quotes-carousel" className="quotes-carousel carousel slide carousel-fade mb-5"
                    data-bs-ride="carousel" data-bs-interval="8000">
                    <div className="carousel-indicators">
                      <button type="button" data-bs-target="#quotes-carousel" data-bs-slide-to="0"
                        className="active" aria-current="true" aria-label="Slide 1" />
                      <button type="button" data-bs-target="#quotes-carousel" data-bs-slide-to="1"
                        aria-label="Slide 2" />
                      <button type="button" data-bs-target="#quotes-carousel" data-bs-slide-to="2"
                        aria-label="Slide 3" />
                    </div>
                    <div className="carousel-inner">
                      <div className="carousel-item active">
                        <blockquote className="quote p-4 theme-bg-light">
                          &ldquo;Excellent Book! Add your book reviews here consectetur adipiscing elit.
                          Aliquam euismod nunc porta urna facilisis tempor. Praesent mauris neque,
                          viverra quis erat vitae, auctor imperdiet nisi.&rdquo;
                        </blockquote>
                        <div className="source row gx-md-3 gy-3 gy-md-0 align-items-center">
                          <div className="col-12 col-md-auto text-center text-md-start">
                            <img className="source-profile" src="/assets/images/profiles/profile-1.png" alt="image" />
                          </div>
                          <div className="col source-info text-center text-md-start">
                            <div className="source-name">James Doe</div>
                            <div className="soure-title">Co-Founder, Startup Week</div>
                          </div>
                        </div>
                      </div>
                      <div className="carousel-item">
                        <blockquote className="quote p-4 theme-bg-light">
                          &ldquo;Highly recommended consectetur adipiscing elit. Proin et auctor dolor, sed
                          venenatis massa. Vestibulum ullamcorper lobortis nisi non placerat praesent
                          mauris neque&rdquo;
                        </blockquote>
                        <div className="source row gx-md-3 gy-3 gy-md-0 align-items-center">
                          <div className="col-12 col-md-auto text-center text-md-start">
                            <img className="source-profile" src="/assets/images/profiles/profile-2.png" alt="image" />
                          </div>
                          <div className="col source-info text-center text-md-start">
                            <div className="source-name">Jean Doe</div>
                            <div className="soure-title">Co-Founder, Startup Week</div>
                          </div>
                        </div>
                      </div>
                      <div className="carousel-item">
                        <blockquote className="quote p-4 theme-bg-light">
                          &ldquo;Awesome! Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam
                          euismod nunc porta urna facilisis tempor. Praesent mauris neque, viverra
                          quis erat vitae.&rdquo;
                        </blockquote>
                        <div className="source row gx-md-3 gy-3 gy-md-0 align-items-center">
                          <div className="col-12 col-md-auto text-center text-md-start">
                            <img className="source-profile" src="/assets/images/profiles/profile-3.png" alt="image" />
                          </div>
                          <div className="col source-info text-center text-md-start">
                            <div className="source-name">Andy Doe</div>
                            <div className="soure-title">Frontend Developer, Company Lorem</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-5 mb-5 align-self-center">
              <div className="book-cover-holder">
                <img className="img-fluid book-cover" src="/assets/images/devbook-cover.png" alt="book cover" />
                <div className="book-badge d-inline-block shadow">Quảng cáo</div>
              </div>
              <div className="text-center"><a className="theme-link scrollto" href="#reviews-section">Xem thêm</a></div>
            </div>
          </div>
        </div>
      </section>

      <section id="benefits-section" className="benefits-section theme-bg-light-gradient py-5">
        <div className="container py-5">
          <h2 className="section-heading text-center mb-3">CÁC VĂN BẢN</h2>
          <div className="section-intro single-col-max mx-auto text-center mb-5">
            Kho lưu trữ các văn bản pháp luật thuộc nhiều lĩnh vực khác nhau.
            Nội dung được phân loại để tiện tra cứu và tham khảo. Đây là tập hợp tài liệu phục vụ mục đích cá nhân, không mang tính hướng dẫn hay tư vấn nghiệp vụ.
          </div>
          <div className="row text-center">
            {[
              { cat: 'vat', icon: 'laptop-code', title: 'THUẾ GIÁ TRỊ GIA TĂNG', desc: 'Nhóm văn bản liên quan đến thuế giá trị gia tăng, bao gồm quy định, nghị định, thông tư và các tài liệu pháp lý được ban hành qua từng thời kỳ.' },
              { cat: 'tncn', icon: 'js-square', title: 'THUẾ THU NHẬP CÁ NHÂN', desc: 'Tập hợp các văn bản pháp luật về thuế thu nhập cá nhân. Nội dung bao gồm quy định chung, biểu thuế, các văn bản điều chỉnh và cập nhật theo từng giai đoạn.' },
              { cat: 'tndn', icon: 'rocketchat', title: 'THUẾ THU NHẬP DOANH NGHIỆP', desc: 'Nhóm văn bản liên quan đến thuế thu nhập doanh nghiệp, bao gồm quy định về xác định thu nhập, chi phí, ưu đãi và các văn bản pháp lý liên quan.' },
              { cat: 'bhxh', icon: 'code-branch', title: 'BẢO HIỂM XÃ HỘI', desc: 'Kho văn bản về bảo hiểm xã hội, bảo hiểm y tế và bảo hiểm thất nghiệp. Bao gồm các quy định, quyết định và hướng dẫn chính thức được ban hành.' },
              { cat: null, icon: 'angular', title: 'THUẾ XUẤT NHẬP KHẨU', desc: 'Tổng hợp các văn bản về thuế xuất khẩu – nhập khẩu, biểu thuế, mã hàng hóa và các quy định pháp lý liên quan đến hoạt động xuất nhập khẩu' },
              { cat: null, icon: 'hand-holding-usd', title: 'HẢI QUAN', desc: 'Nhóm văn bản liên quan đến lĩnh vực hải quan, bao gồm thủ tục, quy định quản lý, giám sát và các văn bản pháp lý khác.' },
            ].map((item, i) => (
              <div key={i} className="item col-12 col-md-6 col-lg-4">
                <div className="item-inner p-3 p-lg-4">
                  <div className="item-header mb-3">
                    <div className="item-icon"><i className={`fas fa-${item.icon}`} /></div>
                    <h3 className="item-heading">
                      {item.cat ? (
                        <a className="text-reset text-decoration-none" href={`/category?cat=${item.cat}`}>{item.title}</a>
                      ) : item.title}
                    </h3>
                  </div>
                  <div className="item-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="content-section" className="content-section">
        <div className="container">
          <div className="single-col-max mx-auto">
            <h2 className="section-heading text-center mb-5">Nội dung trong mục này</h2>
            <div className="row">
              <div className="col-12 col-md-6">
                <div className="figure-holder mb-5">
                  <img className="img-fluid" src="/assets/images/devbook-devices.png" alt="image" />
                </div>
              </div>
              <div className="col-12 col-md-6 mb-5">
                <div className="key-points mb-4 text-center">
                  <ul className="key-points-list list-unstyled mb-4 mx-auto d-inline-block text-start">
                    <li><i className="fas fa-check-circle me-2" />Danh sách văn bản pháp luật được phân loại theo từng lĩnh vực.</li>
                    <li><i className="fas fa-check-circle me-2" />Thông tin cơ bản của văn bản: số hiệu, ngày ban hành, cơ quan ban hành.</li>
                    <li><i className="fas fa-check-circle me-2" />Tag để hỗ trợ lọc và phân nhóm tài liệu.</li>
                    <li><i className="fas fa-check-circle me-2" />Ghi chú cá nhân (nếu có) để tiện theo dõi.</li>
                    <li><i className="fas fa-check-circle me-2" />Praesent molestie odio risus.</li>
                    <li><i className="fas fa-check-circle me-2" />Liên kết mở văn bản gốc từ nguồn chính thức.</li>
                    <li><i className="fas fa-check-circle me-2" />File PDF/Word của các văn bản.</li>
                    <li><i className="fas fa-check-circle me-2" />.....</li>
                  </ul>
                  <div className="text-center">
                    <a className="btn btn-primary" href="https://themes.3rdwavemedia.com/bootstrap-templates/startup/devbook-free-bootstrap-5-book-ebook-landing-page-template-for-developers/">Xem danh sách văn bản</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="audience-section" className="audience-section py-5">
        <div className="container">
          <h2 className="section-heading text-center mb-4">Phạm vi sử dụng</h2>
          <div className="section-intro single-col-max mx-auto text-center mb-5">
            Kho tài liệu này được xây dựng nhằm phục vụ nhu cầu lưu trữ và tham khảo cá nhân.
            Nội dung không mang tính tư vấn chuyên môn, không thay thế văn bản chính thức và không phục vụ mục đích thương mại.
            Bất kỳ ai quan tâm đến các văn bản pháp luật đều có thể sử dụng thông tin theo nhu cầu riêng.
          </div>
          <div className="audience mx-auto">
            {[
              { icon: 'user-check', title: 'Người làm kế toán', desc: 'Tra cứu văn bản theo từng lĩnh vực để thuận tiện cho việc theo dõi quy định. Thông tin được trình bày trung tính, không hướng dẫn nghiệp vụ.' },
              { icon: 'user-check', title: 'Người làm thuế', desc: 'Xem nhanh các văn bản liên quan đến thuế VAT, TNCN, TNDN và các nhóm khác. Phục vụ mục đích tham khảo cá nhân, không phải tài liệu tư vấn.' },
              { icon: 'user-check', title: 'Người làm nhân sự', desc: 'Theo dõi các văn bản về BHXH, BHYT, BHTN khi cần tham khảo thông tin. Không cung cấp hướng dẫn xử lý tình huống hay nghiệp vụ.' },
              { icon: 'user-check', title: 'Người quan tâm pháp luật', desc: 'Tìm kiếm và đọc văn bản theo chủ đề một cách thuận tiện. Nội dung chỉ mang tính tổng hợp và lưu trữ cá nhân.' },
            ].map((item, i) => (
              <div key={i} className="item row gx-3">
                <div className="col-auto item-icon"><i className={`fas fa-${item.icon}`} /></div>
                <div className="col">
                  <h4 className="item-title">{item.title}</h4>
                  <div className="item-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="form-section" className="form-section">
        <div className="container">
          <div className="lead-form-wrapper single-col-max mx-auto theme-bg-light rounded p-5">
            <h2 className="form-heading text-center">Đóng góp & Liên hệ</h2>
            <div className="form-intro text-center mb-3">
              Nếu bạn có tài liệu muốn chia sẻ, góp ý về nội dung, hoặc cần liên hệ, bạn có thể gửi email cho tôi.
              Trang này chỉ phục vụ mục đích cá nhân và lưu trữ thông tin, không cung cấp dịch vụ hay tư vấn.
            </div>
            <div className="form-wrapper mx-auto">
              <form className="signup-form row g-2 align-items-center">
                <div className="col-12 col-lg-9">
                  <label className="sr-only" htmlFor="semail">Email</label>
                  <input type="email" id="semail" name="semail1" className="form-control me-md-1 semail" placeholder="Your email" />
                </div>
                <div className="col-12 col-lg-3">
                  <button type="submit" className="btn btn-primary btn-submit w-100">Send</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
