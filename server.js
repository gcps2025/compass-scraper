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
        if (interceptedRequest.method() === 'POST') {
          const postData = interceptedRequest.postData();
          console.log('POST Request URL:', interceptedRequest.url());
          console.log('POST Body:', postData ? postData.substring(0, 1000) : 'No body');
        }
        interceptedRequest.continue();
      });

      page.on('response', async (response) => {
        try {
          const requestUrl = response.url();
          const status = response.status();
          const method = response.request().method();
          const resourceType = response.request().resourceType();

          if (resourceType === 'xhr' || resourceType === 'fetch') {
            console.log('Intercepted Response:', method, requestUrl, 'Status:', status);

            const contentType = response.headers()['content-type'] || '';
            if (contentType.includes('application/json')) {
              const json = await response.json();
              console.log('Response Body Sample:', JSON.stringify(json).substring(0, 1000));
            }
          }
        } catch (e) {
          console.error('Response handling error:', e.message);
        }
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 0 });

      await page.waitForTimeout(5000); // Allow network requests to settle

      results.push({ url, status: 'Logged POST request bodies' });

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
