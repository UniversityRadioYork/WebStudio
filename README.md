# WebStudio

WebStudio is URY's big fun machine for doing radio shows from home, using Web Audio and WebRTC.

The clientside is written in TypeScript using React and Redux, the serverside is Python using AsyncIO and JACK.

## Development

### Installing

Clone the repo and run `yarn`.

You'll probably want to change the values in `.env` to reflect the MyRadio environment and/or where the server is running (e.g. if you're running the server locally, change `REACT_APP_WS_URL` to `ws://localhost:8079/stream`).

If you want to hack on the server, create a virtualenv and install Python packages:

```sh
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt
```

### Hacking

Start the client by running `yarn start`.

Start the server by running `python3 server.py`.

Don't forget to ensure that both TypeScript and MyPy pass, as your code will be rejected by CI otherwise - run `tsc --noEmit` and/or `mypy server.py` to check.

## Releasing a new version

Every push to `master` is deployed automatically by Jenkins to https://ury.org.uk/webstudio-dev.

Deploying to https://ury.org.uk/webstudio is also automated but slightly more involved:

1. Change the `version` field in `package.json` to ensure the "about" page is up to date
2. Push up your version bump and create a pull request to the `production` branch - https://github.com/UniversityRadioYork/WebStudio/compare/production...master
3. Once your changes are merged into `production` they'll get deployed automatically (although you will need to restart the server - ssh to Dolby and run `sudo systemctl restart webstudioserver`)
