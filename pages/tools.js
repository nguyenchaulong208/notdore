import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Tools() {
  return (
    <>
      <Header />
      <section className="hero-section">
        <div className="container">
          <div className="row">
            <div className="col-12 pt-5 mb-5 text-center">
              <h1 className="headline mb-3">Công cụ làm việc</h1>
              <div className="subheadline mb-4">Tính lương, tính thuế, tra cứu — đang phát triển.</div>
              <div className="text-muted">Chức năng sẽ được cập nhật sau.</div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
