# WebStudio

WebStudio is URY's big fun machine for doing radio shows from home, using Web Audio and WebRTC. It's also now home to BAPS Presenter, for the BAPS3 [(BAPSicle)](https://github.com/UniversityRadioYork/BAPSicle) project, a stripped down WebStudio with most interactions syphoned off to the BAPSicle server instead.

The clientside is written in TypeScript using React and Redux, the serverside is Python using AsyncIO and JACK.

## Development

### Requirements

Client:

 * Node.js and Yarn (Yarn 1, 2 isn't supported very well by webpack/typescript/anything really)

Server:

* Python >=3.7

### Installing

Clone the repo and run `yarn`.

You'll probably want to change the values in `.env` to reflect the MyRadio environment and/or where the server is running (e.g. if you're running the server locally, change `REACT_APP_WS_URL` to `ws://localhost:8079/stream`).

If you want to hack on the server, create a virtualenv and install Python packages:

```sh
$ python3 -m venv venv
$ source venv/bin/activate
$ pip install -r requirements.txt
```

### Versions

This project provides two different output versions. WebStudio (a client that does all audio in the browser) and BAPS Presenter (a client that controls / displays info from the BAPSicle server).

See below for how to work on each one.

### Hacking (WebStudio)

Start the client by running `npm start`.

Start the server by running `python3 stateserver.py` and `python3 shittyserver.py`.

Don't forget to ensure that both TypeScript and MyPy pass, as your code will be rejected by CI otherwise - run `tsc --noEmit` and/or `mypy server.py` to check.

#### Releasing a new version

Every push to `master` is deployed automatically by Jenkins to https://ury.org.uk/webstudio-dev.

Deploying to https://ury.org.uk/webstudio is also automated but slightly more involved:

1. Change the `version` field in `package.json` to ensure the "about" page is up to date
2. Push up your version bump and create a pull request to the `production` branch - https://github.com/UniversityRadioYork/WebStudio/compare/production...master
3. Once your changes are merged into `production` they'll get deployed automatically (although you will need to restart the server - ssh to Dolby and run `sudo systemctl restart webstudioserver`)

### Hacking (BAPS Presenter)

Start the client by running `npm run start-baps`. If you're running non-default settings for your BAPSicle development server, please change `.env-baps-development`.

#### Releasing a new version

This is done via the BAPSicle project by updating the `/presenter` submodule, since BAPS Presenter is built and packaged into the BAPS Server releases there.

If you want to demo build a BAPS Presenter release, run `npm run build-baps` and the result will be in the `build` directory.

## Screenshots
![Mic Live With Main Screen](images/HomeWithMic.png?raw=true "Mic Live on Main Screen")

![Home Page of webstudio](images/Home.png?raw=true "Home Page of WebStudio")

![Mic Selection Screen](images/MicSelection.png?raw=true "Mic Selection Screen")
