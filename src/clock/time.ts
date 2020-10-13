const ATTEMPTS = 16;

const TIME_SERVER =
  process.env.REACT_APP_TIME_SERVER_URL ||
  "https://audio.ury.org.uk/webstudio/time";

export async function calculateOffset(): Promise<number> {
  console.log("Synchronising clock");
  const results: Array<[number, number]> = [];
  for (let i = 0; i < ATTEMPTS; i++) {
    const t0d = new Date();
    const response = await fetch(TIME_SERVER);
    const t3d = new Date();

    // do some maths
    const data = await response.text();
    const [line0, line1] = data.split("\r\n");
    const t1 = parseFloat(line0) / 1e6;
    const t2 = parseFloat(line1) / 1e6;

    const t0 = t0d.valueOf();
    const t3 = t3d.valueOf();

    //const delta = ((t1 - t0) + (t3 - t2)) / 2;
    const rtt = t3 - t0 - (t2 - t1);

    const delta = t1 - t3;

    console.log(
      `Sync run ${i}; times ${t0} ${t1} ${t2} ${t3}; delta ${delta}; RTT ${rtt}`
    );
    results.push([delta, rtt]);
  }

  // Find the three values with the lowest RTT (=> hopefully the most accurate)
  const best = results.sort((a, b) => a[1] - b[1]);
  // noinspection UnnecessaryLocalVariableJS
  const offset = best.slice(0, 3).reduce((acc, curr) => acc + curr[0], 0) / 3;
  console.log(
    `Clock sync complete, calculated offset ${offset}; RTT best/worst ${
      best[0][1]
    }/${best[ATTEMPTS - 1][1]}`
  );
  return offset;
}
