import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "./Dealers.css";
import "../assets/style.css";
import positiveIcon from "../assets/positive.png";
import neutralIcon from "../assets/neutral.png";
import negativeIcon from "../assets/negative.png";
import Header from "../Header/Header";

const Dealer = () => {
  const [dealer, setDealer] = useState({});
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { id } = useParams();

  useEffect(() => {
    const loadDealer = async () => {
      setLoading(true);
      setError("");
      try {
        const [dealerResponse, reviewsResponse] = await Promise.all([
          fetch(`/djangoapp/dealer/${id}`),
          fetch(`/djangoapp/reviews/dealer/${id}`),
        ]);
        const [dealerData, reviewsData] = await Promise.all([
          dealerResponse.json(),
          reviewsResponse.json(),
        ]);

        if (!dealerResponse.ok || dealerData.status !== 200 || !Array.isArray(dealerData.dealer)) {
          throw new Error(dealerData.error || "Dealer details could not be loaded.");
        }
        if (!reviewsResponse.ok || reviewsData.status !== 200 || !Array.isArray(reviewsData.reviews)) {
          throw new Error(reviewsData.error || "Dealer reviews could not be loaded.");
        }
        if (dealerData.dealer.length === 0) {
          throw new Error("This dealership could not be found.");
        }

        setDealer(dealerData.dealer[0]);
        setReviews(reviewsData.reviews);
      } catch (requestError) {
        setError(requestError.message || "Dealer details could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadDealer();
  }, [id]);

  const sentimentIcon = (sentiment) => {
    if (sentiment === "positive") return positiveIcon;
    if (sentiment === "negative") return negativeIcon;
    return neutralIcon;
  };

  const isLoggedIn = sessionStorage.getItem("username") !== null;

  return (
    <div className="dealer-page">
      <Header />
      <main className="container py-5">
        {loading && <p className="status-message" role="status">Loading dealership reviews…</p>}
        {error && <p className="alert alert-danger" role="alert">{error}</p>}
        {!loading && !error && (
          <>
            <section className="dealer-summary">
              <div>
                <p className="eyebrow">Dealership reviews</p>
                <h1>{dealer.full_name}</h1>
                <p className="dealer-address">
                  {dealer.address}, {dealer.city}, {dealer.state} {dealer.zip}
                </p>
              </div>
              {isLoggedIn && (
                <Link className="btn btn-primary" to={`/postreview/${id}`}>
                  Write a review
                </Link>
              )}
            </section>

            <section aria-labelledby="reviews-heading">
              <h2 id="reviews-heading" className="reviews-title">Customer reviews</h2>
              {reviews.length === 0 ? (
                <p className="status-message">No reviews yet. Be the first to share your experience.</p>
              ) : (
                <div className="review-grid">
                  {reviews.map((review) => (
                    <article className="card review-card" key={review.id}>
                      <div className="card-body">
                        <div className="sentiment">
                          <img
                            src={sentimentIcon(review.sentiment)}
                            alt={`${review.sentiment || "neutral"} sentiment`.replace(/^./, (letter) => letter.toUpperCase())}
                          />
                          <span>{review.sentiment || "neutral"}</span>
                        </div>
                        <p className="review-copy">“{review.review}”</p>
                        <p className="reviewer-name">{review.name}</p>
                        <p className="review-car">
                          {review.car_year} {review.car_make} {review.car_model}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Dealer;
