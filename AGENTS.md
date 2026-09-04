# Repository Guidelines

## Project intent

Build the Coursera car-dealership capstone described in `scenario_review_criteria.pdf` and `archeticture.pdf`. Treat those PDFs as the product and architecture source of truth. Preserve the required user journeys and screenshot filenames because grading depends on them.

The completed system consists of:

- a Django dealership website with React-based authentication UI and SQLite-backed car makes/models;
- an Express and MongoDB service for dealerships and reviews, packaged with Docker;
- a sentiment-analysis service accessed through the Django proxy layer;
- CI linting and a Kubernetes deployment.

Keep service boundaries explicit: browsers interact with Django, Django proxies dealership/review and sentiment calls, and only the Express service accesses MongoDB.

## Working in this repository

1. Inspect the current tree and nearby configuration before changing files. The starter project may be added incrementally, so derive commands and conventions from the checked-in code rather than assuming a layout.
2. Make the smallest coherent change that satisfies the relevant capstone requirement. Avoid unrelated dependency upgrades or broad refactors.
3. Follow established framework conventions and preserve existing public routes, payload shapes, environment-variable names, and grading artifacts.
4. Keep secrets and deployment-specific URLs out of source control. Use environment variables and update an example environment file when introducing configuration.
5. Add or update focused tests for changed behavior. Run the narrowest relevant checks first, then the repository's full lint and test commands when available.
6. Before finishing, exercise the affected user journey or API endpoint and report the exact verification performed. If a check cannot run, state the missing prerequisite.

## Product invariants

- Anonymous users can view About and Contact pages, browse all dealerships, filter dealerships by state, open a dealership, and read its reviews.
- Authenticated users can also submit dealership reviews. A successful submission returns to that dealership's detail page and displays the new review first.
- Admin users can manage car makes, models, and related attributes through Django admin.
- Dealership reviews are shown as Bootstrap cards.
- Selecting no state, or selecting "Show all," returns dealerships from every state.
- Review data includes the Django user identity, dealership, review text, timestamp, purchase details, and selected car information. Validate input at service boundaries.

## Architecture contracts

- Django exposes the application-facing car, dealership, review, and add-review routes described in `archeticture.pdf`.
- The Express service owns dealer/review persistence and exposes its documented fetch and insert endpoints.
- Django owns car make/model persistence in SQLite and mediates calls to downstream services.
- Sentiment results are obtained from the analyzer service and presented with reviews; downstream failures should produce an explicit, user-safe response rather than fabricated sentiment.

When the implementation and PDFs appear to disagree, follow the current lab instructions and existing tests, then document the discrepancy in the handoff.
