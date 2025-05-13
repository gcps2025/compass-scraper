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

      const nextData = await page.evaluate(() => {
        const scriptTag = document.querySelector('#__NEXT_DATA__');
        if (scriptTag) {
          return JSON.parse(scriptTag.textContent);
        }
        return null;
      });

      if (!nextData) {
        results.push({ url, error: '__NEXT_DATA__ not found' });
        continue;
      }

      const listing = nextData?.props?.pageProps?.listing;

      if (!listing) {
        results.push({ url, error: 'Listing data not found' });
        continue;
      }

      const heroImage = listing.media?.hero?.url || 'Not Found';

      const agents = listing.primaryListingAgents.map(agent => ({
        name: agent.fullName,
        profileUrl: `https://www.compass.com/agents/${agent.slug}`,
        profileImage: agent.profileImageUrl || 'No Image'
      }));

      results.push({
        url,
        listingPhoto: heroImage,
        agents
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
