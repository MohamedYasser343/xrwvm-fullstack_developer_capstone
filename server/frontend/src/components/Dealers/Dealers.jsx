import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./Dealers.css";
import "../assets/style.css";
import Header from "../Header/Header";
import reviewIcon from "../assets/reviewicon.png";

const Dealers = () => {
  const [dealers, setDealers] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDealers = async (state = "All") => {
    setLoading(true);
    setError("");

    try {
      const url = state === "All"
        ? "/djangoapp/get_dealers"
        : `/djangoapp/get_dealers/${encodeURIComponent(state)}`;
      const response = await fetch(url, { method: "GET" });
      const data = await response.json();

      if (!response.ok || data.status !== 200 || !Array.isArray(data.dealers)) {
        throw new Error(data.error || "Dealerships could not be loaded.");
      }

      setDealers(data.dealers);
      if (state === "All") {
        setStates(
          [...new Set(data.dealers.map((dealer) => dealer.state))]
            .filter(Boolean)
            .sort(),
        );
      }
    } catch (requestError) {
      setDealers([]);
      setError(requestError.message || "Dealerships could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDealers();
  }, []);

  const filterDealers = (event) => {
    const state = event.target.value;
    setSelectedState(state);
    loadDealers(state);
  };

  const isLoggedIn = sessionStorage.getItem("username") !== null;

  return (
    <div className="dealers-page">
      <Header />
      <main className="dealers-shell container py-5">
        <div className="dealers-heading">
          <div>
            <p className="eyebrow">Nationwide directory</p>
            <h1>Find a dealership</h1>
            <p className="text-muted">Browse trusted Best Cars locations and customer reviews.</p>
          </div>
          <div className="state-filter">
            <label htmlFor="state">Filter by state</label>
            <select
              className="form-select"
              name="state"
              id="state"
              value={selectedState}
              onChange={filterDealers}
            >
              <option value="All">Show all</option>
              {states.map((state) => (
                <option value={state} key={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="status-message" role="status">Loading dealerships…</p>}
        {error && <p className="alert alert-danger" role="alert">{error}</p>}
        {!loading && !error && dealers.length === 0 && (
          <p className="status-message">No dealerships were found for this state.</p>
        )}
        {!loading && !error && dealers.length > 0 && (
          <div className="table-responsive dealer-table-wrap">
            <table className="table dealer-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Dealer</th>
                  <th scope="col">City</th>
                  <th scope="col">Address</th>
                  <th scope="col">ZIP</th>
                  <th scope="col">State</th>
                  {isLoggedIn && <th scope="col">Review Dealer</th>}
                </tr>
              </thead>
              <tbody>
                {dealers.map((dealer) => (
                  <tr key={dealer.id}>
                    <td>
                      <Link className="dealer-name" to={`/dealer/${dealer.id}`}>
                        {dealer.full_name}
                      </Link>
                    </td>
                    <td>{dealer.city}</td>
                    <td>{dealer.address}</td>
                    <td>{dealer.zip}</td>
                    <td><span className="state-badge">{dealer.state}</span></td>
                    {isLoggedIn && (
                      <td>
                        <Link
                          className="review-link"
                          to={`/postreview/${dealer.id}`}
                          aria-label={`Review ${dealer.full_name}`}
                        >
                          <img src={reviewIcon} alt="" />
                          Review
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dealers;
