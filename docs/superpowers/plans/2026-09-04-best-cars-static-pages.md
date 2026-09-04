# Best Cars Static Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the starter Django application serve finished, navigable Bootstrap Home, About Us, and Contact Us pages for Best Cars.

**Architecture:** Keep the course template's server-rendered HTML under `server/frontend/static` and expose it with Django `TemplateView` routes. Configure that directory for both template and static-asset discovery, preserve the existing authentication placeholders, and verify behavior through Django's real URL resolver and test client.

**Tech Stack:** Python, Django, Django TestCase/client, HTML5, Bootstrap 5, CSS

**Spec:** `docs/superpowers/specs/2026-09-04-best-cars-static-pages-design.md`

## Global Constraints

- Use fictional Best Cars organization, team, and contact details.
- Keep `/`, `/about`, and `/contact` as the page URLs.
- Keep templates and their assets under `server/frontend/static`.
- Preserve the home page's login/session placeholder for the later authentication module.
- Add no contact-form back end and no dealership/review functionality in this module.
- Preserve the local course PDFs and `AGENTS.md`.

---

### Task 1: Configure Django to discover the starter templates

**Files:**
- Modify: `server/djangoproj/settings.py`
- Create: `server/djangoapp/tests.py`

**Interfaces:**
- Consumes: `BASE_DIR`, Django's `TEMPLATES` and `STATICFILES_DIRS` settings
- Produces: template/static discovery for `BASE_DIR / "frontend" / "static"`

- [ ] **Step 1: Create the failing template-discovery test**

Create `server/djangoapp/tests.py`:

```python
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class StaticPageConfigurationTests(SimpleTestCase):
    def test_frontend_static_directory_is_used_for_templates_and_assets(self):
        frontend_static = Path(settings.BASE_DIR) / "frontend" / "static"

        self.assertIn(frontend_static, settings.TEMPLATES[0]["DIRS"])
        self.assertIn(frontend_static, settings.STATICFILES_DIRS)
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd server
python manage.py test djangoapp.tests.StaticPageConfigurationTests -v 2
```

Expected: FAIL because the frontend static directory is absent from `TEMPLATES[0]["DIRS"]` and `STATICFILES_DIRS`.

- [ ] **Step 3: Add the shared frontend directory to Django settings**

In `server/djangoproj/settings.py`, define this immediately after `BASE_DIR`:

```python
FRONTEND_STATIC_DIR = BASE_DIR / "frontend" / "static"
```

Then update the existing settings:

```python
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_STATIC_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATICFILES_DIRS = [FRONTEND_STATIC_DIR]
```

Retain all unrelated settings unchanged.

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
cd server
python manage.py test djangoapp.tests.StaticPageConfigurationTests -v 2
```

Expected: PASS.

- [ ] **Step 5: Commit the configuration slice**

```bash
git add server/djangoproj/settings.py server/djangoapp/tests.py
git commit -m "test: configure static page discovery"
```

---

### Task 2: Route the three static pages

**Files:**
- Modify: `server/djangoproj/urls.py`
- Modify: `server/djangoapp/tests.py`
- Create: `server/frontend/static/Contact.html`

**Interfaces:**
- Consumes: Django `TemplateView`, `Home.html`, `About.html`
- Produces: GET `/`, GET `/about`, and GET `/contact`, each returning HTML with HTTP 200

- [ ] **Step 1: Add the failing route test**

Append this class to `server/djangoapp/tests.py`:

```python
class StaticPageRouteTests(SimpleTestCase):
    def test_home_about_and_contact_pages_are_available(self):
        pages = {
            "/": "Home.html",
            "/about": "About.html",
            "/contact": "Contact.html",
        }

        for url, template_name in pages.items():
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, template_name)
```

- [ ] **Step 2: Run the route test and verify RED**

Run:

```bash
cd server
python manage.py test djangoapp.tests.StaticPageRouteTests -v 2
```

Expected: FAIL because `/about` and `/contact` are not registered.

- [ ] **Step 3: Register the static routes and add the initial contact template**

Update the `urlpatterns` entries in `server/djangoproj/urls.py` to:

```python
urlpatterns = [
    path("admin/", admin.site.urls),
    path("djangoapp/", include("djangoapp.urls")),
    path("", TemplateView.as_view(template_name="Home.html"), name="home"),
    path("about", TemplateView.as_view(template_name="About.html"), name="about"),
    path(
        "contact",
        TemplateView.as_view(template_name="Contact.html"),
        name="contact",
    ),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

Create `server/frontend/static/Contact.html` with this valid initial document so the route can render:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Contact Us | Best Cars</title>
  </head>
  <body>
    <main>
      <h1>Contact Best Cars</h1>
    </main>
  </body>
</html>
```

- [ ] **Step 4: Run the route test and verify GREEN**

Run:

```bash
cd server
python manage.py test djangoapp.tests.StaticPageRouteTests -v 2
```

Expected: PASS for all three subtests.

- [ ] **Step 5: Commit the routing slice**

```bash
git add server/djangoproj/urls.py server/djangoapp/tests.py server/frontend/static/Contact.html
git commit -m "feat: route Best Cars static pages"
```

---

### Task 3: Finish the Best Cars content and Bootstrap navigation

**Files:**
- Modify: `server/djangoapp/tests.py`
- Modify: `server/frontend/static/Home.html`
- Modify: `server/frontend/static/About.html`
- Modify: `server/frontend/static/Contact.html`
- Modify: `server/frontend/static/style.css`

**Interfaces:**
- Consumes: `/static/bootstrap.min.css`, `/static/style.css`, starter image assets
- Produces: responsive Bootstrap pages with consistent navigation and finished Best Cars copy

- [ ] **Step 1: Add failing behavior tests for navigation and page content**

Append these methods to `StaticPageRouteTests` in `server/djangoapp/tests.py`:

```python
    def test_each_page_has_best_cars_navigation(self):
        for url in ("/", "/about", "/contact"):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertContains(response, "Best Cars")
                self.assertContains(response, 'href="/"')
                self.assertContains(response, 'href="/about"')
                self.assertContains(response, 'href="/contact"')
                self.assertContains(response, "navbar-toggler")

    def test_about_page_introduces_best_cars_and_three_team_members(self):
        response = self.client.get("/about")

        self.assertContains(response, "About Best Cars")
        self.assertContains(response, 'class="team-member', count=3)
        self.assertContains(response, "@bestcars.example", count=3)

    def test_contact_page_lists_contact_methods_and_business_hours(self):
        response = self.client.get("/contact")

        self.assertContains(response, "Contact Best Cars")
        self.assertContains(response, "hello@bestcars.example")
        self.assertContains(response, "+1 (800) 555-0127")
        self.assertContains(response, "Business hours")
```

- [ ] **Step 2: Run the content tests and verify RED**

Run:

```bash
cd server
python manage.py test djangoapp.tests.StaticPageRouteTests -v 2
```

Expected: FAIL because the starter pages use Dealerships branding and placeholder About/Contact content.

- [ ] **Step 3: Complete all three page documents**

For each file, add `<!doctype html>`, `lang="en"`, UTF-8 and responsive viewport metadata, `/static/bootstrap.min.css`, `/static/style.css`, and the Bootstrap bundle CDN already supplied by the starter.

Use the same navbar structure on every page:

```html
<nav class="navbar navbar-expand-lg navbar-dark bg-primary">
  <div class="container">
    <a class="navbar-brand fw-bold" href="/">Best Cars</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
            data-bs-target="#mainNavigation" aria-controls="mainNavigation"
            aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="mainNavigation">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
        <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
        <li class="nav-item"><a class="nav-link" href="/about">About Us</a></li>
        <li class="nav-item"><a class="nav-link" href="/contact">Contact Us</a></li>
      </ul>
    </div>
  </div>
</nav>
```

On each page, add `active` and `aria-current="page"` only to that page's link. Preserve the `checkSession()` script and `loginlogout` container on `Home.html`, change its Home destination from `#` to `/`, and retain the dealership call to action.

In `About.html`, replace all starter placeholders with:

- heading `About Best Cars`;
- copy explaining nationwide dealership discovery and transparent customer reviews;
- exactly three `.team-member` cards for Maya Thompson, Daniel Kim, and Sofia Martinez;
- roles of General Manager, Customer Experience Director, and Automotive Services Lead;
- a short role-relevant biography and one `@bestcars.example` email per person.

In `Contact.html`, include:

- heading `Contact Best Cars`;
- `hello@bestcars.example` as a `mailto:` link;
- `+1 (800) 555-0127` as a `tel:` link;
- `100 Motor Way, Detroit, MI 48201, United States`;
- a `Business hours` section listing `Monday–Friday: 8:00 AM–7:00 PM` and `Saturday–Sunday: 9:00 AM–5:00 PM`.

Update `style.css` with focused classes used by the templates:

```css
body {
  background-color: #f5f7fa;
  color: #172033;
}

.navbar {
  min-height: 72px;
}

.page-shell {
  padding: 3rem 0;
}

.hero-card,
.team-member,
.contact-card {
  border: 0;
  border-radius: 1rem;
  box-shadow: 0 0.5rem 1.5rem rgba(23, 32, 51, 0.12);
}

.team-member img {
  width: 9rem;
  height: 9rem;
  margin-top: 1.5rem;
  object-fit: cover;
  border-radius: 50%;
}
```

Remove inline layout rules that conflict with these responsive Bootstrap containers and cards. Retain legacy selectors still used by the later React/authentication starter files.

- [ ] **Step 4: Run all Django tests and verify GREEN**

Run:

```bash
cd server
python manage.py test -v 2
```

Expected: all tests PASS with no exceptions or warnings introduced by these changes.

- [ ] **Step 5: Run Django's system check**

Run:

```bash
cd server
python manage.py check
```

Expected: `System check identified no issues`.

- [ ] **Step 6: Commit the completed static experience**

```bash
git add server/djangoapp/tests.py server/frontend/static/Home.html server/frontend/static/About.html server/frontend/static/Contact.html server/frontend/static/style.css
git commit -m "feat: complete Best Cars static pages"
```

---

### Task 4: Run and smoke-test the development server

**Files:**
- No source files changed

**Interfaces:**
- Consumes: Django development server on `127.0.0.1:8000`
- Produces: observed HTTP 200 responses for `/`, `/about`, and `/contact`

- [ ] **Step 1: Apply starter migrations**

Run:

```bash
cd server
python manage.py migrate --noinput
```

Expected: all built-in and project migrations apply successfully or report that no migrations remain.

- [ ] **Step 2: Start Django's development server**

Run from `server` in a persistent terminal:

```bash
python manage.py runserver 127.0.0.1:8000
```

Expected: Django reports that the development server is running without an exception.

- [ ] **Step 3: Request all static routes**

From another terminal, run:

```bash
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8000/
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8000/about
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8000/contact
```

Expected: every command exits with status 0, and the server log records HTTP 200 for each route.

- [ ] **Step 4: Stop the development server cleanly**

Send Ctrl-C to the server terminal and confirm the process exits. Leave the generated, ignored `server/db.sqlite3` in place for future local runs.

- [ ] **Step 5: Record final repository state**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: the implementation commits are present; only the previously preserved local reference files may remain untracked.
