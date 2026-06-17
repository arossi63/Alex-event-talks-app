from flask import Flask, render_template, jsonify, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time
import re
import os

app = Flask(__name__)

# Simple in-memory cache
cached_data = None
last_fetched = 0
CACHE_EXPIRY = 3600  # 1 hour

def parse_releases():
    url = 'https://docs.cloud.google.com/feeds/bigquery-release-notes.xml'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
    except Exception as e:
        return {'error': f'Failed to fetch BigQuery release notes feed: {str(e)}'}

    try:
        root = ET.fromstring(response.content)
    except Exception as e:
        return {'error': f'Failed to parse XML response: {str(e)}'}

    # Extract namespace if present (usually {http://www.w3.org/2005/Atom})
    m = re.match(r'(\{.*\})', root.tag)
    ns = m.group(1) if m else ''

    entries = root.findall(f'{ns}entry')
    parsed_entries = []

    for entry in entries:
        title_el = entry.find(f'{ns}title')
        updated_el = entry.find(f'{ns}updated')
        content_el = entry.find(f'{ns}content')
        id_el = entry.find(f'{ns}id')

        date_str = title_el.text.strip() if title_el is not None and title_el.text else 'Unknown Date'
        updated_str = updated_el.text.strip() if updated_el is not None and updated_el.text else ''
        content_html = content_el.text.strip() if content_el is not None and content_el.text else ''
        entry_id = id_el.text.strip() if id_el is not None and id_el.text else ''

        # Parse sub-updates using BeautifulSoup
        soup = BeautifulSoup(content_html, 'html.parser')
        updates = []
        current_type = None
        current_content = []

        for child in soup.contents:
            if child.name == 'h3':
                # Save previous update if exists
                if current_type:
                    html_str = ''.join(str(c) for c in current_content).strip()
                    text_str = ''.join(c.get_text() if hasattr(c, 'get_text') else str(c) for c in current_content).strip()
                    
                    sub_soup = BeautifulSoup(html_str, 'html.parser')
                    links = [a.get('href') for a in sub_soup.find_all('a') if a.get('href')]
                    
                    updates.append({
                        'type': current_type,
                        'html': html_str,
                        'text': text_str,
                        'links': links
                    })
                current_type = child.get_text().strip()
                current_content = []
            else:
                current_content.append(child)

        # Save last update
        if current_type:
            html_str = ''.join(str(c) for c in current_content).strip()
            text_str = ''.join(c.get_text() if hasattr(c, 'get_text') else str(c) for c in current_content).strip()
            sub_soup = BeautifulSoup(html_str, 'html.parser')
            links = [a.get('href') for a in sub_soup.find_all('a') if a.get('href')]
            
            updates.append({
                'type': current_type,
                'html': html_str,
                'text': text_str,
                'links': links
            })

        # Fallback if no <h3> tag was found in the entry
        if not updates and content_html:
            links = [a.get('href') for a in soup.find_all('a') if a.get('href')]
            updates.append({
                'type': 'Update',
                'html': content_html,
                'text': soup.get_text().strip(),
                'links': links
            })

        # Format date for client if possible
        # Typically formatted as 'June 16, 2026' or '2026-06-16'
        # We will keep raw date_str and also pass ISO format if available
        parsed_entries.append({
            'id': entry_id,
            'date': date_str,
            'updated': updated_str,
            'updates': updates
        })

    return parsed_entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    global cached_data, last_fetched
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    if force_refresh or not cached_data or (now - last_fetched > CACHE_EXPIRY):
        data = parse_releases()
        if isinstance(data, dict) and 'error' in data:
            if cached_data:
                return jsonify({
                    'releases': cached_data,
                    'last_fetched': last_fetched,
                    'warning': f"Showing cached data. Reason: {data['error']}"
                })
            return jsonify(data), 500
        cached_data = data
        last_fetched = now
        
    return jsonify({
        'releases': cached_data,
        'last_fetched': last_fetched
    })

if __name__ == '__main__':
    # Listen on localhost:5000
    app.run(host='127.0.0.1', port=5000, debug=True)
