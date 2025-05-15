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

app.post('/scrape', async (req, res) => {
  const urls = req.body.urls || [];
  const results = [];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      const content = await response.text();

      const listingPhoto = extractBetween(content, 'id="media-gallery-hero-image" src="', '" srcSet=');

      const agents = [];
      let searchFrom = 0;
      while (true) {
        const cardStart = content.indexOf('<div data-tn="listing-contact-card"', searchFrom);
        if (cardStart === -1) break;

        const cardEnd = content.indexOf('</div>', cardStart);
        const cardContent = content.substring(cardStart, cardEnd);

        const hrefStart = cardContent.indexOf('href="') + 6;
        const hrefEnd = cardContent.indexOf('"', hrefStart);
        const nameStart = cardContent.indexOf('>', hrefEnd) + 1;
        const nameEnd = cardContent.indexOf('</a>', nameStart);

        if (hrefStart !== -1 && hrefEnd !== -1 && nameStart !== -1 && nameEnd !== -1) {
          const profileUrl = cardContent.substring(hrefStart, hrefEnd);
          const name = cardContent.substring(nameStart, nameEnd).trim();
          agents.push({ name, profileUrl: `https://www.compass.com${profileUrl}` });
        }

        searchFrom = cardEnd;
      }

      results.push({
        url,
        listingPhoto: listingPhoto || 'Not Found',
        agents: agents.length ? agents : []
      });

    } catch (error) {
      results.push({ url, error: error.message });
    }
  }

  res.json({ data: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));
