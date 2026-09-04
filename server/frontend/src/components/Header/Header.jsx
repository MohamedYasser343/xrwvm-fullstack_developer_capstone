import React from 'react';
import "../assets/style.css";
import "../assets/bootstrap.min.css";

const Header = () => {
    const logout = async (e) => {
      e.preventDefault();
      const response = await fetch("/djangoapp/logout");

      if (response.ok) {
        sessionStorage.removeItem("username");
        window.location.assign("/");
      } else {
        alert("The user could not be logged out.");
      }
    };

    const currentUser = sessionStorage.getItem("username");
    const accountItems = currentUser ? (
      <div className="input_panel">
        <span className="username">{currentUser}</span>
        <a className="nav_item" href="/djangoapp/logout" onClick={logout}>Logout</a>
      </div>
    ) : (
      <div className="input_panel">
        <a className="nav_item" href="/login">Login</a>
        <a className="nav_item" href="/register">Register</a>
      </div>
    );

    return (
        <div>
          <nav className="navbar navbar-expand-lg navbar-light" style={{backgroundColor:"darkturquoise",height:"1in"}}>
            <div className="container-fluid">
              <h2 style={{paddingRight: "5%"}}>Dealerships</h2>
              <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarText" aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
              </button>
              <div className="collapse navbar-collapse" id="navbarText">
                <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                  <li className="nav-item">
                    <a className="nav-link active" style={{fontSize: "larger"}} aria-current="page" href="/">Home</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" style={{fontSize: "larger"}} href="/about">About Us</a>
                  </li>
                  <li className="nav-item">
                    <a className="nav-link" style={{fontSize: "larger"}} href="/contact">Contact Us</a>
                  </li>
                </ul>
                <span className="navbar-text">
                  <div className="loginlink" id="loginlogout">
                  {accountItems}
                  </div>
                </span>
              </div>
            </div>
          </nav>
        </div>
    )
}

export default Header
