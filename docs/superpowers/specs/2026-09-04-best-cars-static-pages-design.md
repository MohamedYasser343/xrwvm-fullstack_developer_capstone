# Best Cars Static Pages Design

## Objective

Prepare the supplied Best Cars Django application for the first capstone module. The application must run on Django's development server and provide a Bootstrap navigation bar, an About Us page, and a Contact Us page using fictional Best Cars content.

## Scope

This module changes only the Django-served static experience. Authentication, car models and makes, dealership and review services, sentiment analysis, containers, CI, and Kubernetes remain for later modules.

The existing home page remains the entry point. The incomplete starter templates and routing are finished without restructuring the React authentication application or the back-end service boundaries.

## Repository Setup

The GitHub upstream repository is `ibm-developer-skills-network/xrwvm-fullstack_developer_capstone`. The working repository is its fork at `MohamedYasser343/xrwvm-fullstack_developer_capstone`:

- `origin` points to the user's fork.
- `upstream` points to the course template.
- Work is based on the fork's `main` branch.

Existing local course-reference PDFs and `AGENTS.md` are preserved.

## Page Design

### Navigation

Home, About Us, and Contact Us use Bootstrap 5 navigation with Best Cars branding. Each link targets `/`, `/about`, or `/contact`, and the current page is exposed through the active Bootstrap state and `aria-current="page"`.

The layout remains responsive through the Bootstrap navbar toggler. The home page retains the starter login/session area because authentication is implemented in a later phase.

### About Us

The About Us page introduces Best Cars as a nationwide dealership-review platform focused on transparent vehicle shopping. It displays three fictional team profiles with role, short biography, and `@bestcars.example` contact details. Existing starter imagery may be reused.

### Contact Us

The Contact Us page presents fictional Best Cars contact information:

- a United States mailing address;
- telephone and email contact methods;
- weekday and weekend business hours.

The page uses semantic headings, accessible link labels, and Bootstrap cards or list groups. It does not add a contact form or any submission back end.

## Django Integration

The project continues using Django `TemplateView` routes for these static documents. The project URL configuration maps:

- `/` to `Home.html`;
- `/about` to `About.html`;
- `/contact` to `Contact.html`.

Templates and assets remain under the starter project's configured `server/frontend/static` location. Links and asset URLs work when served by Django rather than by opening HTML files directly.

## Verification

Django client tests assert that all three routes return HTTP 200 and render their expected page identity. The tests also check the shared navigation destinations and key Best Cars content on the About and Contact pages.

Before completion:

1. Install the Python requirements in an isolated environment.
2. Run Django's system checks and migrations.
3. Run the focused test suite and the available full test suite.
4. Start the development server, request `/`, `/about`, and `/contact`, and confirm each returns HTTP 200.

If the starter project is incompatible with the current Python or Django release, dependencies will be constrained only as narrowly as required to run the module, and the reason will be documented.

## Completion Criteria

The module is complete when the fork is configured, all three pages are reachable through the Bootstrap navigation, About Us and Contact Us contain finished Best Cars content, automated checks pass, and the development server has served each page successfully.
