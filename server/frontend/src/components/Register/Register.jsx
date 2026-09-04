import React, { useState } from "react";

import Header from "../Header/Header";
import "./Register.css";


const Register = ({ onRegistered = () => window.location.assign("/") }) => {
  const [form, setForm] = useState({
    userName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const updateField = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const register = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch("/djangoapp/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userName: form.userName,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await response.json();

      if (response.ok && data.status === "Authenticated") {
        sessionStorage.setItem("username", data.userName);
        onRegistered(data.userName);
        return;
      }

      setError(data.error || "The account could not be created.");
    } catch (requestError) {
      setError("The account could not be created.");
    }
  };

  return (
    <div>
      <Header />
      <main className="register_container">
        <h1 className="header">Create account</h1>
        <form className="inputs" onSubmit={register}>
          <label className="input" htmlFor="username">Username</label>
          <input className="input_field" id="username" name="userName" value={form.userName} onChange={updateField} required />

          <label className="input" htmlFor="first-name">First Name</label>
          <input className="input_field" id="first-name" name="firstName" value={form.firstName} onChange={updateField} required />

          <label className="input" htmlFor="last-name">Last Name</label>
          <input className="input_field" id="last-name" name="lastName" value={form.lastName} onChange={updateField} required />

          <label className="input" htmlFor="email">Email</label>
          <input className="input_field" id="email" name="email" type="email" value={form.email} onChange={updateField} required />

          <label className="input" htmlFor="password">Password</label>
          <input className="input_field" id="password" name="password" type="password" value={form.password} onChange={updateField} required />

          <label className="input" htmlFor="confirm-password">Confirm Password</label>
          <input className="input_field" id="confirm-password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={updateField} required />

          {error && <p role="alert">{error}</p>}
          <div className="submit_panel">
            <button className="submit" type="submit">Register</button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Register;
