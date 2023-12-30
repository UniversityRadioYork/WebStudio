#!flask/bin/python
## IMPORTANT ASSUMPTIONS MADE:
# show timestamps start on the hour.
# normal shows in real studios aren't currently a thing!!!
import subprocess
from typing import List, Any, Dict, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS  # type: ignore
import requests
import datetime
import random
from telnetlib import Telnet
import configparser

config = configparser.RawConfigParser()
config.read("serverconfig.ini")

api_key = config.get("stateserver", "myradio_key")
app = Flask(__name__)
CORS(app)  # Enable Cors access-all

SUSTAINER_AUTONEWS = config.get("stateserver", "sustainer_autonews") == "True"


def do_ws_srv_telnet(source: str) -> None:
    HOST = "localhost"
    print(
        "telnet {} {} SEL {}".format(
            HOST, config.get("shittyserver", "telnet_port"), source
        )
    )
    tn = Telnet(HOST, int(config.get("shittyserver", "telnet_port")))
    tn.write(b"SEL " + str.encode(source) + b"\n")
    try:
        print(tn.read_until(b"\n").decode("utf-8"))
    except EOFError:
        pass
    else:
        tn.close()


def genFail(reason: str, code: int = 400) -> Any:
    return jsonify({"status": "FAIL", "reason": reason})


def genPayload(payload: Any) -> Any:
    return jsonify({"status": "OK", "payload": payload})


def myradioApiRequest(url: str) -> Any:
    res = requests.get("https://ury.org.uk/api/v2/" + url + "?api_key=" + api_key)
    if res.ok:
        return res.json()["payload"]
    else:
        raise Exception("err {} {}".format(res.status_code, res.text))


def getNextHourTimestamp() -> int:
    current = datetime.datetime.now()
    currentPlusHour = current + datetime.timedelta(hours=1)
    nextHourStart = currentPlusHour.replace(minute=0, second=0)
    nextTimestamp = int(nextHourStart.timestamp())
    return nextTimestamp


# sadly we're on python 3.7 so we can't use TypedDict
Connection = Dict[str, Any]


def getConnByID(connID: str) -> Optional[Connection]:
    for conn in connections:
        if conn["connid"] == connID:
            return conn
    return None


SOURCE_JUKEBOX = 3  # Set to 8 for testing.
SOURCE_OB = 4
SOURCE_WS = 5
SOURCE_OFFAIR = 8
SOURCES = [SOURCE_JUKEBOX, SOURCE_OB, SOURCE_WS, SOURCE_OFFAIR]

# This array will only hold connections we've validated to be authorised to broadcast.
connections: List[Connection] = []
wsSessions: Dict[str, Dict[str, str]] = {}


def getCurrentShowConnection() -> Optional[Connection]:
    for connection in connections:
        if (connection["startTimestamp"] <= datetime.datetime.now().timestamp()) and (
            connection["endTimestamp"] >= getNextHourTimestamp()
        ):
            return connection
    return None


def getNextHourConnection() -> Optional[Connection]:
    nextHourTimestamp = getNextHourTimestamp()
    isConnectionEnding = False
    for connection in connections:
        if connection["startTimestamp"] == nextHourTimestamp:
            return connection
        if connection["endTimestamp"] == nextHourTimestamp:
            isConnectionEnding = True

    if not isConnectionEnding:
        # There isn't a show that starts at the next hour, so we're returning the current connection.
        return getCurrentShowConnection()
    else:
        # The show is ending, return no next show.
        return None


def cleanOldConnections() -> None:
    global connections
    # Go backwards round the loop so that pop's don't interfere with the index.
    for i in range(len(connections) - 1, -1, -1):
        if connections[i]["endTimestamp"] < datetime.datetime.now().timestamp():
            connections.pop(i)


def stateDecider() -> Dict[str, Any]:
    currentConnection = getCurrentShowConnection()
    nextConnection = getNextHourConnection()
    print("currentConnection:", currentConnection)
    print("nextConnection:", nextConnection)
    willRunAutoNews = True
    switchAudioAtMin = 2
    newSelSource = None
    newWSSource = None
    if currentConnection != nextConnection:
        print("Will be transitioning")
        # The show is transitioning this hour.
        if currentConnection:
            print("There's a current connection.")
            # Current show wants to end their show at 2 mins past
            if currentConnection["autoNewsEnd"] == False:
                print("This show doesn't want to end with news.")
                willRunAutoNews = False
                switchAudioAtMin = 2  # no real change here
        if nextConnection:
            print("There's a next connection.")
            # next show wants to begin at 0 mins past hour.
            if nextConnection["autoNewsBeginning"] == False:
                print("The next connection doesn't want news at start.")
                willRunAutoNews = False
                switchAudioAtMin = 0

            newSelSource = nextConnection["sourceid"]
            newWSSource = nextConnection["wsid"]  # None if show is not a WS.
        else:
            print("No next show, going back to jukebox.")
            # There isn't a next show, go back to sustainer
            newSelSource = SOURCE_JUKEBOX

    else:
        # Show/sustainer is continuing for another hour.
        print("Show / Sustainer is continuing this hour.")
        if currentConnection:
            print("We're currently doing a show, so check if they want middle news.")
            willRunAutoNews = currentConnection["autoNewsMiddle"]
            print("(conclusion: {})".format("yes" if willRunAutoNews else "no"))
            newSelSource = currentConnection["sourceid"]
            newWSSource = currentConnection["wsid"]
        elif SUSTAINER_AUTONEWS:
            print(
                "There's no show on currently, so we're going to AutoNEWS on sustainer"
            )
            # Jukebox -> NEWS -> Jukebox
            newSelSource = SOURCE_JUKEBOX
        else:
            print(
                "There's no show on currently, but AutoNews on sustainer is disabled, so don't do news"
            )
            # Jukebox -> Jukebox
            newSelSource = SOURCE_JUKEBOX
            switchAudioAtMin = 0
            willRunAutoNews = False

    nextState = {
        "autoNews": willRunAutoNews,
        "switchAudioAtMin": switchAudioAtMin,
        "selSource": newSelSource,
        "wsSource": newWSSource,
    }

    return nextState


@app.route("/api/v1/status", methods=["GET"])
def get_status() -> Any:
    print(getNextHourTimestamp())
    global connections
    cleanOldConnections()
    return genPayload({"connections": connections, "wsSessions": wsSessions})


@app.route("/api/v1/nextTransition", methods=["GET"])
def get_next_transition() -> Any:
    cleanOldConnections()
    return genPayload(stateDecider())


@app.route("/api/v1/cancelTimeslot", methods=["POST"])
def post_cancelCheck() -> Any:
    global connections
    content = request.json
    if not content:
        return genFail("No parameters provided.")
    if not isinstance(content["connid"], int):
        return genFail("Request missing valid connid.")

    # We're gonna cancel their show.
    currentShow = getCurrentShowConnection()
    if currentShow and currentShow["connid"] == content["connid"]:
        # this show is (at least supposed to be) live now.
        # kill their show
        # but don't kill it during the news, or after the end time, to avoid unexpected jukeboxing
        now = datetime.datetime.now().timestamp()
        if now < (currentShow["endTimestamp"] - 15):
            print(
                "Jukeboxing due to {}'s ({}, {}) cancellation".format(
                    currentShow["connid"],
                    currentShow["timeslotid"],
                    currentShow["wsid"],
                )
            )
            do_ws_srv_telnet("NUL")
            subprocess.Popen(["sel", str(SOURCE_JUKEBOX)])

    # yeet the connection
    for i in range(len(connections)):
        if connections[i]["connid"] == content["connid"]:
            connections.pop(i)
            return genPayload("Connection cancelled.")
    return genFail("Connection not found.")


@app.route("/api/v1/registerTimeslot", methods=["POST"])
def post_registerCheck() -> Any:
    global connections

    content = request.json
    if not content:
        return genFail("No parameters provided.")
    if not isinstance(content["timeslotid"], int):
        return genFail("Request missing valid timeslotid.")
    if not isinstance(content["memberid"], int):
        return genFail("Request missing valid memberid.")
    if not isinstance(content["sourceid"], int):
        return genFail("Request missing valid source.")
    if not content["sourceid"] in SOURCES:
        return genFail("Request missing valid source.")
    if not isinstance(content["wsid"], str):
        return genFail("Request missing valid wsID")

    member = myradioApiRequest("user/" + str(content["memberid"]))
    if not member:
        return genFail("Could not get member.")

    timeslot = myradioApiRequest("timeslot/" + str(content["timeslotid"]))
    if not timeslot:
        return genFail("Could not get tiemslot.")

    found_credit = False
    for credit in timeslot["credits"]:
        if content["memberid"] == credit["memberid"]:
            found_credit = True
            break
    if not found_credit:
        return genFail("You are not authorised to broadcast for this timeslot.")

    start_time = datetime.datetime.strptime(timeslot["start_time"], "%d/%m/%Y %H:%M")

    duration = timeslot["duration"].split(":")
    duration_time = datetime.timedelta(hours=int(duration[0]), minutes=int(duration[1]))

    end_time = start_time + duration_time

    now_time = datetime.datetime.now()

    connection: Optional[Connection] = None
    for conn in connections:
        if content["timeslotid"] == conn["timeslotid"]:
            # they've already registered, return the existing session
            print(
                "found existing connection {} for {}".format(
                    conn["connid"], conn["timeslotid"]
                )
            )
            connection = conn
            # make sure we update their wsID
            if "wsid" in content:
                connection["wsid"] = content["wsid"]

    new_connection = False
    if connection is None:
        new_connection = True

        if start_time - now_time > datetime.timedelta(hours=1):
            return genFail(
                "This show too far away, please try again within an hour of starting your show."
            )

        if start_time + duration_time < now_time:
            return genFail("This show has already ended.")

        if (
            start_time - datetime.timedelta(minutes=1)
            < now_time
            < start_time + datetime.timedelta(minutes=2)
        ):
            return genFail(
                "You registered too late. Please re-register after the news."
            )

        random.seed(a=timeslot["timeslot_id"], version=2)
        connection = {
            "connid": random.randint(
                0, 100000000
            ),  # TODO: this is horrible. I'll sort this later.
            "timeslotid": timeslot["timeslot_id"],
            "startTimestamp": int(start_time.timestamp()),
            "endTimestamp": int(end_time.timestamp()),
            "sourceid": content["sourceid"],
            "autoNewsBeginning": True,
            "autoNewsMiddle": True,
            "autoNewsEnd": True,
            "wsid": content["wsid"],
        }

    if start_time + datetime.timedelta(minutes=2) < now_time:
        if connection["wsid"] is not None:
            # they're late, bring them live now
            print(
                "({}, {}) late, bringing on air now".format(
                    connection["connid"], connection["wsid"]
                )
            )
            do_ws_srv_telnet(connection["wsid"])
            subprocess.Popen(["sel", "5"])

    assert connection is not None
    if new_connection:
        connections.append(connection)
    print(connections)

    return genPayload(connection)


@app.route("/api/v1/changeTimeslot", methods=["POST"])
def post_settingsCheck() -> Any:
    global connections
    content = request.json
    if not content:
        return genFail("No parameters provided.")
    if not isinstance(content["connid"], int):
        return genFail("Request missing valid connID.")
    if not isinstance(content["beginning"], bool):
        return genFail("Request missing valid beginning bool.")
    if not isinstance(content["middle"], bool):
        return genFail("Request missing valid middle bool.")
    if not isinstance(content["end"], bool):
        return genFail("Request missing valid end bool.")
    if not isinstance(content["sourceid"], int):
        return genFail("Request missing valid sourcid.")

    for conn in connections:
        if conn["connid"] == content["connid"]:
            conn["autoNewsBeginning"] = content["beginning"]
            conn["autoNewsMiddle"] = content["middle"]
            conn["autoNewsEnd"] = content["end"]
            conn["sourceid"] = content["sourceid"]
            return genPayload(conn)
    return genFail("No connection found.")


@app.route("/api/v1/updateWSSessions", methods=["POST"])
def post_wsSessions() -> Any:
    global connections
    global wsSessions
    content = request.json
    assert content is not None
    # if not content:
    #    return genFail("No parameters provided.")
    oldSessions = wsSessions

    wsSessions = content
    print("New wsSessions:", wsSessions)
    wsids_to_remove = []
    wsids_to_add = []
    for session in oldSessions:
        if not oldSessions[session]["connection_id"] in wsSessions:
            wsids_to_remove.append(oldSessions[session]["connection_id"])

    print("wsSessions which have disappeared:", wsids_to_remove)

    for session in wsSessions:
        if not wsSessions[session]["connection_id"] in oldSessions:
            wsids_to_add.append(wsSessions[session]["connection_id"])

    print("wsSessions which have appeared:", wsids_to_add)

    for conn in connections:
        if conn["wsid"] in wsids_to_add:
            if conn["startTimestamp"] + 120 < datetime.datetime.now().timestamp():
                # they're late, bring them on air now
                print(
                    "({}, {}) late, bringing on air now".format(
                        conn["connid"], conn["wsid"]
                    )
                )
                do_ws_srv_telnet(conn["wsid"])
                subprocess.Popen(["sel", "5"])

        if conn["wsid"] in wsids_to_remove:
            print("({}, {}) gone".format(conn["connid"], conn["wsid"]))
            conn["wsid"] = None
            currentShow = getCurrentShowConnection()
            if currentShow and currentShow["connid"] == conn["connid"]:
                # they should be on air now, but they've just died. go to jukebox.
                # but don't kill it during the news, or after the end time, to avoid unexpected jukeboxing
                # Also, avoid killing them if they're on a non-WS source
                if currentShow["sourceid"] == SOURCE_WS:
                    now = datetime.datetime.now().timestamp()
                    if now < (currentShow["endTimestamp"] - 15):
                        print("jukeboxing due to their disappearance...")
                        subprocess.Popen(["sel", str(SOURCE_JUKEBOX)])
                        do_ws_srv_telnet("NUL")
    return genPayload("Thx, K, bye.")


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0")
