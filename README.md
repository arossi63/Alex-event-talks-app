# 🚀 BigQuery Release Explorer

A modern, real-time developer dashboard built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript** that parses, indexes, and visualizes the official Google Cloud BigQuery release notes. 

This application automatically decomposes daily GCP update logs into individual, granular cards (separating Features, Announcements, Issues, and Deprecations) and provides a premium, interactive environment to explore, search, and tweet about specific updates.

---

## ✨ Features

*   **🔍 Smart Feed Decomposition**: Splits aggregate daily release notes into distinct, category-specific update cards using server-side HTML structure parsing.
*   **📊 Metric Analytics Strip**: An interactive top bar displaying current counts for Total Updates, Features, Announcements, Issues, and Deprecations. Click any metric to filter the feed instantly.
*   **🧩 Dual Layout Configurations**: Toggle dynamically between:
    *   **Grouped (Accordion)**: Collapsible, date-headed lists for a structured view.
    *   **Feed**: A continuous, chronological timeline flow of cards.
*   **⚡ Live Search Indexing**: Instant full-text matching across titles, badges, dates, or body content.
*   **🐦 Premium X / Twitter Share Modal**: 
    *   Auto-drafts formatted posts with parsed document references.
    *   Interactive quick-pills to append hashtags.
    *   Simulates the draft text on a live mock dark-themed Twitter post.
    *   Features an SVG circular progress ring that dynamically tracks the 280-character limit.
*   **💾 High-Performance Caching**: Saves parsed responses in-memory for **1 hour** to limit API usage. Manual **Refresh** triggers a force-fetch, with a automatic cache fallback warning banner if the external service is down.

---

## 🛠️ Tech Stack

*   **Backend**: Python 3.13+, Flask, Requests, BeautifulSoup4 (BS4), ElementTree (XML)
*   **Frontend**: Vanilla HTML5, Vanilla CSS3 (Glassmorphism & animations), Vanilla JavaScript (ES6 State Controller)
*   **Integrations**: Twitter/X Web Share Intents API

---

## 📂 Project Structure

```text
bq-releases-notes/
├── app.py                  # Flask web server, feed scraper & caching controller
├── requirements.txt        # Python dependency manifest
├── README.md               # Repository documentation (this file)
├── .gitignore              # Files to exclude from Git tracking
├── templates/
│   └── index.html          # Semantic HTML dashboard template & Tweet modal
└── static/
    ├── css/
    │   └── styles.css      # Custom styling, animations, colors, and layout rules
    └── js/
        └── app.js          # Main client controller (API calls, state, filters, sharing)
```

---

## 🚀 Quick Start Guide

Follow these steps to run the application locally:

### 1. Clone the repository
```bash
git clone https://github.com/arossi63/Alex-event-talks-app.git
cd Alex-event-talks-app
```

### 2. Install dependencies
Install the required Python modules from the manifest:
```bash
pip install -r requirements.txt
```

### 3. Run the application
Start the local Flask development server:
```bash
python app.py
```

### 4. Explore in your browser
Open your browser and navigate to:
*   👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 📝 Configuration and Details

*   **Cache Policy**: Checked and updated every 60 minutes.
*   **Force Refresh**: The "Refresh" button in the header adds `?refresh=true` to force a live reload of `https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`.
*   **Responsive Web Design**: Configured to work smoothly on mobile screens, tablets, and wide screens.
