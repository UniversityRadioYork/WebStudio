import * as fs from "fs";
import * as path from "path";

/// <reference types="puppeteer" />
const puppeteer = require("puppeteer");

/*
 * Memory Leak Tracer 2020
 * written by Marks Polakovs, send all hate mail to marks.polakovs@ury.org.uk
 *
 * Requirements:
 * puppeteer and ts-node installed globally
 * You will also need the NODE_PATH environment variable set to wherever your global node_modules is
 * To find it, run `yarn global bin` and replace /bin with /node_modules
 * (e.g. C:\Users\Marks\scoop\apps\yarn\current\global\node_modules)
 *
 * Usage:
 * Run this script as `ts-node --skip-project scripts/trace-memory-leak.ts http://local-development.ury.org.uk`
 * substituting the URL for whatever URL you want to test. Don't include any query parameters,
 * the script will take care of it.
 *
 * It may redirect you to a MyRadio sign in page. Don't worry, it won't steal your password (yet).
 *
 * To skip login, put your MyRadio username and password into a file called ".credentials" like
 * `username:password`
 *
 * Once running, just wait until it prints out the status. In addition, if it detects the leak it will exit
 * with a code of 1 - useful in "git bisect" for example.
 * If something goes wrong that isn't a memory leak, it'll exit with an exit code over 128.
 */

const baseUrl = process.argv[2];
if (typeof baseUrl !== "string") {
  console.log("Expected a baseURL as the first and only parameter!");
  process.exit(129);
}

// Specially doctored timeslot, do not change unless you know what you are doing!
const TIMESLOT_ID = 147595;

(async () => {
  try {
    console.log("Setting up...");
    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1366, height: 768 },
      args: [`--window-size=1440,960`]
    });
    const page = await browser.newPage();
    await page.goto(baseUrl + "?timeslot_id=" + TIMESLOT_ID.toString(10));
    await page.waitForNavigation({'waitUntil': 'networkidle0'});
    if (page.url().indexOf("login") > -1) {
      if (fs.existsSync(path.join(__dirname, ".credentials"))) {
        const [username, password] = fs.readFileSync(path.join(__dirname, ".credentials"), { encoding: "utf-8" }).split(":");
        await page.type("#myradio_login-user", username);
        await page.type("#myradio_login-password", password);
        if ((await page.$("#myradio_login-submit")) !== null) {
          await page.click("#myradio_login-submit");
        }
        try {
          await page.waitForSelector("#signin-submit", {visible: true, timeout: 10000});
          await page.click("#signin-submit");
        } catch (e) {
          console.warn(e)
          console.warn("Signing in went a bit wrong, please do it manually. Thank!");
        }
      } else {
        console.log("Please sign in in the browser window. Thank! (Choose whatever timeslot you like, it'll get ignored.)");
      }
    }

    await page.waitForSelector(".ReactModal__Content", { visible: true });
    await page.click(".ReactModal__Content button.btn-primary");

    console.log("Starting test: loading songs 1-3");
    await Promise.all([0,1,2].map(id => page.click(`#channel-${id} div.item:nth-child(1)`)));

    await Promise.all([0,1,2].map(id => page.waitForSelector(`#channel-${id} wave canvas`, { visible: true })));

    console.log("Songs loaded; waiting five seconds for memory usage to stabilise...");
    await page.waitFor(5000);
    const stats1 = await page.metrics();
    console.log(`JS Heap total at time ${stats1.Timestamp}: ${stats1.JSHeapTotalSize}, used ${stats1.JSHeapTotalSize}`);

    const arrayBufferHandle = await page.evaluateHandle(() => ArrayBuffer.prototype);
    const buffers1 = await page.queryObjects(arrayBufferHandle);
    const buffersCount1 = await page.evaluate(bufs => bufs.length, buffers1);
    console.log(`ArrayBuffers found: ${buffersCount1}`);
    await buffers1.dispose();

    console.log("Loading songs 4-6...")

    await Promise.all([0,1,2].map(id => page.click(`#channel-${id} div.item:nth-child(2)`)));
    await page.waitFor(1000);
    await Promise.all([0,1,2].map(id => page.waitForSelector(`#channel-${id} wave canvas`, { visible: true })));

    console.log("Songs loaded; waiting five seconds for memory usage to stabilise...");
    await page.waitFor(5000);

    const stats2 = await page.metrics();
    console.log(`JS Heap total at time ${stats2.Timestamp}: ${stats2.JSHeapTotalSize}, used ${stats2.JSHeapTotalSize}`);

    const buffers2 = await page.queryObjects(arrayBufferHandle);
    const buffersCount2 = await page.evaluate(bufs => bufs.length, buffers2);
    console.log(`ArrayBuffers found: ${buffersCount2}`);
    await buffers2.dispose();

    console.log("\r\n\r\n");

    const leakThresholdHeap = stats1.JSHeapUsedSize * 1.5;
    const leakThresholdBuffers = buffersCount1 * 1.5;

    console.log(`Leak threshold: heap ${leakThresholdHeap}, buffers ${leakThresholdBuffers}`)
    const leakDetected = (stats2.JSHeapUsedSize > leakThresholdHeap) || ((buffersCount2 * 1.0) > leakThresholdBuffers);
    console.log(leakDetected ? "\r\n\r\nLeak detected!\r\n\r\n" : "\r\n\r\nLeak not detected!\r\n\r\n");

    console.log("Cleaning up...");
    await arrayBufferHandle.dispose();
    await page.close();
    await browser.close();
    console.log("Done!");
    process.exit(leakDetected ? 1 : 0);
  } catch (e) {
    console.error("Something exploded!");
    console.error(e);
    process.exit(130);
  }
})();
