const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const extractBetween = (text, fromText, toText) => {
  const fromIndex = text.indexOf(fromText);
  if (fromIndex === -1) return null;
  const toIndex = text.indexOf(toText, fromIndex + fromText.length);
  if (toIndex === -1) return null;
  return text.substring(fromIndex + fromText.length, toIndex);
};

const dedupe = (arr) => [...new Set(arr)];

app.post('/scrape', async (req, res) => {
  const urls = req.body.urls || [];
  const results = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract listing photo
      const listingPhoto = extractBetween(html, 'id="media-gallery-hero-image" src="', '" srcSet=');

      // Extract agent profile slugs
      const fromText = '" href="/agents/';
      const toText = '/" data-tn';
      const agents = [];
      let searchFrom = 0;

      for (let a = 0; a < 10; a++) {
        const start1 = html.indexOf(fromText, searchFrom);
        if (start1 === -1) break;

        const end1 = html.indexOf(toText, start1);
        if (end1 === -1) break;

        const slug = html.substring(start1 + fromText.length, end1).replace(/&#x27;/g, "'");
        agents.push(slug);

        searchFrom = end1 + 1;
      }

      const uniqueAgents = dedupe(agents);

      // Fetch each profile URL and extract agent name
      const agentData = [];
      for (const slug of uniqueAgents) {
        const profileUrl = `https://www.compass.com/agents/${slug}/`;
        try {
          const profileRes = await fetch(profileUrl);
          const profileHtml = await profileRes.text();

          const agentName = extractBetween(profileHtml, 'data-tn="profile-name">', '</h1>');
          if (agentName) {
            agentData.push({ name: agentName.trim(), profileUrl });
          }
        } catch (e) {
          agentData.push({ profileUrl, error: e.message });
        }
      }

      results.push({
        url,
        listingPhoto: listingPhoto || 'Not Found',
        agents: agentData.length ? agentData : []
      });

    } catch (error) {
      results.push({ url, error: error.message });
    }
  }

  res.json({ data: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));
