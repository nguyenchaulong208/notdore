export default function Header() {
  return (
    <header className="header">
      <div className="branding">
        <div className="container-fluid position-relative py-3">
          <div className="logo-wrapper">
            <div className="site-logo">
              <a className="navbar-brand" href="/">
                <img className="logo-icon me-2" src="/assets/images/site-logo.svg" alt="logo" />
                <span className="logo-text">NotDore</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
