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
      await page.setRequestInterception(true);

      page.on('request', (interceptedRequest) => {
        interceptedRequest.continue();
      });

      page.on('response', async (response) => {
        try {
          const requestUrl = response.url();
          if (requestUrl.includes('/api/')) {
            console.log('Intercepted API URL:', requestUrl);
            const json = await response.json();
            console.log('API Response Body Sample:', JSON.stringify(json).substring(0, 500));
          }
        } catch (e) {
          console.error('Response handling error:', e.message);
        }
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

      await page.waitForTimeout(5000); // Allow XHRs to complete

      results.push({ url, status: 'Logged API requests' });

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
