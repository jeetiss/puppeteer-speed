const signale = require("signale");
const puppeteer = require("puppeteer");
const { promisify } = require("util");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function scroll(from, to) {
  let position = from;
  const delta = window.innerHeight;
  if (to - from <= 0) return Promise.resolve(1);
  window.scrollTo(0, position);

  return new Promise(resolve =>
    setTimeout(() => scroll(from + delta, to).then(resolve), 100)
  );
}

const getRecord = async response => {
  const url = response.url();
  const headers = response.headers();
  const responseSize = headers["content-length"]
    ? Number.parseInt(headers["content-length"])
    : (await response.buffer()).byteLength;

  // signale.debug(`response from ${url}`);

  return {
    url,
    responseSize,
    fromCache: response.fromCache(),
    mime: headers["content-type"]
  };
};

const command = `
(async () => {
  ${scroll.toString()}
  return await scroll(0, document.body.scrollHeight)
})()
`;

const getRecords = async page => {
  const networkRecords = [];

  const handler = async response => {
    if (response.status() < 300) {
      networkRecords.push(await getRecord(response));
    }
  };

  page.on("response", handler);

  signale.debug("work");

  await page.waitForNavigation({ waitUntil: "load" });
  signale.debug("start scrolling page");
  await page.evaluate(command);
  signale.debug("finish scrolling page 🤘🏻");
  await sleep(500);

  page.removeListener("response", handler);

  const records = await Promise.all(networkRecords);

  return records;
};

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  signale.debug("open");

  const [records] = await Promise.all([
    getRecords(page),
    page.goto("https://lifehacker.ru/", { waitUntil: "load" })
  ]);

  signale.debug(`${records.length} response`);

  await browser.close();
})();
