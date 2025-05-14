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

      page.on('request', async (interceptedRequest) => {
        if (interceptedRequest.method() === 'POST' && interceptedRequest.url().includes('/api/graphql')) {
          const postData = interceptedRequest.postData();
          console.log('GraphQL POST Request URL:', interceptedRequest.url());
          console.log('GraphQL Request Body:', postData ? postData.substring(0, 2000) : 'No body');
        }
        interceptedRequest.continue();
      });

      page.on('response', async (response) => {
        try {
          const requestUrl = response.url();
          const status = response.status();
          const method = response.request().method();

          if (method === 'POST' && requestUrl.includes('/api/graphql')) {
            console.log('GraphQL Response:', method, requestUrl, 'Status:', status);

            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              const json = await response.json();
              console.log('GraphQL Response Body Sample:', JSON.stringify(json).substring(0, 2000));
            }
          }
        } catch (e) {
          console.error('GraphQL Response handling error:', e.message);
        }
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

      await page.waitForTimeout(10000); // Increased wait to catch lazy GraphQL calls

      results.push({ url, status: 'Logged GraphQL POST requests & responses' });

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
