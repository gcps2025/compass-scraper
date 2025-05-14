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

      // Wait for main agent-buy section to ensure correct scope
      await page.waitForSelector('main#root.agent-buy', { timeout: 10000 });

      const data = await page.evaluate(() => {
        const getSafe = (selector, attr = 'textContent') => {
          const el = document.querySelector(selector);
          if (!el) return null;
          return attr === 'textContent' ? el.textContent.trim() : el.getAttribute(attr);
        };

        const listingPhoto = getSafe('#media-gallery-hero-image', 'src');

        const root = document.querySelector('main#root.agent-buy');
        if (!root) return { listingPhoto: listingPhoto || 'Not Found', agents: [] };

        const contactCards = Array.from(root.querySelectorAll('div[data-tn="listing-contact-card"]'));
        const agents = contactCards.map(card => {
          const link = card.querySelector('a.cx-textLink.cx-textLink--primary');
          if (link) {
            return {
              name: link.textContent.trim(),
              profileUrl: link.href
            };
          }
          return null;
        }).filter(agent => agent !== null);

        return {
          listingPhoto: listingPhoto || 'Not Found',
          agents: agents.length ? agents : []
        };
      });

      results.push({ url, ...data });

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
