import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import PostReview from "./PostReview";


const renderReviewForm = (onSubmitted = jest.fn()) => render(
  <MemoryRouter initialEntries={["/postreview/3"]}>
    <Routes>
      <Route path="/postreview/:id" element={<PostReview onSubmitted={onSubmitted} />} />
    </Routes>
  </MemoryRouter>,
);

const ReviewRouteHarness = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/postreview/4")}>Open another dealer</button>
      <Routes>
        <Route path="/postreview/:id" element={<PostReview onSubmitted={jest.fn()} />} />
      </Routes>
    </>
  );
};

beforeEach(() => {
  sessionStorage.clear();
  sessionStorage.setItem("username", "reviewer");
  global.fetch = jest.fn(async (url, options = {}) => {
    if (options.method === "POST") {
      return {
        ok: true,
        json: async () => ({ status: 200, review: { id: 101 } }),
      };
    }
    if (url.endsWith("djangoapp/get_cars")) {
      return {
        ok: true,
        json: async () => ({
          CarModels: [{ CarMake: "Toyota", CarModel: "Camry" }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        status: 200,
        dealer: [{ id: 3, full_name: "Best Cars Birmingham" }],
      }),
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("the review form submits all purchase details and returns to the dealer", async () => {
  const onSubmitted = jest.fn();
  renderReviewForm(onSubmitted);

  await screen.findByRole("heading", { name: /Review Best Cars Birmingham/ });
  fireEvent.change(screen.getByLabelText("Your review"), {
    target: { value: "Excellent service" },
  });
  fireEvent.click(screen.getByLabelText("I purchased a car"));
  fireEvent.change(screen.getByLabelText("Purchase date"), {
    target: { value: "2023-01-02" },
  });
  fireEvent.change(screen.getByLabelText("Car make and model"), {
    target: { value: "Toyota|Camry" },
  });
  fireEvent.change(screen.getByLabelText("Car year"), {
    target: { value: "2022" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Post review" }));

  await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith("3"));
  const request = global.fetch.mock.calls.find(([, options]) => options?.method === "POST");
  expect(JSON.parse(request[1].body)).toEqual({
    dealership: 3,
    review: "Excellent service",
    purchase: true,
    purchase_date: "2023-01-02",
    car_make: "Toyota",
    car_model: "Camry",
    car_year: 2022,
  });
});

test("anonymous visitors are directed to sign in instead of seeing the form", () => {
  sessionStorage.clear();

  renderReviewForm();

  expect(screen.queryByText("Please sign in to submit a review.")).not.toBeNull();
  expect(screen.queryByRole("link", { name: "Sign in" })?.getAttribute("href")).toBe("/login");
  expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
});

test("a dealer-service failure does not expose a partially loaded form", async () => {
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith("djangoapp/get_cars")) {
      return {
        ok: true,
        json: async () => ({ CarModels: [] }),
      };
    }
    return {
      ok: false,
      json: async () => ({ status: 502, error: "Dealer service is unavailable." }),
    };
  });

  renderReviewForm();

  expect((await screen.findByRole("alert")).textContent).toBe("Dealer service is unavailable.");
  expect(screen.queryByRole("button", { name: "Post review" })).toBeNull();
});

test("a successful route change clears an earlier form-loading error", async () => {
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith("djangoapp/get_cars")) {
      return {
        ok: true,
        json: async () => ({
          CarModels: [{ CarMake: "Toyota", CarModel: "Camry" }],
        }),
      };
    }
    if (url.endsWith("djangoapp/dealer/3")) {
      return {
        ok: false,
        json: async () => ({ status: 502, error: "Dealer service is unavailable." }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        status: 200,
        dealer: [{ id: 4, full_name: "Recovered Cars" }],
      }),
    };
  });

  render(
    <MemoryRouter initialEntries={["/postreview/3"]}>
      <ReviewRouteHarness />
    </MemoryRouter>,
  );

  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Open another dealer" }));

  expect(await screen.findByRole("heading", { name: "Review Recovered Cars" })).not.toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});
