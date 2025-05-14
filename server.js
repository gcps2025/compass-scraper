const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/scrape', async (req, res) => {
  const urls = req.body.urls || [];

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  for (const url of urls) {
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

      const content = await page.content();

      const extractBetween = (text, fromText, toText) => {
        const fromIndex = text.indexOf(fromText);
        if (fromIndex === -1) return null;
        const toIndex = text.indexOf(toText, fromIndex + fromText.length);
        if (toIndex === -1) return null;
        return text.substring(fromIndex + fromText.length, toIndex);
      };

      const listingPhoto = extractBetween(content, 'id="media-gallery-hero-image" src="', '" srcSet=');
      const agentName = extractBetween(content, 'data-tn="profile-name">', '</h1>');
      const agentHome = extractBetween(content, '<h1 class="textIntent-headline1--strong agents-heroTitle ">', '</h1>');
      const profileImage = extractBetween(content, '"profile-image" src="', '" alt=');

      results.push({
        url,
        listingPhoto: listingPhoto || 'Not Found',
        agentName: agentName || 'Not Found',
        agentHome: agentHome || 'Not Found',
        profileImage: profileImage || 'Not Found'
      });

    } catch (error) {
      results.push({ url, error: error.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  res.json({ data: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scraper API running on port ${PORT}`));
