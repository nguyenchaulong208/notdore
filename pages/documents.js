import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Documents() {
  return (
    <>
      <Header />
      <section className="hero-section">
        <div className="container">
          <div className="row">
            <div className="col-12 pt-5 mb-5 text-center">
              <h1 className="headline mb-3">Danh sách văn bản</h1>
              <div className="subheadline mb-4">Chọn danh mục để xem văn bản theo từng lĩnh vực.</div>
              <div className="row justify-content-center">
                {[
                  { cat: 'vat', label: 'Thuế GTGT' },
                  { cat: 'tncn', label: 'Thuế TNCN' },
                  { cat: 'tndn', label: 'Thuế TNDN' },
                  { cat: 'bhxh', label: 'BHXH' },
                ].map(item => (
                  <div key={item.cat} className="col-12 col-md-3 mb-3">
                    <a className="btn btn-primary w-100" href={`/category?cat=${item.cat}`}>{item.label}</a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
