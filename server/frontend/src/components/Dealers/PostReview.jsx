import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "./Dealers.css";
import "../assets/style.css";
import Header from "../Header/Header";

const PostReview = ({ onSubmitted = (dealerId) => window.location.assign(`/dealer/${dealerId}`) }) => {
  const [dealer, setDealer] = useState({});
  const [carModels, setCarModels] = useState([]);
  const [form, setForm] = useState({
    review: "",
    purchase: false,
    purchaseDate: "",
    car: "",
    carYear: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const { id } = useParams();
  const isLoggedIn = sessionStorage.getItem("username") !== null;

  useEffect(() => {
    if (!isLoggedIn) return;

    const loadFormData = async () => {
      setLoading(true);
      setLoadError("");
      setError("");
      try {
        const [dealerResponse, carsResponse] = await Promise.all([
          fetch(`/djangoapp/dealer/${id}`),
          fetch("/djangoapp/get_cars"),
        ]);
        const [dealerData, carsData] = await Promise.all([
          dealerResponse.json(),
          carsResponse.json(),
        ]);

        if (!dealerResponse.ok || dealerData.status !== 200 || !dealerData.dealer?.length) {
          throw new Error(dealerData.error || "Dealer details could not be loaded.");
        }
        if (!carsResponse.ok || !Array.isArray(carsData.CarModels)) {
          throw new Error(carsData.error || "Car models could not be loaded.");
        }
        setDealer(dealerData.dealer[0]);
        setCarModels(carsData.CarModels);
      } catch (requestError) {
        setLoadError(requestError.message || "The review form could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadFormData();
  }, [id, isLoggedIn]);

  const updateField = (event) => {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const postReview = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.review.trim() || !form.purchaseDate || !form.car || !form.carYear) {
      setError("All review details are required.");
      return;
    }

    const [carMake, carModel] = form.car.split("|");
    setSubmitting(true);
    try {
      const response = await fetch("/djangoapp/add_review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealership: Number(id),
          review: form.review.trim(),
          purchase: form.purchase,
          purchase_date: form.purchaseDate,
          car_make: carMake,
          car_model: carModel,
          car_year: Number(form.carYear),
        }),
      });
      const data = await response.json();

      if (!response.ok || data.status !== 200) {
        throw new Error(data.error || "Your review could not be submitted.");
      }
      onSubmitted(id);
    } catch (requestError) {
      setError(requestError.message || "Your review could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="review-form-page">
        <Header />
        <main className="container py-5">
          <div className="auth-callout">
            <h1>Share your experience</h1>
            <p>Please sign in to submit a review.</p>
            <Link className="btn btn-primary" to="/login">Sign in</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="review-form-page">
      <Header />
      <main className="container py-5">
        {loading ? (
          <p className="status-message" role="status">Loading review form…</p>
        ) : loadError ? (
          <div className="alert alert-danger" role="alert">{loadError}</div>
        ) : (
          <section className="review-form-card">
            <p className="eyebrow">Tell other drivers</p>
            <h1>Review {dealer.full_name}</h1>
            <p className="text-muted">Your honest feedback helps customers choose with confidence.</p>

            <form onSubmit={postReview}>
              <div className="mb-4">
                <label className="form-label" htmlFor="review">Your review</label>
                <textarea
                  className="form-control"
                  id="review"
                  name="review"
                  rows="6"
                  value={form.review}
                  onChange={updateField}
                  required
                />
              </div>

              <div className="form-check mb-4">
                <input
                  className="form-check-input"
                  id="purchase"
                  name="purchase"
                  type="checkbox"
                  checked={form.purchase}
                  onChange={updateField}
                />
                <label className="form-check-label" htmlFor="purchase">I purchased a car</label>
              </div>

              <div className="review-form-grid">
                <div>
                  <label className="form-label" htmlFor="purchase-date">Purchase date</label>
                  <input
                    className="form-control"
                    id="purchase-date"
                    name="purchaseDate"
                    type="date"
                    value={form.purchaseDate}
                    onChange={updateField}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" htmlFor="cars">Car make and model</label>
                  <select
                    className="form-select"
                    id="cars"
                    name="car"
                    value={form.car}
                    onChange={updateField}
                    required
                  >
                    <option value="">Choose a car</option>
                    {carModels.map((carModel) => (
                      <option
                        value={`${carModel.CarMake}|${carModel.CarModel}`}
                        key={`${carModel.CarMake}-${carModel.CarModel}`}
                      >
                        {carModel.CarMake} {carModel.CarModel}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="car-year">Car year</label>
                  <input
                    className="form-control"
                    id="car-year"
                    name="carYear"
                    type="number"
                    min="2015"
                    max="2023"
                    value={form.carYear}
                    onChange={updateField}
                    required
                  />
                </div>
              </div>

              {error && <p className="alert alert-danger mt-4" role="alert">{error}</p>}
              <div className="review-form-actions">
                <Link className="btn btn-outline-secondary" to={`/dealer/${id}`}>Cancel</Link>
                <button className="btn btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "Posting…" : "Post review"}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
};

export default PostReview;
