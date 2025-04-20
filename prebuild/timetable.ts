import fs from "fs";
import { parse } from "csv-parse/sync";

async function parseTimetable(sessions, getTalkUrl) {
  const timesDay1: {[key: string]: string}[] = [];
  const timesDay2: {[key: string]: string}[] = [];
  const days = [
    {"times": timesDay1, "fields": ["time", null, "session", "title"]},
    {"times": timesDay2, "fields": ["time", null, null, null, "session", "title"]}
  ];
  const csv = await fs.promises.readFile('prebuild/timetable.csv');
  const promises = parse(csv).map((line: string[]) => {
      // Work with each record
      return Promise.all(days.map(day => {
        const times = day.times;
        const fields = day.fields;
        const record = Object.fromEntries(fields.map((field, n) => [field, line[n]]).filter(([k, _]) => k !== null));
        if (record["time"] && record["session"] != "|" && (record["session"] || record["title"])) {
          times.push(record);
          if (record["session"]) {
            return new Promise(async (resolve) => {
              const [session, talkNo] = record["session"].split(".");
              const talk = await sessions[session][`slot_${talkNo}`];
              record["title"] = await (await talk.title).forJson();
              record["url"] = await getTalkUrl(talk);
              record["presenters"] = await Promise.all((await talk.presenter).map(async (presenter) => (await ((await presenter).name)).toString()));
              resolve(null);
            });
          }
        }
      }));
    }
  );
  await Promise.all(promises.flat());
  return [timesDay1, timesDay2];
};

export { parseTimetable };
